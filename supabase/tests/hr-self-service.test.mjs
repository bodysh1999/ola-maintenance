// Tests for migrations 6–7: public leads/booking/applications, sales & HR access
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
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner_id text, created_at timestamptz default now());
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated; grant all on storage.objects to anon, authenticated;
`);
for (const f of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(`${dir}/${f}`, 'utf8'));
let failed = 0;
const U = { admin: 'a0000000-0000-0000-0000-000000000001', hr: 'a0000000-0000-0000-0000-000000000003', top: 'b0000000-0000-0000-0000-000000000001', mgr: 'b0000000-0000-0000-0000-000000000002', emp: 'b0000000-0000-0000-0000-000000000003', other: 'b0000000-0000-0000-0000-000000000004' };
const E = { hr: 'e0000000-0000-0000-0000-000000000000', top: 'e0000000-0000-0000-0000-000000000001', mgr: 'e0000000-0000-0000-0000-000000000002', emp: 'e0000000-0000-0000-0000-000000000003', other: 'e0000000-0000-0000-0000-000000000004' };
await db.exec(`insert into auth.users (id,email,raw_app_meta_data) values
 ('${U.admin}','a@x','{"role":"admin"}'),('${U.hr}','h@x','{"role":"hr"}'),('${U.top}','t@x','{"role":"employee"}'),
 ('${U.mgr}','m@x','{"role":"supervisor"}'),('${U.emp}','e@x','{"role":"employee"}'),('${U.other}','o@x','{"role":"technician"}');
 insert into work_locations (id,name,lat,lng,radius_m) values ('c0000000-0000-0000-0000-000000000001','المكتب الرئيسي',21.5,39.2,150);
 insert into employees (id,profile_id,full_name,job_title,hire_date,work_location_id) values
  ('${E.hr}','${U.hr}','HR','HR',current_date-1000,null),
  ('${E.top}','${U.top}','المدير العام','GM',current_date-3000,'c0000000-0000-0000-0000-000000000001');
 insert into employees (id,profile_id,full_name,job_title,hire_date,manager_id,work_location_id) values
  ('${E.mgr}','${U.mgr}','مدير الصيانة','Mgr',current_date-2000,'${E.top}','c0000000-0000-0000-0000-000000000001');
 insert into employees (id,profile_id,full_name,job_title,hire_date,manager_id,work_location_id,gender,nationality_type) values
  ('${E.emp}','${U.emp}','موظف','Eng',current_date-400,'${E.mgr}','c0000000-0000-0000-0000-000000000001','male','resident'),
  ('${E.other}','${U.other}','آخر','Tech',current_date-400,'${E.top}','c0000000-0000-0000-0000-000000000001','male','saudi');
 insert into employee_salaries (employee_id,basic,housing,transport) values ('${E.emp}',8000,2000,800),('${E.other}',6000,1500,500),('${E.hr}',9000,2000,800);`);
const as = async (uid, sql, params) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false);`);
  try { return await db.query(sql, params); } finally { await db.exec(`reset role;`); }
};
const ok = (label, cond) => { console.log(cond ? 'ok' : '!! FAIL', label); if (!cond) failed++; };
const fails = async (label, p, code) => { try { await p; console.log('!! SHOULD FAIL', label); failed++; } catch (e) { const good = !code || e.message.includes(code); console.log(good ? 'ok blocked:' : '!! WRONG ERROR', label, '-', e.message.slice(0, 60)); if (!good) failed++; } };
const submit = (uid, p) => as(uid, `select public.submit_hr_request($1::jsonb) r`, [JSON.stringify(p)]).then((x) => x.rows[0].r);
const reqId = async (ref) => (await db.query(`select id from hr_requests where ref_no=$1`, [ref])).rows[0].id;
const decide = (uid, id, yes, c) => as(uid, `select public.decide_hr_request($1,$2,$3) r`, [id, yes, c ?? null]).then((x) => x.rows[0].r);

