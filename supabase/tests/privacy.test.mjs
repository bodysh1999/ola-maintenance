// Tests for migration 15: consents, data-subject requests, visitor erasure, audit log, retention, privacy settings
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
const one = async (sql, p) => (await db.query(sql, p)).rows[0];

const U = { admin: '00000000-0000-0000-0000-00000000000a', hr: '00000000-0000-0000-0000-00000000000b', own: '00000000-0000-0000-0000-00000000000d', emp: '00000000-0000-0000-0000-00000000000e', own2: '00000000-0000-0000-0000-00000000000f' };
await db.exec(`
insert into auth.users (id,email,raw_app_meta_data,raw_user_meta_data) values
 ('${U.admin}','a@x','{"role":"admin"}','{"full_name":"مدير"}'), ('${U.hr}','h@x','{"role":"hr"}','{"full_name":"موارد"}'),
 ('${U.own}','o@x','{"role":"owner"}','{"full_name":"مالك"}'), ('${U.own2}','o2@x','{"role":"owner"}','{"full_name":"مالك2"}'),
 ('${U.emp}','e@x','{"role":"employee"}','{"full_name":"موظف"}');
insert into employees (id, profile_id, full_name, job_title, hire_date) values
 ('e0000000-0000-0000-0000-000000000001','${U.emp}','موظف','مهندس',current_date-300),
 ('e0000000-0000-0000-0000-000000000002','${U.hr}','موارد','HR',current_date-900);
insert into employee_salaries (employee_id, basic, housing, transport) values ('e0000000-0000-0000-0000-000000000001', 8000, 2000, 800);
`);

// ---------------------------------------------------------------- consent gate
ok('new user has not accepted', !(await one(`select privacy_accepted_version v from profiles where id=$1`, [U.own])).v);
await as(U.own, `select public.accept_privacy(false, true)`);
ok('accepted version stored', (await one(`select privacy_accepted_version v from profiles where id=$1`, [U.own])).v === '1.0');
ok('4 consent rows', (await as(U.own, `select count(*)::int c from consents`)).rows[0].c === 4);
await fails('invalid purpose', as(U.own, `select public.set_my_consent('privacy_policy', false)`), 'INVALID_PURPOSE');
await as(U.own, `select public.set_my_consent('whatsapp_updates', false)`);
ok('withdraw whatsapp → notify_external off', (await one(`select notify_external n from profiles where id=$1`, [U.own])).n === false);
const cur = Object.fromEntries((await as(U.own, `select purpose, granted from my_consents`)).rows.map((r) => [r.purpose, r.granted]));
ok('current state: whatsapp withdrawn, marketing off, policy on', cur.whatsapp_updates === false && cur.marketing === false && cur.privacy_policy === true);
ok('other owner sees no consents of owner', (await as(U.own2, `select count(*)::int c from consents`)).rows[0].c === 0);
ok('admin sees all consents', (await as(U.admin, `select count(*)::int c from consents`)).rows[0].c >= 5);
await fails('user inserts consent directly', as(U.own, `insert into consents (profile_id,purpose,granted,policy_version) values ($1,'marketing',true,'1.0')`, [U.own]));
await fails('anon reads consents', as(null, `select * from consents`));

// ---------------------------------------------------------------- visitor form consent
const ref = (await as(null, `select public.submit_lead('inquiry','زائر','0551112233',null,null,null,'v@x.com') r`)).rows[0].r;
await as(null, `select public.log_form_consent($1, array['privacy_policy','service_request','marketing','admin_hack'])`, [ref]);
const fc = (await db.query(`select purpose from consents where subject_ref=$1 order by purpose`, [ref])).rows.map((r) => r.purpose).join();
ok('visitor consent logged (unknown purpose ignored)', fc === 'marketing,privacy_policy,service_request');
await as(null, `select public.log_form_consent($1, array['privacy_policy'])`, [ref]);
ok('second call does not duplicate', (await one(`select count(*)::int c from consents where subject_ref=$1`, [ref])).c === 3);
await db.exec(`update leads set created_at = now() - interval '1 hour' where ref_no='${ref}'`);
await fails('stale reference refused', as(null, `select public.log_form_consent($1, array['privacy_policy'])`, ['LD-00-99999']), 'NOT_FOUND');

