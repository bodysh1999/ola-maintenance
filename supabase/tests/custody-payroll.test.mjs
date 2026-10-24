// Tests for migrations 23–24: custody (configurable approval chain, expenses, balance, settlement) and payroll
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

const U = { admin: 'a0000000-0000-0000-0000-000000000001', hr: 'a0000000-0000-0000-0000-000000000003', top: 'b0000000-0000-0000-0000-000000000001',
  mgr: 'b0000000-0000-0000-0000-000000000002', emp: 'b0000000-0000-0000-0000-000000000003', acc: 'b0000000-0000-0000-0000-000000000004', peer: 'b0000000-0000-0000-0000-000000000005' };
const E = { hr: 'e0000000-0000-0000-0000-000000000000', top: 'e0000000-0000-0000-0000-000000000001', mgr: 'e0000000-0000-0000-0000-000000000002',
  emp: 'e0000000-0000-0000-0000-000000000003', acc: 'e0000000-0000-0000-0000-000000000004', peer: 'e0000000-0000-0000-0000-000000000005' };
await db.exec(`insert into auth.users (id,email,raw_app_meta_data) values
 ('${U.admin}','a@x','{"role":"admin"}'),('${U.hr}','h@x','{"role":"hr"}'),('${U.top}','t@x','{"role":"employee"}'),
 ('${U.mgr}','m@x','{"role":"employee"}'),('${U.emp}','e@x','{"role":"employee"}'),('${U.acc}','acc@x','{"role":"employee"}'),('${U.peer}','p@x','{"role":"employee"}');
 insert into employees (id,profile_id,full_name,job_title,hire_date,nationality_type) values
  ('${E.hr}','${U.hr}','HR','HR',current_date-1000,'saudi'), ('${E.top}','${U.top}','المدير العام','GM',current_date-3000,'saudi');
 insert into employees (id,profile_id,full_name,job_title,hire_date,manager_id,nationality_type) values
  ('${E.mgr}','${U.mgr}','مدير المشاريع','Mgr',current_date-2000,'${E.top}','saudi'),
  ('${E.acc}','${U.acc}','المحاسب','Accountant',current_date-2000,'${E.top}','resident');
 insert into employees (id,profile_id,full_name,job_title,hire_date,manager_id,nationality_type,work_start) values
  ('${E.emp}','${U.emp}','مشرف موقع','Site',current_date-800,'${E.mgr}','saudi','08:00'),
  ('${E.peer}','${U.peer}','زميل','Eng',current_date-800,'${E.mgr}','resident','08:00');
 insert into employee_salaries (employee_id,basic,housing,transport,other_allowances,other_deductions) values
  ('${E.emp}',6000,1500,600,0,100), ('${E.peer}',4500,1125,450,300,0), ('${E.mgr}',12000,3000,1000,0,0);`);

// ================================================================ custody: approval chain
await fails('employee cannot change the chain', as(U.emp, `select public.set_approval_chain('custody','[{"kind":"hr"}]'::jsonb)`), 'FORBIDDEN');
await fails('bad step kind', as(U.hr, `select public.set_approval_chain('custody','[{"kind":"ceo"}]'::jsonb)`), 'REQUIRED');
await as(U.hr, `select public.set_approval_chain('custody', $1::jsonb, 20000)`,
  [JSON.stringify([{ kind: 'manager' }, { kind: 'employee', employee_id: E.acc }, { kind: 'manager2', min_amount: 10000 }, { kind: 'hr' }])]);
ok('chain saved', (await db.query(`select jsonb_array_length(steps) n, max_amount from approval_chains where type='custody'`)).rows[0].n === 4);