// visibility
ok('emp sees self + managers', (await as(U.emp, `select count(*) c from employees`)).rows[0].c === 3);
ok('emp cannot see peer', (await as(U.emp, `select count(*) c from employees where id='${E.other}'`)).rows[0].c === 0);
ok('mgr sees subordinate', (await as(U.mgr, `select count(*) c from employees where id='${E.emp}'`)).rows[0].c === 1);
ok('emp reads own salary only', (await as(U.emp, `select count(*) c from employee_salaries`)).rows[0].c === 1);
ok('mgr cannot read subordinate salary', (await as(U.mgr, `select count(*) c from employee_salaries where employee_id='${E.emp}'`)).rows[0].c === 0);
ok('hr reads all salaries', (await as(U.hr, `select count(*) c from employee_salaries`)).rows[0].c === 3);
await fails('hr edits own salary', as(U.hr, `update employee_salaries set basic=99999 where employee_id='${E.hr}'`), 'FORBIDDEN');
await as(U.hr, `update employee_salaries set basic=8500 where employee_id='${E.emp}'`);
ok('hr edits emp salary', (await db.query(`select basic from employee_salaries where employee_id='${E.emp}'`)).rows[0].basic == 8500);
await fails('emp edits own salary', as(U.emp, `update employee_salaries set basic=1 where employee_id='${E.emp}' returning 1`).then((r) => { if (!r.rows.length) throw new Error('no rows'); }));
await fails('emp inserts request directly', as(U.emp, `insert into hr_requests (employee_id,type) values ('${E.emp}','leave')`));

// attendance
const near = await as(U.emp, `select public.attendance_punch('in', 21.5005, 39.2, 20) r`);
ok('check-in near office (' + near.rows[0].r.distance_m + 'm)', near.rows[0].r.distance_m < 100);
await fails('double check-in', as(U.emp, `select public.attendance_punch('in', 21.5005, 39.2, 20)`), 'ALREADY_CHECKED_IN');
await fails('check-out far away', as(U.emp, `select public.attendance_punch('out', 21.6, 39.2, 20)`), 'OUT_OF_RANGE');
await fails('low accuracy', as(U.emp, `select public.attendance_punch('out', 21.5, 39.2, 900)`), 'LOW_ACCURACY');
await as(U.emp, `select public.attendance_punch('out', 21.5001, 39.2001, 15)`);
ok('checked out', (await db.query(`select check_out_at from attendance where employee_id='${E.emp}'`)).rows[0].check_out_at != null);
await fails('other check-in far', as(U.other, `select public.attendance_punch('in', 24.7, 46.7, 10)`), 'OUT_OF_RANGE');
ok('mgr sees subordinate attendance', (await as(U.mgr, `select count(*) c from attendance`)).rows[0].c === 1);
ok('other cannot see emp attendance', (await as(U.other, `select count(*) c from attendance`)).rows[0].c === 0);

// leave balance + annual leave chain (mgr → hr)
const bal = (await as(U.emp, `select * from public.leave_balance('${E.emp}')`)).rows[0];
ok(`balance accrued ${bal.accrued} (≈23)`, Math.abs(Number(bal.accrued) - 23) < 0.2 && bal.yearly_rate === 21);
await fails('other reads emp balance', as(U.other, `select * from public.leave_balance('${E.emp}')`), 'FORBIDDEN');
await fails('too many days', submit(U.emp, { type: 'leave', leave_type: 'annual', start_date: '2026-11-01', end_date: '2026-12-15' }), 'INSUFFICIENT_BALANCE');
await fails('maternity for male', submit(U.emp, { type: 'leave', leave_type: 'maternity', start_date: '2026-11-01', end_date: '2026-11-10', attachment_path: `${E.emp}/0b6c6f9e-5d2c-4c1a-9b3a-2a1d1e0f9c11.pdf` }), 'LEAVE_NOT_ELIGIBLE');
await fails('hajj before 2 years', submit(U.emp, { type: 'leave', leave_type: 'hajj', start_date: '2027-05-20', end_date: '2027-05-30' }), 'LEAVE_SERVICE_REQUIRED');
await fails('marriage > 5 days', submit(U.emp, { type: 'leave', leave_type: 'marriage', start_date: '2026-11-01', end_date: '2026-11-10' }), 'LEAVE_MAX_EXCEEDED');
await fails('sick without report', submit(U.emp, { type: 'leave', leave_type: 'sick', start_date: '2026-10-21', end_date: '2026-10-22' }), 'ATTACHMENT_REQUIRED');
const ref1 = await submit(U.emp, { type: 'leave', leave_type: 'annual', start_date: '2026-11-01', end_date: '2026-11-05', reason: 'سفر' });
const id1 = await reqId(ref1);
ok('leave steps = manager + hr', (await db.query(`select string_agg(approver_kind, ',' order by step) k from hr_request_steps where request_id='${id1}'`)).rows[0].k === 'manager,hr');
await fails('overlap', submit(U.emp, { type: 'leave', leave_type: 'annual', start_date: '2026-11-04', end_date: '2026-11-06' }), 'OVERLAPPING_REQUEST');
ok('pending reduces available', Number((await as(U.emp, `select available from public.leave_balance('${E.emp}')`)).rows[0].available) < Number(bal.available) - 4.9);
ok('mgr notified', (await as(U.mgr, `select count(*) c from notifications where type='hr_approval_needed'`)).rows[0].c === 1);
await fails('employee approves own', decide(U.emp, id1, true), 'FORBIDDEN');
await fails('top manager acts on step 1', decide(U.top, id1, true), 'FORBIDDEN');
await fails('hr acts before manager', decide(U.hr, id1, true), 'FORBIDDEN');
ok('mgr queue has 1', (await as(U.mgr, `select public.my_pending_approvals_count() c`)).rows[0].c === 1);
ok('emp queue empty', (await as(U.emp, `select public.my_pending_approvals_count() c`)).rows[0].c === 0);
ok('mgr approves → next', (await decide(U.mgr, id1, true)) === 'next');
ok('hr notified', (await as(U.hr, `select count(*) c from notifications where type='hr_approval_needed'`)).rows[0].c === 1);
await fails('reject without note', decide(U.hr, id1, false), 'NOTE_REQUIRED');
ok('hr approves → approved', (await decide(U.hr, id1, true)) === 'approved');
ok('used = 5', Number((await as(U.emp, `select used from public.leave_balance('${E.emp}')`)).rows[0].used) === 5);
ok('emp notified approved', (await as(U.emp, `select count(*) c from notifications where type='hr_request_approved'`)).rows[0].c === 1);