// ---------------------------------------------------------------- data-subject requests
await fails('deletion without details', as(U.own, `select public.submit_data_request('deletion', ' ')`), 'NOTE_REQUIRED');
const dr = (await as(U.own, `select public.submit_data_request('deletion', 'احذفوا رقم جوالي القديم') r`)).rows[0].r;
ok('request ref', /^DR-/.test(dr));
ok('admin notified', (await as(U.admin, `select count(*)::int c from notifications where type='data_request_new'`)).rows[0].c === 1);
ok('hr not notified', (await as(U.hr, `select count(*)::int c from notifications where type='data_request_new'`)).rows[0].c === 0);
await as(U.own, `select public.submit_data_request('access')`);
ok('access request auto-completed', (await as(U.own, `select status from data_requests where type='access'`)).rows[0].status === 'completed');
ok('due in 30 days', (await one(`select (due_at::date - created_at::date) d from data_requests where ref_no=$1`, [dr])).d === 30);
ok('owner2 cannot see owner requests', (await as(U.own2, `select count(*)::int c from data_requests`)).rows[0].c === 0);
const drId = (await one(`select id from data_requests where ref_no=$1`, [dr])).id;
await fails('hr handles request', as(U.hr, `select public.handle_data_request($1,'completed','تم')`, [drId]), 'FORBIDDEN');
await fails('complete without response', as(U.admin, `select public.handle_data_request($1,'completed',null)`, [drId]), 'NOTE_REQUIRED');
await as(U.admin, `select public.handle_data_request($1,'completed','تم حذف الرقم القديم')`, [drId]);
ok('completed + owner notified', (await as(U.own, `select count(*)::int c from notifications where type='data_request_done'`)).rows[0].c === 1);
for (let i = 0; i < 3; i++) await as(U.own, `select public.submit_data_request('other', 'x')`);
await fails('rate limited after 5/day', as(U.own, `select public.submit_data_request('other', 'x')`), 'RATE_LIMITED');
await fails('user updates request directly', as(U.own, `update data_requests set status='completed' returning 1`).then((r) => { if (!r.rows.length) throw new Error('none'); }));

// ---------------------------------------------------------------- erase visitor
await as(null, `select public.submit_application('job','متقدم','0559998877','apply@x.com',null,null,null,null,null,null,null,'applications/11111111-2222-3333-4444-555555555555.pdf')`);
await fails('hr erases visitor', as(U.hr, `select public.erase_public_subject('apply@x.com', null)`), 'FORBIDDEN');
const er = (await as(U.admin, `select public.erase_public_subject('APPLY@x.com', null) r`)).rows[0].r;
ok('application erased, CV path returned', er.applications === 1 && er.cv_paths[0] === 'applications/11111111-2222-3333-4444-555555555555.pdf');
const er2 = (await as(U.admin, `select public.erase_public_subject(null, '0551112233') r`)).rows[0].r;
ok('lead erased by phone, consent contact removed', er2.leads === 1 && !(await one(`select subject_phone p from consents where subject_ref=$1 limit 1`, [ref])).p);
ok('erasure audited', (await one(`select count(*)::int c from audit_log where table_name='public_subject' and action='ERASE'`)).c === 2);