await fails('amount over the maximum', as(U.emp, `select public.submit_custody_request(25000, 'مشتريات')`), 'INVALID_AMOUNT');
await fails('purpose required', as(U.emp, `select public.submit_custody_request(5000, '  ')`), 'NOTE_REQUIRED');
const ref = (await one(U.emp, `select public.submit_custody_request(5000, 'مصاريف تشطيب شقة 12') r`)).r;
const rid = (await db.query(`select id from hr_requests where ref_no=$1`, [ref])).rows[0].id;
const steps = (await db.query(`select approver_kind, approver_employee_id from hr_request_steps where request_id=$1 order by step`, [rid])).rows;
ok('5000 → manager, accountant, HR (manager2 skipped below 10,000)', steps.length === 3 && steps[0].approver_employee_id === E.mgr && steps[1].approver_employee_id === E.acc && steps[2].approver_kind === 'hr');
await fails('second pending custody request', as(U.emp, `select public.submit_custody_request(1000, 'x')`), 'OVERLAPPING_REQUEST');
ok('manager notified', (await one(U.mgr, `select count(*)::int c from notifications where type='hr_approval_needed'`)).c === 1);
await fails('accountant cannot act before the manager', as(U.acc, `select public.decide_hr_request($1,true,null)`, [rid]), 'FORBIDDEN');
await as(U.mgr, `select public.decide_hr_request($1,true,null)`, [rid]);
ok('accountant now sees it in the queue', (await one(U.acc, `select count(*)::int c from my_approval_queue()`)).c === 1);
await as(U.acc, `select public.decide_hr_request($1,true,null)`, [rid]);
ok('no custody before final approval', (await db.query(`select count(*)::int c from custodies`)).rows[0].c === 0);
await as(U.hr, `select public.decide_hr_request($1,true,null)`, [rid]);
const cust = (await db.query(`select * from custodies where request_id=$1`, [rid])).rows[0];
ok('custody opened on approval with 5000', cust && Number(cust.amount) === 5000 && cust.status === 'active');

// a larger request includes the manager's manager
await db.exec(`update custodies set status='closed' where id='${cust.id}'`); // temporarily, to submit another
const ref2 = (await one(U.peer, `select public.submit_custody_request(15000, 'معدات') r`)).r;
const st2 = (await db.query(`select approver_employee_id, approver_kind from hr_request_steps s join hr_requests r on r.id=s.request_id where r.ref_no=$1 order by step`, [ref2])).rows;
ok('15,000 → manager, accountant, manager2 (GM), HR', st2.length === 4 && st2[2].approver_employee_id === E.top);
await db.exec(`update custodies set status='active' where id='${cust.id}'`);

// ================================================================ custody: expenses + balance
const P = (n) => `${E.emp}/0b6c6f9e-5d2c-4c1a-9b3a-2a1d1e0f9c1${n}.pdf`;
await fails('invoice needs a file', as(U.emp, `select public.add_custody_expense($1,'invoice','materials',2000,public.today_riyadh())`, [cust.id]), 'ATTACHMENT_REQUIRED');
await fails('wages without invoice need a description', as(U.emp, `select public.add_custody_expense($1,'no_invoice','labor',300,public.today_riyadh())`, [cust.id]), 'NOTE_REQUIRED');
await fails('file in another employee folder', as(U.emp, `select public.add_custody_expense($1,'invoice','materials',100,public.today_riyadh(),null,null,null,$2)`, [cust.id, `${E.peer}/0b6c6f9e-5d2c-4c1a-9b3a-2a1d1e0f9c11.pdf`]), 'INVALID_FILE');
await fails('another employee adds to my custody', as(U.peer, `select public.add_custody_expense($1,'no_invoice','labor',300,public.today_riyadh(),'x')`, [cust.id]), 'FORBIDDEN');
await fails('future date', as(U.emp, `select public.add_custody_expense($1,'no_invoice','cleaning',300,public.today_riyadh()+1,'تنظيف')`, [cust.id]), 'INVALID_DATE');
await as(U.emp, `select public.add_custody_expense($1,'invoice','materials',2000,public.today_riyadh(),'بلاط وسيراميك','مؤسسة البناء','INV-1',$2)`, [cust.id, P(1)]);
const x2 = (await one(U.emp, `select public.add_custody_expense($1,'invoice','materials',1000,public.today_riyadh(),'دهانات','محل الدهان','INV-2',$2) id`, [cust.id, P(2)])).id;
await as(U.emp, `select public.add_custody_expense($1,'no_invoice','cleaning',400,public.today_riyadh(),'تنظيف شقة بعد التشطيب')`, [cust.id]);
let sum = await one(U.emp, `select remaining, spent_pending, pending_count from custody_summary where id=$1`, [cust.id]);
ok('remaining = 5000 − 3400 = 1600', Number(sum.remaining) === 1600 && Number(sum.pending_count) === 3);
await fails('expense over the remaining balance', as(U.emp, `select public.add_custody_expense($1,'no_invoice','labor',2000,public.today_riyadh(),'أجور')`, [cust.id]), 'EXCEEDS_CUSTODY');
ok('manager sees the custody', (await one(U.mgr, `select count(*)::int c from custody_summary`)).c >= 1);
ok('peer cannot see it', (await one(U.peer, `select count(*)::int c from custody_summary where id=$1`, [cust.id])).c === 0);
ok('manager can read the invoice file', (await db.exec(`insert into storage.objects (bucket_id,name) values ('hr-docs','${P(1)}')`), (await one(U.mgr, `select count(*)::int c from storage.objects where name=$1`, [P(1)])).c === 1));