// overtime: 2 managers + hr
const id2 = await reqId(await submit(U.emp, { type: 'overtime', work_date: new Date().toISOString().slice(0, 10), hours: 3, reason: 'تسليم مشروع' }));
ok('overtime steps', (await db.query(`select count(*) c from hr_request_steps where request_id='${id2}'`)).rows[0].c === 3);
await decide(U.mgr, id2, true); ok('top approves step 2', (await decide(U.top, id2, true)) === 'next');
ok('rejected with note', (await decide(U.hr, id2, false, 'تجاوز الميزانية')) === 'rejected');

// attendance correction: manager only → writes attendance
const yday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
await fails('correction needs reason', submit(U.emp, { type: 'attendance_correction', work_date: yday, time_in: '08:05', time_out: '17:00' }), 'NOTE_REQUIRED');
const id3 = await reqId(await submit(U.emp, { type: 'attendance_correction', work_date: yday, time_in: '08:05', time_out: '17:00', reason: 'نسيت البصمة' }));
ok('correction one step', (await db.query(`select count(*) c from hr_request_steps where request_id='${id3}'`)).rows[0].c === 1);
await decide(U.mgr, id3, true);
const att = (await db.query(`select source, to_char(check_in_at at time zone 'Asia/Riyadh','HH24:MI') t from attendance where employee_id='${E.emp}' and work_date='${yday}'`)).rows[0];
ok('manual attendance written 08:05', att?.source === 'manual' && att.t === '08:05');

// presence proof, salary cert (hr only), cancel, exit-reentry (resident), advance limit
const id4 = await reqId(await submit(U.other, { type: 'presence', lat: 21.7, lng: 39.1, accuracy_m: 12, reason: 'زيارة موقع مشروع' }));
await decide(U.top, id4, true);
ok('presence → check-in recorded', (await db.query(`select source from attendance where employee_id='${E.other}'`)).rows[0]?.source === 'presence');
const id5 = await reqId(await submit(U.emp, { type: 'salary_certificate', addressed_to: 'البنك الأهلي' }));
ok('certificate → hr only', (await db.query(`select string_agg(approver_kind, ',') k from hr_request_steps where request_id='${id5}'`)).rows[0].k === 'hr');
await as(U.emp, `select public.cancel_hr_request('${id5}')`);
ok('cancelled', (await db.query(`select status from hr_requests where id='${id5}'`)).rows[0].status === 'cancelled');
await fails('cancel twice', as(U.emp, `select public.cancel_hr_request('${id5}')`), 'REQUEST_NOT_ACTIVE');
await fails('advance > salary', submit(U.emp, { type: 'salary_advance', amount: 50000 }), 'INVALID_AMOUNT');
ok('exit-reentry for resident', !!(await submit(U.emp, { type: 'exit_reentry', start_date: '2026-12-20', end_date: '2027-01-05' })));
await fails('exit-reentry for saudi', submit(U.other, { type: 'exit_reentry', start_date: '2026-12-20', end_date: '2027-01-05' }), 'NOT_ELIGIBLE');
ok('trip per-diem computed', Number((await as(U.emp, `select amount from hr_requests where ref_no=$1`, [await submit(U.emp, { type: 'business_trip', start_date: '2027-02-01', end_date: '2027-02-03', destination: 'الرياض' })])).rows[0].amount) === 1500);