// ---------------------------------------------------------------- audit log
await as(U.hr, `update employee_salaries set basic = 8500 where employee_id='e0000000-0000-0000-0000-000000000001'`);
const a1 = await one(`select actor, actor_role, changed, old_values, new_values from audit_log where table_name='employee_salaries' and action='UPDATE' order by id desc limit 1`);
ok('salary change audited with old/new', a1.actor === U.hr && a1.actor_role === 'hr' && a1.changed.join() === 'basic' && a1.old_values.basic == 8000 && a1.new_values.basic == 8500);
await as(U.hr, `insert into employee_private (employee_id, id_number, iban) values ('e0000000-0000-0000-0000-000000000001','1010101010','SA00')`);
const a2 = await one(`select old_values, new_values from audit_log where table_name='employee_private' order by id desc limit 1`);
ok('ID/bank values never stored in audit', a2.old_values === null && a2.new_values === null);
await db.exec(`update units set area_sqm = area_sqm`); // no-op updates are not logged
ok('hr cannot read audit', (await as(U.hr, `select count(*)::int c from audit_log`)).rows[0].c === 0);
ok('admin reads audit', (await as(U.admin, `select count(*)::int c from audit_log`)).rows[0].c > 0);
await fails('admin cannot alter audit', as(U.admin, `delete from audit_log returning 1`).then((r) => { if (!r.rows.length) throw new Error('none'); }));

// ---------------------------------------------------------------- retention
await db.exec(`
insert into job_applications (kind, full_name, phone, email, cv_path, status, created_at) values
 ('job','قديم','0500000001','old@x','applications/old.pdf','rejected', now() - interval '30 months'),
 ('job','موظف سابق','0500000002','hired@x',null,'hired', now() - interval '30 months'),
 ('job','حديث','0500000003','new@x',null,'new', now() - interval '2 months');`);
await fails('user runs purge', as(U.admin, `select public.purge_expired_data()`));
const pr = (await asService(`select public.purge_expired_data() r`)).rows[0].r;
ok('old application purged, CV returned', pr.applications === 1 && pr.cv_paths.includes('applications/old.pdf'));
ok('hired + recent kept', (await one(`select count(*)::int c from job_applications where email in ('hired@x','new@x')`)).c === 2);

// ---------------------------------------------------------------- settings / policy version
await fails('hr changes privacy settings', as(U.hr, `select public.update_privacy_settings('x','x@x','r',24,24,365,false,false)`), 'FORBIDDEN');
await as(U.admin, `select public.update_privacy_settings('مسؤول البيانات','dpo@ola.sa','Supabase — Frankfurt',12,18,180,true,true)`);
const st = await one(`select privacy_version, dpo_email, retention_cv_months, require_staff_mfa from company_settings where id=1`);
ok('settings saved + version bumped to 2.0', st.privacy_version === '2.0' && st.dpo_email === 'dpo@ola.sa' && st.retention_cv_months === 12 && st.require_staff_mfa === true);
ok('owner must accept again', (await one(`select privacy_accepted_version v from profiles where id=$1`, [U.own])).v !== st.privacy_version);
ok('settings change audited', (await one(`select count(*)::int c from audit_log where table_name='company_settings'`)).c >= 1);

// ---------------------------------------------------------------- MFA enforced on the data (policy now requires it for admin/HR)
const asAal = async (uid, aal, sql) => {
  await db.exec(`select set_config('request.jwt.claims', '{"aal":"${aal}"}', false)`);
  try { return await as(uid, sql); } finally { await db.exec(`select set_config('request.jwt.claims', '', false)`); }
};
ok('admin with password only → no admin rights', (await asAal(U.admin, 'aal1', `select public.is_admin() a`)).rows[0].a === false);
ok('admin password only cannot read consents', (await asAal(U.admin, 'aal1', `select count(*)::int c from consents`)).rows[0].c === 0);
ok('admin after second factor → admin', (await asAal(U.admin, 'aal2', `select public.is_admin() a`)).rows[0].a === true);
ok('hr password only → not hr', (await asAal(U.hr, 'aal1', `select public.is_hr() h`)).rows[0].h === false);
ok('employee unaffected by the staff policy', (await asAal(U.emp, 'aal1', `select public.auth_role()::text r`)).rows[0].r === 'employee');
await fails('anon cannot call has_verified_mfa', as(null, `select public.has_verified_mfa('${U.admin}')`));

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
