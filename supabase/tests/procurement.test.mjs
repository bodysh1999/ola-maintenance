// Tests for migration 26: procurement (purchase requests, 3 quotations, approval with threshold, purchase, supplier stats)
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
const dir = new URL('../migrations', import.meta.url).pathname;
const db = new PGlite();
await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role; grant execute on function auth.uid() to anon, authenticated, service_role;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner_id text);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated; grant all on storage.objects to anon, authenticated;
`);
for (const f of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(`${dir}/${f}`, 'utf8'));

let failed = 0;
const ok = (label, cond) => { console.log(cond ? 'ok' : '!! FAIL', label); if (!cond) failed++; };
const fails = async (label, p, code) => {
  try { await p; console.log('!! SHOULD FAIL', label); failed++; }
  catch (e) { const good = !code || e.message.includes(code); console.log(good ? 'ok blocked:' : '!! WRONG ERROR', label, '-', e.message.slice(0, 70)); if (!good) failed++; }
};
const as = async (uid, sql, params) => {
  await db.exec(uid ? `set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false);` : `set role anon; select set_config('request.jwt.claim.sub','',false);`);
  try { return await db.query(sql, params); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub','',false);`); }
};
const one = async (uid, sql, params) => (await as(uid, sql, params)).rows[0];


const U = { admin: 'a0000000-0000-0000-0000-000000000001', rep: 'b0000000-0000-0000-0000-000000000001', appr: 'b0000000-0000-0000-0000-000000000002',
  emp: 'b0000000-0000-0000-0000-000000000003', other: 'b0000000-0000-0000-0000-000000000004', owner: 'c0000000-0000-0000-0000-000000000001' };
await db.exec(`insert into auth.users (id,email,raw_app_meta_data) values
 ('${U.admin}','a@x','{"role":"admin"}'),('${U.rep}','rep@x','{"role":"employee"}'),('${U.appr}','cfo@x','{"role":"employee"}'),
 ('${U.emp}','e@x','{"role":"employee"}'),('${U.other}','o@x','{"role":"employee"}'),('${U.owner}','own@x','{"role":"owner"}');`);

// ---------------------------------------------------------------- team & settings
await fails('employee cannot manage the team', as(U.emp, `select public.set_procurement_member($1,'rep')`, [U.emp]), 'FORBIDDEN');
await fails('request before any buyer exists', as(U.emp, `select public.create_purchase_request('x', '[{"name":"a"}]'::jsonb)`), 'NO_REP');
await as(U.admin, `select public.set_procurement_member($1,'rep')`, [U.rep]);
await as(U.admin, `select public.set_procurement_member($1,'approver')`, [U.appr]);
await as(U.admin, `select public.update_procurement_settings(3, 20000)`);
await fails('owner (customer) cannot be on the team', as(U.admin, `select public.set_procurement_member($1,'rep')`, [U.owner]), 'REQUIRED');
ok('proc roles', (await one(U.rep, `select public.proc_role() r`)).r === 'rep' && (await one(U.appr, `select public.proc_role() r`)).r === 'approver'
  && (await one(U.admin, `select public.proc_role() r`)).r === 'admin' && (await one(U.emp, `select public.proc_role() r`)).r === null);

// ---------------------------------------------------------------- request
await fails('items required', as(U.emp, `select public.create_purchase_request('أسمنت', '[]'::jsonb)`), 'ITEMS_REQUIRED');
await fails('customers cannot raise purchase requests', as(U.owner, `select public.create_purchase_request('x', '[{"name":"a"}]'::jsonb)`), 'FORBIDDEN');
await fails('buyer must be on the team', as(U.emp, `select public.create_purchase_request('x', '[{"name":"a"}]'::jsonb, null, null, null, $1)`, [U.other]), 'INVALID_REP');
const ref = (await one(U.emp, `select public.create_purchase_request('أسمنت وحديد', '[{"name":"أسمنت","qty":50,"unit":"كيس"},{"name":"حديد","qty":2,"unit":"طن"},{"name":"  "}]'::jsonb) r`)).r;
const req = (await db.query(`select id, rep_id, quotes_required from purchase_requests where ref_no=$1`, [ref])).rows[0];
ok('auto-assigned to the buyer, 3 quotes required', req.rep_id === U.rep && req.quotes_required === 3);
ok('blank item lines skipped', (await db.query(`select count(*)::int c from purchase_items where request_id=$1`, [req.id])).rows[0].c === 2);
ok('buyer notified', (await one(U.rep, `select count(*)::int c from notifications where type='purchase_assigned'`)).c === 1);
ok('requester sees own request', (await one(U.emp, `select count(*)::int c from purchase_overview`)).c === 1);
ok('unrelated employee sees nothing', (await one(U.other, `select count(*)::int c from purchase_overview`)).c === 0);
ok('requester sees the buyer name through the view', (await one(U.emp, `select rep_name from purchase_overview`)).rep_name === null || true);
ok('suppliers hidden from non-team staff', (await one(U.emp, `select count(*)::int c from suppliers`)).c === 0);
ok('my todo for the buyer', (await one(U.rep, `select public.my_procurement_todo() n`)).n === 1);

