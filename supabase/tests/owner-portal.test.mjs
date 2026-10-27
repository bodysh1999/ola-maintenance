// Tests for migration 14: unit documents, warranty certificates + alerts, live tracking, outside-message queue
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
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner_id text, created_at timestamptz default now());
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
const asService = async (sql, params) => { await db.exec('set role service_role'); try { return await db.query(sql, params); } finally { await db.exec('reset role'); } };

const U = {
  admin: '00000000-0000-0000-0000-00000000000a', sup: '00000000-0000-0000-0000-00000000000b',
  tech: '00000000-0000-0000-0000-00000000000c', tech2: '00000000-0000-0000-0000-00000000000f',
  own1: '00000000-0000-0000-0000-00000000000d', own2: '00000000-0000-0000-0000-00000000000e',
};
const UNIT1 = '40000000-0000-0000-0000-000000000001', UNIT2 = '40000000-0000-0000-0000-000000000002';
const T1 = '50000000-0000-0000-0000-000000000001', T2 = '50000000-0000-0000-0000-000000000002';
await db.exec(`
insert into auth.users (id,email,raw_app_meta_data,raw_user_meta_data) values
 ('${U.admin}','a@x','{"role":"admin"}','{"full_name":"مدير","phone":"0500000001"}'),
 ('${U.sup}','s@x','{"role":"supervisor"}','{"full_name":"مشرف","phone":"0500000002"}'),
 ('${U.tech}','t@x','{"role":"technician"}','{"full_name":"فني"}'),
 ('${U.tech2}','t2@x','{"role":"technician"}','{"full_name":"فني2"}'),
 ('${U.own1}','o1@x','{"role":"owner"}','{"full_name":"عبدالله الشمري"}'),
 ('${U.own2}','o2@x','{"role":"owner"}','{"full_name":"مالك2"}');
insert into public.projects (id,name_ar) values ('10000000-0000-0000-0000-000000000001','عُلا 17');
insert into public.buildings (id,project_id,name,floors_count) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','المبنى الرئيسي',4);
insert into public.owners (id,profile_id,full_name,phone,email,account_status) values
 ('30000000-0000-0000-0000-000000000001','${U.own1}','عبدالله الشمري','0551234567','o1@x','active'),
 ('30000000-0000-0000-0000-000000000002','${U.own2}','مالك2','0559999999','o2@x','active');
insert into public.units (id,building_id,unit_number,owner_id,handover_date) values
 ('${UNIT1}','20000000-0000-0000-0000-000000000001','101','30000000-0000-0000-0000-000000000001',current_date - 400),
 ('${UNIT2}','20000000-0000-0000-0000-000000000001','102','30000000-0000-0000-0000-000000000002',current_date - 400);
insert into public.warranties (unit_id,category,title,start_date,end_date) values
 ('${UNIT1}','plumbing','ضمان السباكة',current_date - 400,current_date + 330),
 ('${UNIT1}','hvac','ضمان التكييف',current_date - 400,current_date + 10),
 ('${UNIT1}','painting','ضمان الدهانات',current_date - 400,current_date - 35),
 ('${UNIT2}','hvac','ضمان التكييف',current_date - 400,current_date + 5);
insert into public.technicians (id,profile_id,full_name,phone,specialties) values
 ('${T1}','${U.tech}','فني','0552220001','{plumbing,hvac}'), ('${T2}','${U.tech2}','فني2','0552220002','{plumbing}');
`);

// ---------------------------------------------------------------- 1) unit documents
await as(U.sup, `insert into unit_documents (unit_id,kind,title,storage_path,file_name) values ($1::uuid,'sale_contract','عقد البيع',$1::text || '/a.pdf','a.pdf')`, [UNIT1]);
await db.exec(`insert into storage.objects (bucket_id,name) values ('unit-docs','${UNIT1}/a.pdf'),('unit-docs','${UNIT2}/b.pdf')`);
await as(U.admin, `insert into unit_documents (unit_id,kind,title,storage_path,file_name) values ($1::uuid,'title_deed','الصك',$1::text || '/b.pdf','b.pdf')`, [UNIT2]);
ok('owner1 sees own unit docs only', (await as(U.own1, `select count(*)::int c from unit_documents`)).rows[0].c === 1);
ok('owner2 sees own unit docs only', (await as(U.own2, `select title from unit_documents`)).rows.map((r) => r.title).join() === 'الصك');
ok('owner1 reads own file in storage', (await as(U.own1, `select count(*)::int c from storage.objects where bucket_id='unit-docs'`)).rows[0].c === 1);
await fails('owner uploads a document row', as(U.own1, `insert into unit_documents (unit_id,title,storage_path,file_name) values ($1::uuid,'x',$1::text || '/x.pdf','x')`, [UNIT1]));
await fails('owner uploads to unit-docs bucket', as(U.own1, `insert into storage.objects (bucket_id,name) values ('unit-docs',$1::text || '/x.pdf')`, [UNIT1]));
await fails('staff row path of another unit', as(U.sup, `insert into unit_documents (unit_id,title,storage_path,file_name) values ($1::uuid,'x',$2::text || '/y.pdf','y')`, [UNIT1, UNIT2]));
await fails('owner deletes a document', as(U.own1, `delete from unit_documents returning 1`).then((r) => { if (!r.rows.length) throw new Error('nothing deleted'); }));
ok('anon sees no documents', await as(null, `select count(*)::int c from unit_documents`).then((r) => r.rows[0].c === 0).catch(() => true));