await fails('employee reviews own expense', as(U.emp, `select public.review_custody_expense($1,true)`, [x2]), 'FORBIDDEN');
await fails('reject without reason', as(U.hr, `select public.review_custody_expense($1,false,null)`, [x2]), 'NOTE_REQUIRED');
await as(U.hr, `select public.review_custody_expense($1,false,'الفاتورة غير واضحة')`, [x2]);
ok('employee notified of rejection', (await one(U.emp, `select count(*)::int c from notifications where type='custody_expense_rejected'`)).c === 1);
sum = await one(U.emp, `select remaining from custody_summary where id=$1`, [cust.id]);
ok('rejected expense returns to the balance (2600)', Number(sum.remaining) === 2600);
await fails('close with pending expenses', as(U.hr, `select public.close_custody($1)`, [cust.id]), 'PENDING_EXPENSES');
for (const r of (await db.query(`select id from custody_expenses where custody_id=$1 and status='pending'`, [cust.id])).rows) await as(U.hr, `select public.review_custody_expense($1,true)`, [r.id]);
await as(U.emp, `select public.request_custody_settlement($1)`, [cust.id]);
ok('HR notified to settle', (await one(U.hr, `select count(*)::int c from notifications where type='custody_settlement'`)).c === 1);
await fails('no new expenses after settlement request', as(U.emp, `select public.add_custody_expense($1,'no_invoice','labor',10,public.today_riyadh(),'x')`, [cust.id]), 'CUSTODY_NOT_ACTIVE');
await as(U.hr, `select public.close_custody($1, null, 'استلام المتبقي نقدًا')`, [cust.id]);
const closed = (await db.query(`select status, returned_amount from custodies where id=$1`, [cust.id])).rows[0];
ok('closed with remaining 2600 returned', closed.status === 'closed' && Number(closed.returned_amount) === 2600);

// ================================================================ payroll
const month = (await db.query(`select to_char(public.today_riyadh(), 'YYYY-MM') m, extract(isodow from public.today_riyadh())::int dow, public.holidays_between(public.today_riyadh(), public.today_riyadh()) hol`)).rows[0];
// attendance: emp present on every working day so far except the most recent one, late 40 min once; peer has no attendance
await db.exec(`
insert into attendance (employee_id, work_date, check_in_at, check_out_at, source)
select '${E.emp}', g::date, (g::date + time '07:58') at time zone 'Asia/Riyadh', (g::date + time '16:00') at time zone 'Asia/Riyadh', 'manual'
from generate_series(date_trunc('month', public.today_riyadh())::date, public.today_riyadh() - 1, interval '1 day') g
where extract(isodow from g) not in (5,6);
update attendance set check_in_at = (work_date + time '08:40') at time zone 'Asia/Riyadh'
where employee_id='${E.emp}' and work_date = (select min(work_date) from attendance where employee_id='${E.emp}');`);
await db.exec(`insert into hr_requests (employee_id,type,status,work_date,hours) values ('${E.emp}','overtime','approved',public.today_riyadh(),4)`);
await db.exec(`insert into hr_requests (employee_id,type,status,start_date,end_date,days,amount,destination) values ('${E.emp}','business_trip','approved',date_trunc('month', public.today_riyadh())::date,date_trunc('month', public.today_riyadh())::date+1,2,1000,'جدة')`);
await db.exec(`insert into hr_requests (employee_id,type,status,amount,decided_at) values ('${E.emp}','salary_advance','approved',1500,now())`);