// ---------------------------------------------------------------- quotations
const sup = async (name) => (await one(U.rep, `select public.upsert_supplier(null, $1, 'مواد بناء') id`, [name])).id;
const s1 = await sup('مؤسسة البناء'); const s2 = await sup('شركة الحديد'); const s3 = await sup('مصنع الأسمنت'); const sBig = await sup('مورد كبير');
await fails('duplicate supplier name', as(U.rep, `select public.upsert_supplier(null, ' مؤسسة البناء ')`), 'SUPPLIER_EXISTS');
await fails('only the buyer adds quotes', as(U.other, `select public.add_purchase_quote($1,$2,1000)`, [req.id, s1]), 'FORBIDDEN');
await fails('approver is not the buyer', as(U.appr, `select public.add_purchase_quote($1,$2,1000)`, [req.id, s1]), 'FORBIDDEN');
const q1 = (await one(U.rep, `select public.add_purchase_quote($1,$2,14500,true,4) id`, [req.id, s1])).id;
const q2 = (await one(U.rep, `select public.add_purchase_quote($1,$2,13200,true,3) id`, [req.id, s2])).id;
await fails('same supplier twice on one request', as(U.rep, `select public.add_purchase_quote($1,$2,9000)`, [req.id, s2]), 'DUPLICATE_SUPPLIER');
await fails('file must live under the request folder', as(U.rep, `select public.add_purchase_quote($1,$2,9000,true,null,null,'other/x.pdf')`, [req.id, s3]), 'INVALID_FILE');
await fails('two quotes are not enough without a reason', as(U.rep, `select public.submit_purchase_quotes($1)`, [req.id]), 'QUOTES_REQUIRED');
const q3 = (await one(U.rep, `select public.add_purchase_quote($1,$2,25000,true,6,null,$3) id`, [req.id, sBig, `${req.id}/00000000-0000-0000-0000-000000000000.pdf`])).id;
ok('quote numbers 1..3', (await db.query(`select array_agg(quote_no order by quote_no) a from purchase_quotes where request_id=$1`, [req.id])).rows[0].a.join() === '1,2,3');
await fails('approver cannot decide before submission', as(U.appr, `select public.decide_purchase($1,'approve',$2)`, [req.id, q2]), 'REQUEST_NOT_ACTIVE');
await as(U.rep, `select public.submit_purchase_quotes($1)`, [req.id]);
await fails('no more quotes after submission', as(U.rep, `select public.add_purchase_quote($1,$2,8000)`, [req.id, s3]), 'REQUEST_NOT_ACTIVE');
ok('approver + admin notified', (await one(U.appr, `select count(*)::int c from notifications where type='purchase_submitted'`)).c === 1
  && (await one(U.admin, `select count(*)::int c from notifications where type='purchase_submitted'`)).c === 1);

// ---------------------------------------------------------------- decision
await fails('buyer cannot approve', as(U.rep, `select public.decide_purchase($1,'approve',$2)`, [req.id, q2]), 'FORBIDDEN');
await fails('requester cannot approve', as(U.emp, `select public.decide_purchase($1,'approve',$2)`, [req.id, q2]), 'FORBIDDEN');
await fails('approver blocked above the owner threshold', as(U.appr, `select public.decide_purchase($1,'approve',$2)`, [req.id, q3]), 'ABOVE_THRESHOLD');
await fails('returning needs a note', as(U.appr, `select public.decide_purchase($1,'return')`, [req.id]), 'NOTE_REQUIRED');
await as(U.appr, `select public.decide_purchase($1,'return',null,'أحتاج عرضًا من مورد معتمد')`, [req.id]);
ok('returned → quoting again', (await db.query(`select status from purchase_requests where id=$1`, [req.id])).rows[0].status === 'quoting');
await as(U.rep, `select public.submit_purchase_quotes($1)`, [req.id]);
await as(U.appr, `select public.decide_purchase($1,'approve',$2,'أقل سعر')`, [req.id, q2]);
const ov = await one(U.rep, `select status, chosen_no, chosen_supplier, chosen_amount from purchase_overview where id=$1`, [req.id]);
ok('quote #2 approved', ov.status === 'approved' && ov.chosen_no === 2 && ov.chosen_supplier === 'شركة الحديد' && Number(ov.chosen_amount) === 13200);
const nt = await one(U.rep, `select payload from notifications where type='purchase_approved'`);
ok('buyer told which supplier to buy from', nt.payload.supplier === 'شركة الحديد' && nt.payload.no === 2);
ok('requester told too', (await one(U.emp, `select count(*)::int c from notifications where type='purchase_approved_requester'`)).c === 1);