// request visibility
ok('other cannot see emp requests', (await as(U.other, `select count(*) c from hr_requests where employee_id='${E.emp}'`)).rows[0].c === 0);
ok('top sees requests he approved', (await as(U.top, `select count(*) c from hr_requests`)).rows[0].c >= 1);
ok('hr sees all', (await as(U.hr, `select count(*) c from hr_requests`)).rows[0].c >= 7);

// storage
await as(U.emp, `insert into storage.objects (bucket_id,name) values ('hr-docs','${E.emp}/0b6c6f9e-5d2c-4c1a-9b3a-2a1d1e0f9c11.pdf')`);
await fails('upload into someone else folder', as(U.emp, `insert into storage.objects (bucket_id,name) values ('hr-docs','${E.other}/x.pdf')`));
ok('other cannot read emp doc', (await as(U.other, `select count(*) c from storage.objects where bucket_id='hr-docs'`)).rows[0].c === 0);

// letters & verification (migration 12)
await db.exec(`insert into employee_private (employee_id, id_number) values ('${E.emp}', '2412345678') on conflict (employee_id) do update set id_number = excluded.id_number;
  update company_settings set hr_letter_signatory = 'منى الحربي' where id = 1`);
const id6 = await reqId(await submit(U.emp, { type: 'salary_certificate', addressed_to: 'البنك الأهلي' }));
ok('pending letter has no snapshot', (await db.query(`select letter_data from hr_requests where id='${id6}'`)).rows[0].letter_data === null);
await decide(U.hr, id6, true);
const snap = (await db.query(`select letter_data, verify_code from hr_requests where id='${id6}'`)).rows[0];
ok('snapshot saved on approval (net ' + snap.letter_data?.salary?.net + ')', Number(snap.letter_data?.salary?.gross) === 11300 && snap.letter_data.signatory.title === 'مدير تنمية رأس المال البشري');
ok('verify code is 32 hex', /^[0-9a-f]{32}$/.test(snap.verify_code));
await db.exec(`update employee_salaries set basic = 20000 where employee_id='${E.emp}'`);
ok('snapshot unchanged after raise', Number((await db.query(`select letter_data #>> '{salary,basic}' b from hr_requests where id='${id6}'`)).rows[0].b) === 8500);
await db.exec(`set role anon`);
const pub = (await db.query(`select public.verify_hr_document($1) v`, [snap.verify_code])).rows[0].v;
const bad1 = (await db.query(`select public.verify_hr_document('00000000000000000000000000000000') v`)).rows[0].v;
await db.exec(`reset role`);
ok('anon verifies approved letter', pub?.ref_no && pub.data.employee.full_name === 'موظف');
ok('ID masked publicly (' + pub?.data?.employee?.id_number + ')', pub?.data?.employee?.id_number === '••••••5678');
ok('wrong code → nothing', bad1 === null);
const pendingCode = (await db.query(`select verify_code from hr_requests where status='pending' limit 1`)).rows[0]?.verify_code;
await db.exec(`set role anon`);
ok('pending/other requests not verifiable', (await db.query(`select public.verify_hr_document($1) v`, [pendingCode])).rows[0].v === null);
try { await db.query(`select letter_data from hr_requests`); console.log('!! SHOULD FAIL anon reads requests'); failed++; } catch { console.log('ok blocked: anon reads hr_requests'); }
await db.exec(`reset role`);

// hardening (migration 10)
await db.exec(`set role anon`);
try { await db.query(`select public.is_admin()`); console.log('!! SHOULD FAIL anon is_admin'); failed++; } catch { console.log('ok blocked: anon calls is_admin'); }
await db.exec(`reset role`);
await fails('user calls manager_chain', as(U.emp, `select * from public.manager_chain('${E.emp}')`), 'permission denied');
await fails('user calls evaluate_warranty', as(U.emp, `select * from public.evaluate_warranty(gen_random_uuid(), 'plumbing')`), 'permission denied');
ok('user still passes RLS helpers', (await as(U.emp, `select public.my_employee_id() id`)).rows[0].id === E.emp);
console.log(failed ? `FAILED: ${failed}` : 'ALL PASSED');
process.exitCode = failed ? 1 : 0;