// ---------------------------------------------------------------- 2) warranty certificate + alerts
const code = (await db.query(`select verify_code from warranties where unit_id=$1 and category='plumbing'`, [UNIT1])).rows[0].verify_code;
ok('verify code is 32 hex', /^[0-9a-f]{32}$/.test(code));
const v = (await as(null, `select public.verify_warranty($1) v`, [code])).rows[0].v;
ok('anon verifies warranty', v?.title === 'ضمان السباكة' && v.unit_number === '101' && v.active === true);
ok('owner name shortened', v?.owner === 'عبدالله ش.');
ok('wrong code → nothing', (await as(null, `select public.verify_warranty('00000000000000000000000000000000') v`)).rows[0].v === null);
ok('upper-case code accepted', (await as(null, `select public.verify_warranty($1) v`, [code.toUpperCase()])).rows[0].v?.title === 'ضمان السباكة');
await fails('anon reads warranties table', as(null, `select * from warranties`));

await fails('owners cannot run the alert queue', as(U.own1, `select public.queue_warranty_alerts()`), 'permission denied');
const n1 = (await db.query(`select public.queue_warranty_alerts() n`)).rows[0].n;
ok('alerts queued for the 2 warranties ending ≤30 days', n1 === 2);
ok('second run adds nothing', (await db.query(`select public.queue_warranty_alerts() n`)).rows[0].n === 0);
const al = (await as(U.own1, `select payload from notifications where type='warranty_expiring'`)).rows;
ok('owner1 got 1 alert (hvac in 10 days)', al.length === 1 && al[0].payload.days === 10 && al[0].payload.title === 'ضمان التكييف');
ok('expired warranty not alerted', !(await db.query(`select 1 from notifications where type='warranty_expiring' and payload->>'title'='ضمان الدهانات'`)).rows.length);
await fails('user reads warranty_alerts', as(U.own1, `select * from warranty_alerts`));

// ---------------------------------------------------------------- 3) live tracking
const rid = (await as(U.own1, `insert into maintenance_requests (unit_id, owner_id, category, location_in_unit, description)
  values ($1,'30000000-0000-0000-0000-000000000001','plumbing','المطبخ','تسريب تحت المغسلة') returning id`, [UNIT1])).rows[0].id;
await as(U.sup, `select public.transition_request($1,'approved',null)`, [rid]);
const wo = (await as(U.sup, `select public.assign_request($1,$2,'افحص',null, now()+interval '1 day', null) id`, [rid, T1])).rows[0].id;
await fails('other technician: on the way', as(U.tech2, `select public.tech_on_the_way($1, 20)`, [wo]));
await fails('owner: on the way', as(U.own1, `select public.tech_on_the_way($1, 20)`, [wo]));
await fails('bad eta', as(U.tech, `select public.tech_on_the_way($1, 5000)`, [wo]), 'INVALID_ETA');
await as(U.tech, `select public.tech_on_the_way($1, 25)`, [wo]);
const ov = (await as(U.own1, `select on_the_way_at, eta_minutes, technician_photo, appointment_status from request_overview where id=$1`, [rid])).rows[0];
ok('owner sees on-the-way + eta', !!ov.on_the_way_at && ov.eta_minutes === 25 && ov.appointment_status === 'scheduled');
ok('owner notified tech_on_the_way', (await as(U.own1, `select payload from notifications where type='tech_on_the_way'`)).rows[0]?.payload.eta === 25);