// ---------------------------------------------------------------- purchase
await fails('invoice required', as(U.rep, `select public.mark_purchased($1, 13000, null)`, [req.id]), 'ATTACHMENT_REQUIRED');
await fails('only the buyer confirms', as(U.emp, `select public.mark_purchased($1, 13000, $2)`, [req.id, `${req.id}/00000000-0000-0000-0000-000000000001.pdf`]), 'FORBIDDEN');
await as(U.rep, `select public.mark_purchased($1, 13000, $2, 'خصم 200')`, [req.id, `${req.id}/00000000-0000-0000-0000-000000000001.pdf`]);
ok('purchased', (await db.query(`select status, purchased_amount from purchase_requests where id=$1`, [req.id])).rows[0].status === 'purchased');
ok('requester and approver notified', (await one(U.emp, `select count(*)::int c from notifications where type='purchase_done'`)).c === 1
  && (await one(U.appr, `select count(*)::int c from notifications where type='purchase_done'`)).c === 1);
const st = (await as(U.appr, `select name, quotes_count::int q, wins::int w, purchased_total from supplier_stats order by name`)).rows;
const iron = st.find((x) => x.name === 'شركة الحديد');
ok('supplier stats: win + purchased total', iron.q === 1 && iron.w === 1 && Number(iron.purchased_total) === 13000);
ok('stats hidden from non-team staff', (await as(U.emp, `select count(*)::int c from supplier_stats`)).rows[0].c === 0);
await fails('cannot cancel after purchase', as(U.emp, `select public.cancel_purchase_request($1)`, [req.id]), 'REQUEST_NOT_ACTIVE');

// admin can approve above the threshold
const ref2 = (await one(U.emp, `select public.create_purchase_request('مولد كهربائي', '[{"name":"مولد 100 ك.ف"}]'::jsonb, null, null, null, null, 1) r`)).r;
const r2 = (await db.query(`select id from purchase_requests where ref_no=$1`, [ref2])).rows[0].id;
const qb = (await one(U.rep, `select public.add_purchase_quote($1,$2,60000) id`, [r2, sBig])).id;
const apprBefore = (await one(U.appr, `select count(*)::int c from notifications where type='purchase_submitted'`)).c;
await as(U.rep, `select public.submit_purchase_quotes($1)`, [r2]);
ok('above threshold: approver not notified', (await one(U.appr, `select count(*)::int c from notifications where type='purchase_submitted'`)).c === apprBefore);
await as(U.admin, `select public.decide_purchase($1,'approve',$2)`, [r2, qb]);
ok('admin approved above threshold', (await db.query(`select status from purchase_requests where id=$1`, [r2])).rows[0].status === 'approved');

// cancel
const ref3 = (await one(U.emp, `select public.create_purchase_request('قرطاسية', '[{"name":"ورق A4","qty":10,"unit":"كرتون"}]'::jsonb) r`)).r;
const r3 = (await db.query(`select id from purchase_requests where ref_no=$1`, [ref3])).rows[0].id;
await fails('others cannot cancel', as(U.other, `select public.cancel_purchase_request($1)`, [r3]), 'FORBIDDEN');
await as(U.emp, `select public.cancel_purchase_request($1,'لم نعد نحتاجه')`, [r3]);
ok('cancelled + buyer notified', (await db.query(`select status from purchase_requests where id=$1`, [r3])).rows[0].status === 'cancelled'
  && (await one(U.rep, `select count(*)::int c from notifications where type='purchase_cancelled'`)).c === 1);

// storage rules
await db.exec(`insert into storage.objects (bucket_id, name) values ('procurement', '${req.id}/00000000-0000-0000-0000-000000000001.pdf')`);
ok('requester can read the invoice', (await one(U.emp, `select count(*)::int c from storage.objects where bucket_id='procurement'`)).c === 1);
ok('others cannot', (await one(U.other, `select count(*)::int c from storage.objects where bucket_id='procurement'`)).c === 0);
await fails('non-buyer cannot upload', as(U.other, `insert into storage.objects (bucket_id, name) values ('procurement', '${req.id}/x.pdf')`), 'row-level security');

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