await fails('employee cannot generate payroll', as(U.emp, `select public.generate_payroll($1)`, [month.m]), 'FORBIDDEN');
await as(U.hr, `select public.add_payroll_adjustment($1,$2,'bonus',750,'مكافأة إنجاز مشروع')`, [month.m, E.emp]);
await as(U.hr, `select public.add_payroll_adjustment($1,$2,'deduction',200,'مخالفة')`, [month.m, E.peer]);
const run = (await one(U.hr, `select public.generate_payroll($1, true) id`, [month.m])).id;
const L = async (emp) => (await db.query(`select * from payroll_lines where run_id=$1 and employee_id=$2`, [run, emp])).rows[0];
let le = await L(E.emp);
const daily = (6000 + 1500 + 600) / 30;
ok('lines for the 3 salaried employees', (await db.query(`select count(*)::int c from payroll_lines where run_id=$1`, [run])).rows[0].c === 3);
ok('overtime 4h at Art.107 rate', Math.abs(Number(le.overtime_amount) - Math.round(4 * (daily / 8 + 0.5 * 6000 / 30 / 8) * 100) / 100) < 0.02);
ok('trip allowance 1000', Number(le.trip_amount) === 1000);
ok('bonus 750', Number(le.bonus_amount) === 750);
ok('advance 1500 deducted', Number(le.advance_deduction) === 1500);
ok('GOSI 9.75% of basic+housing', Number(le.gosi_amount) === Math.round(7500 * 9.75) / 100);
ok('fixed deduction 100', Number(le.fixed_deductions) === 100);
ok(`late 40 min counted (${le.late_minutes})`, le.late_minutes === 40 && Number(le.late_deduction) > 0);
const isWorkday = ![5, 6].includes(month.dow) && month.hol === 0;
ok(`present every past working day → no absence; today is not judged yet (${le.absence_days})`, le.absence_days === 0); void isWorkday;
ok('net = gross − deductions', Math.abs(Number(le.net) - (Number(le.gross) - Number(le.total_deductions))) < 0.01);
const lp = await L(E.peer);
ok('peer: absences counted, deduction 200, resident GOSI 0', lp.absence_days === lp.workdays && Number(lp.other_deductions) === 200 && Number(lp.gosi_amount) === 0);

await as(U.hr, `select public.update_payroll_line($1, -250, 'تسوية سلفة سابقة')`, [le.id]);
le = await L(E.emp);
ok('manual −250 increases deductions', Number(le.manual_adjustment) === -250 && Math.abs(Number(le.net) - (Number(le.gross) - Number(le.total_deductions))) < 0.01);
await as(U.hr, `select public.generate_payroll($1, false)`, [month.m]);
le = await L(E.emp);
ok('regenerate keeps manual adjustment + note; absence off', Number(le.manual_adjustment) === -250 && le.note === 'تسوية سلفة سابقة' && le.absence_days === 0);

ok('employee cannot see draft payslip', (await one(U.emp, `select count(*)::int c from payroll_lines`)).c === 0);
await fails('HR cannot approve (admin only)', as(U.hr, `select public.set_payroll_status($1,'approved')`, [run]), 'FORBIDDEN');
await as(U.admin, `select public.set_payroll_status($1,'approved')`, [run]);
await fails('locked after approval', as(U.hr, `select public.generate_payroll($1)`, [month.m]), 'PAYROLL_LOCKED');
await fails('line edit after approval', as(U.hr, `select public.update_payroll_line($1, 0, null)`, [le.id]), 'PAYROLL_LOCKED');
await fails('adjustment after approval', as(U.hr, `select public.add_payroll_adjustment($1,$2,'bonus',1,'x')`, [month.m, E.emp]), 'PAYROLL_LOCKED');
ok('employee sees own payslip only', (await one(U.emp, `select count(*)::int c from payroll_lines`)).c === 1);
ok('manager cannot see subordinate payslip', (await one(U.mgr, `select count(*)::int c from payroll_lines where employee_id=$1`, [E.emp])).c === 0);
ok('employee sees the run header', (await one(U.emp, `select count(*)::int c from payroll_runs`)).c === 1);
await as(U.hr, `select public.set_payroll_status($1,'paid')`, [run]);
ok('employees notified payslip ready', (await one(U.emp, `select count(*)::int c from notifications where type='payslip_ready'`)).c === 1);
ok('bank sheet for HR', (await as(U.hr, `select * from payroll_bank_sheet($1)`, [run])).rows.length === 3);
ok('bank sheet empty for employee', (await as(U.emp, `select * from payroll_bank_sheet($1)`, [run])).rows.length === 0);

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