await fails('owner2 confirms owner1 visit', as(U.own2, `select public.owner_confirm_visit($1)`, [rid]), 'FORBIDDEN');
await as(U.own1, `select public.owner_confirm_visit($1)`, [rid]);
ok('confirmation stored', !!(await as(U.sup, `select owner_confirmed_at from request_overview where id=$1`, [rid])).rows[0].owner_confirmed_at);
ok('staff notified of confirmation', (await as(U.sup, `select count(*)::int c from notifications where type='visit_owner_confirmed'`)).rows[0].c === 1);
await fails('reschedule without note', as(U.own1, `select public.owner_request_reschedule($1, '  ')`, [rid]), 'NOTE_REQUIRED');
await as(U.own1, `select public.owner_request_reschedule($1, 'الأحد بعد العصر')`, [rid]);
const rs = (await as(U.sup, `select owner_confirmed_at, owner_reschedule_note from request_overview where id=$1`, [rid])).rows[0];
ok('reschedule note stored, confirmation cleared', rs.owner_reschedule_note === 'الأحد بعد العصر' && !rs.owner_confirmed_at);
ok('staff notified of reschedule', (await as(U.admin, `select count(*)::int c from notifications where type='reschedule_requested'`)).rows[0].c === 1);
await as(U.sup, `select public.schedule_visit($1, now()+interval '3 day', null, null)`, [rid]);
const rs2 = (await as(U.own1, `select owner_confirmed_at, owner_reschedule_note from request_overview where id=$1`, [rid])).rows[0];
ok('new visit starts fresh', !rs2.owner_confirmed_at && !rs2.owner_reschedule_note);
await as(U.tech, `select public.tech_start_work($1)`, [wo]);
ok('on-the-way cleared when work starts', !(await as(U.own1, `select on_the_way_at from request_overview where id=$1`, [rid])).rows[0].on_the_way_at);
await fails('on the way after starting', as(U.tech, `select public.tech_on_the_way($1, 10)`, [wo]), 'INVALID_TRANSITION');

// ---------------------------------------------------------------- 4) outside messages
const outbox = async () => (await db.query(`select count(*)::int c from notification_outbox`)).rows[0].c;
ok('no channels → nothing queued', (await outbox()) === 0);
await db.exec(`update company_settings set notify_channels='{sms,whatsapp}', notify_roles='{owner}' where id=1`);
await as(U.sup, `select public.transition_request($1,'awaiting_parts','قطعة')`, [rid]);   // owner + staff notified
ok('owner notification → 2 deliveries (sms + whatsapp)', (await outbox()) === 2);
ok('staff notifications not sent outside', (await db.query(`select count(*)::int c from notification_outbox x join notifications n on n.id=x.notification_id join profiles p on p.id=n.user_id where p.role<>'owner'`)).rows[0].c === 0);
await as(U.own1, `update profiles set notify_external=false where id=$1`, [U.own1]);
await fails('owner changes own role', as(U.own1, `update profiles set role='admin' where id=$1`, [U.own1]));
await as(U.sup, `select public.transition_request($1,'in_progress',null)`, [rid]);
ok('opted-out owner → nothing new', (await outbox()) === 2);
await as(U.own1, `update profiles set notify_external=true where id=$1`, [U.own1]);

await fails('user claims outbox', as(U.admin, `select * from public.claim_outbox(10)`));
await fails('user reads outbox', as(U.admin, `select * from notification_outbox`));
const claimed = (await asService(`select * from public.claim_outbox(10)`)).rows;
ok('service claims 2 with owner phone', claimed.length === 2 && claimed.every((c) => c.phone === '0551234567' && c.role === 'owner' && c.type === 'status_changed'));
ok('claimed rows are "sending"', (await db.query(`select count(*)::int c from notification_outbox where status='sending'`)).rows[0].c === 2);
ok('nothing left to claim', (await asService(`select * from public.claim_outbox(10)`)).rows.length === 0);
await asService(`select public.finish_outbox($1,'sent')`, [claimed[0].outbox_id]);
await asService(`select public.finish_outbox($1,'failed','timeout')`, [claimed[1].outbox_id]);
const st = (await db.query(`select status, attempts, last_error from notification_outbox order by status`)).rows;
ok('sent + failed→retry pending', st.map((r) => r.status).join() === 'pending,sent' && st[0].attempts === 1 && st[0].last_error === 'timeout');
ok('retry is claimable again', (await asService(`select * from public.claim_outbox(10)`)).rows.length === 1);

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
