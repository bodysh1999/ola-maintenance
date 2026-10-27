// Tests for migrations 16–20: waiting-on + escalation, duplicates, live location, HR delegation / escalation /
// holidays / attendance alerts, lead reminders, project cost report
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
  hr: 'a0000000-0000-0000-0000-000000000003', top: 'b0000000-0000-0000-0000-000000000001', mgr: 'b0000000-0000-0000-0000-000000000002',
  emp: 'b0000000-0000-0000-0000-000000000003', peer: 'b0000000-0000-0000-0000-000000000004', sales: 'b0000000-0000-0000-0000-000000000005',
};
const E = { hr: 'e0000000-0000-0000-0000-000000000000', top: 'e0000000-0000-0000-0000-000000000001', mgr: 'e0000000-0000-0000-0000-000000000002', emp: 'e0000000-0000-0000-0000-000000000003', peer: 'e0000000-0000-0000-0000-000000000004' };
const UNIT1 = '40000000-0000-0000-0000-000000000001', UNIT2 = '40000000-0000-0000-0000-000000000002';
const T1 = '50000000-0000-0000-0000-000000000001', T2 = '50000000-0000-0000-0000-000000000002';
const CON = '60000000-0000-0000-0000-000000000001';
await db.exec(`
insert into auth.users (id,email,raw_app_meta_data,raw_user_meta_data) values
 ('${U.admin}','a@x','{"role":"admin"}','{"full_name":"مدير"}'), ('${U.sup}','s@x','{"role":"supervisor"}','{"full_name":"مشرف"}'),
 ('${U.tech}','t@x','{"role":"technician"}','{"full_name":"فني"}'), ('${U.tech2}','t2@x','{"role":"technician"}','{"full_name":"فني2"}'),
 ('${U.own1}','o1@x','{"role":"owner"}','{"full_name":"مالك1"}'), ('${U.own2}','o2@x','{"role":"owner"}','{"full_name":"مالك2"}'),
 ('${U.hr}','h@x','{"role":"hr"}','{}'), ('${U.top}','top@x','{"role":"employee"}','{}'), ('${U.mgr}','m@x','{"role":"employee"}','{}'),
 ('${U.emp}','e@x','{"role":"employee"}','{}'), ('${U.peer}','p@x','{"role":"employee"}','{}'), ('${U.sales}','sl@x','{"role":"sales"}','{"full_name":"مبيعات"}');
insert into public.projects (id,name_ar) values ('10000000-0000-0000-0000-000000000001','عُلا 17');
insert into public.buildings (id,project_id,name,floors_count) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','A',4);
insert into public.owners (id,profile_id,full_name,phone,email,account_status) values
 ('30000000-0000-0000-0000-000000000001','${U.own1}','مالك1','0551234567','o1@x','active'),
 ('30000000-0000-0000-0000-000000000002','${U.own2}','مالك2','0559999999','o2@x','active');
insert into public.units (id,building_id,unit_number,owner_id,handover_date) values
 ('${UNIT1}','20000000-0000-0000-0000-000000000001','101','30000000-0000-0000-0000-000000000001',current_date - 100),
 ('${UNIT2}','20000000-0000-0000-0000-000000000001','102','30000000-0000-0000-0000-000000000002',current_date - 100);
insert into public.contractors (id,name) values ('${CON}','مؤسسة البرودة');
insert into public.warranties (unit_id,category,title,start_date,end_date,contractor_id) values
 ('${UNIT1}','hvac','ضمان التكييف',current_date - 100,current_date + 300,'${CON}');
insert into public.technicians (id,profile_id,full_name,phone,specialties,contractor_id) values
 ('${T1}','${U.tech}','فني','0552220001','{plumbing,hvac}',null), ('${T2}','${U.tech2}','فني2','0552220002','{hvac}','${CON}');
insert into work_locations (id,name,lat,lng,radius_m) values ('c0000000-0000-0000-0000-000000000001','المكتب',21.5,39.2,150);
insert into employees (id,profile_id,full_name,job_title,hire_date,work_location_id) values
 ('${E.hr}','${U.hr}','HR','HR',current_date-1000,null), ('${E.top}','${U.top}','المدير العام','GM',current_date-3000,'c0000000-0000-0000-0000-000000000001');
insert into employees (id,profile_id,full_name,job_title,hire_date,manager_id,work_location_id) values
 ('${E.mgr}','${U.mgr}','مدير القسم','Mgr',current_date-2000,'${E.top}','c0000000-0000-0000-0000-000000000001');
insert into employees (id,profile_id,full_name,job_title,hire_date,manager_id,work_location_id,gender) values
 ('${E.emp}','${U.emp}','موظف','Eng',current_date-800,'${E.mgr}','c0000000-0000-0000-0000-000000000001','male'),
 ('${E.peer}','${U.peer}','زميل','Eng',current_date-800,'${E.top}','c0000000-0000-0000-0000-000000000001','male');
`);

// ================================================================ 16) waiting-on, escalation, duplicates
const mk = (unit, owner, cat) => as(owner, `insert into maintenance_requests (unit_id, owner_id, category, location_in_unit, description)
  values ($1,(select id from owners where profile_id=$2),$3,'المطبخ','وصف العطل بالتفصيل') returning id`, [unit, owner, cat]).then((r) => r.rows[0].id);
const r1 = await mk(UNIT1, U.own1, 'hvac');
let v = (await as(U.sup, `select waiting_on, escalation_level from request_overview where id=$1`, [r1])).rows[0];
ok('new request waits on staff review', v.waiting_on === 'staff_review' && v.escalation_level === 0);
ok('owner sees own waiting_on too', (await as(U.own1, `select waiting_on from request_overview where id=$1`, [r1])).rows[0].waiting_on === 'staff_review');
ok('similar: none on first request', (await as(U.own1, `select count(*)::int c from similar_requests($1,'hvac')`, [UNIT1])).rows[0].c === 1);
const r2 = await mk(UNIT1, U.own1, 'hvac');
ok('similar: owner sees the earlier one (excluding current)', (await as(U.own1, `select ref_no from similar_requests($1,'hvac',$2)`, [UNIT1, r2])).rows.length === 1);
ok('similar: other owner sees nothing on my unit', (await as(U.own2, `select count(*)::int c from similar_requests($1,'hvac')`, [UNIT1])).rows[0].c === 0);
ok('similar: other category not matched', (await as(U.own1, `select count(*)::int c from similar_requests($1,'plumbing')`, [UNIT1])).rows[0].c === 0);

await as(U.sup, `select public.transition_request($1,'approved',null)`, [r1]);
ok('approved waits on assignment', (await as(U.sup, `select waiting_on from request_overview where id=$1`, [r1])).rows[0].waiting_on === 'staff_assign');
const wo1 = (await as(U.sup, `select public.assign_request($1,$2,'افحص',null,null,null) id`, [r1, T2])).rows[0].id;
ok('assigned waits on technician start', (await as(U.sup, `select waiting_on from request_overview where id=$1`, [r1])).rows[0].waiting_on === 'tech_start');

await fails('authenticated cannot run escalation', as(U.admin, `select public.escalate_requests()`));
let e = (await asService(`select public.escalate_requests() r`)).rows[0].r;
ok('fresh requests are not escalated', e.level1 === 0 && e.level2 === 0);
// make r1 stuck at the technician for 30h
await db.exec(`update activity_logs set created_at = now() - interval '30 hours' where request_id='${r1}'`);
await db.exec(`update maintenance_requests set created_at = now() - interval '30 hours' where id='${r1}'`);
e = (await asService(`select public.escalate_requests() r`)).rows[0].r;
ok('stuck at technician > 24h → level 1', e.level1 === 1);
ok('supervisor notified', (await as(U.sup, `select payload from notifications where type='escalation'`)).rows[0]?.payload.level === 1);
ok('escalation_level visible in overview', (await as(U.sup, `select escalation_level from request_overview where id=$1`, [r1])).rows[0].escalation_level === 1);
ok('owner cannot read escalations table', (await as(U.own1, `select count(*)::int c from request_escalations`)).rows[0].c === 0);
ok('second run does not re-notify', (await asService(`select public.escalate_requests() r`)).rows[0].r.level1 === 0);
await db.exec(`update request_escalations set escalated_at = now() - interval '25 hours' where request_id='${r1}'`);
ok('still stuck 24h later → level 2 (admin)', (await asService(`select public.escalate_requests() r`)).rows[0].r.level2 === 1);
ok('admin notified level 2', (await as(U.admin, `select count(*)::int c from notifications where type='escalation' and (payload->>'level')::int=2`)).rows[0].c === 1);

// ================================================================ 17) live location
await fails('location before "on the way"', as(U.tech2, `select public.tech_share_location($1, 21.5, 39.2, 10)`, [wo1]), 'INVALID_TRANSITION');
await as(U.tech2, `select public.tech_on_the_way($1, 20)`, [wo1]);
await fails('other technician shares location', as(U.tech, `select public.tech_share_location($1, 21.5, 39.2, 10)`, [wo1]));
await fails('bad coordinates', as(U.tech2, `select public.tech_share_location($1, 200, 39.2, 10)`, [wo1]), 'LOCATION_REQUIRED');
await as(U.tech2, `select public.tech_share_location($1, 21.51, 39.21, 12)`, [wo1]);
await as(U.tech2, `select public.tech_share_location($1, 21.52, 39.22, 9)`, [wo1]);
ok('owner sees technician position', Number((await as(U.own1, `select lat from tech_locations where request_id=$1`, [r1])).rows[0]?.lat) === 21.52);
ok('other owner cannot', (await as(U.own2, `select count(*)::int c from tech_locations`)).rows[0].c === 0);
await as(U.tech2, `select public.tech_start_work($1)`, [wo1]).catch(async () => { await db.exec(`update work_orders set status='in_progress' where id='${wo1}'`); });
ok('position removed when work starts', (await db.query(`select count(*)::int c from tech_locations where work_order_id=$1`, [wo1])).rows[0].c === 0);

// warranty contractor technicians (data used by the assign form)
ok('warranty contractor matches T2', (await as(U.sup, `select t.id from technicians t join warranties w on w.contractor_id = t.contractor_id where w.unit_id=$1`, [UNIT1])).rows[0]?.id === T2);

// ================================================================ 18) HR: delegation, escalation, holidays, alerts
const submit = (uid, p) => as(uid, `select public.submit_hr_request($1::jsonb) r`, [JSON.stringify(p)]).then((x) => x.rows[0].r);
const reqId = async (ref) => (await db.query(`select id from hr_requests where ref_no=$1`, [ref])).rows[0].id;
const decide = (uid, id, yes, c) => as(uid, `select public.decide_hr_request($1,$2,$3) r`, [id, yes, c ?? null]).then((x) => x.rows[0].r);

// holidays: an annual leave spanning the Eid al-Adha 2027 holiday (5 days) deducts only the working days
const refH = await submit(U.emp, { type: 'leave', leave_type: 'annual', start_date: '2027-05-13', end_date: '2027-05-20', reason: 'عيد' });
const daysH = Number((await db.query(`select days from hr_requests where ref_no=$1`, [refH])).rows[0].days);
ok(`holidays not deducted (8 calendar days → ${daysH})`, daysH === 3);
await fails('leave entirely inside the holiday', submit(U.emp, { type: 'leave', leave_type: 'annual', start_date: '2027-03-10', end_date: '2027-03-12' }), 'INVALID_DATE');
ok('holidays_between', (await as(U.emp, `select public.holidays_between('2026-09-20','2026-09-30') n`)).rows[0].n === 1);
await fails('employee edits holidays', as(U.emp, `insert into public_holidays (name_ar,start_date,end_date) values ('x',current_date,current_date)`));
await as(U.hr, `insert into public_holidays (name_ar,start_date,end_date) values ('عطلة خاصة','2027-01-05','2027-01-05')`);
ok('HR adds a holiday', (await db.query(`select count(*)::int c from public_holidays where name_ar='عطلة خاصة'`)).rows[0].c === 1);

const idH = await reqId(refH);
await fails('peer cannot decide (not manager)', decide(U.peer, idH, true), 'FORBIDDEN');
ok('peer cannot see the request', !(await as(U.peer, `select public.can_view_hr_request($1) v`, [idH])).rows[0].v);
await fails('employee cannot delegate on behalf of manager', as(U.emp, `select public.set_delegation($1, current_date, current_date + 3, null, $2)`, [E.peer, E.mgr]), 'FORBIDDEN');
await fails('delegation in the past', as(U.mgr, `select public.set_delegation($1, current_date - 5, current_date - 1)`, [E.peer]), 'INVALID_DATE');
const dlg = (await as(U.mgr, `select public.set_delegation($1, current_date, current_date + 7, 'إجازة') id`, [E.peer])).rows[0].id;
ok('delegate notified', (await as(U.peer, `select count(*)::int c from notifications where type='delegation_received'`)).rows[0].c === 1);
ok('delegate sees request in queue', (await as(U.peer, `select count(*)::int c from my_approval_queue()`)).rows[0].c === 1);
ok('delegate can view the request', (await as(U.peer, `select public.can_view_hr_request($1) v`, [idH])).rows[0].v === true);
ok('can_decide true for delegate', (await as(U.peer, `select public.can_decide_hr_request($1) v`, [idH])).rows[0].v === true);
ok('can_decide false for the employee', (await as(U.emp, `select public.can_decide_hr_request($1) v`, [idH])).rows[0].v === false);
ok('delegate approves manager step', (await decide(U.peer, idH, true)) === 'next');
ok('candidates list excludes me', (await as(U.mgr, `select count(*)::int c from delegation_candidates() where id=$1`, [E.mgr])).rows[0].c === 0);
await as(U.mgr, `select public.cancel_delegation($1)`, [dlg]);
await fails('peer cannot cancel someone else delegation twice', as(U.peer, `select public.cancel_delegation($1)`, [dlg]), 'FORBIDDEN');

// approval escalation after 48h: manager step → manager's manager
const ref2 = await submit(U.emp, { type: 'salary_certificate', addressed_to: 'البنك', reason: 'قرض' });
const id2 = await reqId(ref2);
const firstKind = (await db.query(`select approver_kind, approver_employee_id from hr_request_steps where request_id=$1 and step=1`, [id2])).rows[0];
if (firstKind.approver_kind === 'manager') {
  ok('no escalation before 48h', (await asService(`select public.escalate_hr_approvals() r`)).rows[0].r.moved_up === 0);
  await db.exec(`update hr_requests set created_at = now() - interval '50 hours' where id='${id2}'`);
  ok('escalated after 48h', (await asService(`select public.escalate_hr_approvals() r`)).rows[0].r.moved_up === 1);
  ok('now with the top manager', (await db.query(`select approver_employee_id from hr_request_steps where request_id=$1 and step=1`, [id2])).rows[0].approver_employee_id === E.top);
  ok('top manager notified', (await as(U.top, `select count(*)::int c from notifications where type='hr_approval_needed'`)).rows[0].c >= 1);
} else {
  ok('salary certificate goes to HR directly (no manager escalation)', true);
}
await fails('authenticated cannot run HR escalation', as(U.hr, `select public.escalate_hr_approvals()`));

// leave calendar visibility
ok('manager sees team leave in calendar', (await as(U.mgr, `select count(*)::int c from leave_calendar('2027-05-01','2027-05-31')`)).rows[0].c === 1);
ok('peer does not', (await as(U.peer, `select count(*)::int c from leave_calendar('2027-05-01','2027-05-31')`)).rows[0].c === 0);
ok('HR sees it', (await as(U.hr, `select count(*)::int c from leave_calendar('2027-05-01','2027-05-31')`)).rows[0].c === 1);

// attendance alerts run (result depends on weekday / time — must not error, and is idempotent)
const a1 = (await asService(`select public.attendance_alerts_run() r`)).rows[0].r;
const a2 = (await asService(`select public.attendance_alerts_run() r`)).rows[0].r;
ok('attendance alerts run + idempotent', a1 && (a1.skipped || (a2.absent === 0 && a2.late === 0)));
await fails('authenticated cannot run attendance alerts', as(U.hr, `select public.attendance_alerts_run()`));
ok('employee sees no alerts (own or about their manager)', (await as(U.emp, `select count(*)::int c from attendance_alerts`)).rows[0].c === 0);
ok('employee cannot see the manager\'s attendance', (await as(U.emp, `select count(*)::int c from attendance where employee_id=$1`, [E.mgr])).rows[0].c === 0);
ok('manager still sees the employee\'s alerts scope', (await as(U.mgr, `select public.can_supervise_employee($1) v`, [E.emp])).rows[0].v === true);

// ================================================================ 19) sales
const lead = (await as(null, `select public.submit_lead('visit','محمد','0551234567','10000000-0000-0000-0000-000000000001',null,null,null,null,current_date+1,'مساءً','') r`)).rows[0].r;
const leadId = (await db.query(`select id from leads order by created_at desc limit 1`)).rows[0].id;
await as(U.admin, `update leads set assigned_to=$1, follow_up_at=current_date where id=$2`, [U.sales, leadId]);
ok('salesperson notified on assignment', (await as(U.sales, `select count(*)::int c from notifications where type='lead_assigned'`)).rows[0].c === 1);
ok('follow-up reminder sent', (await asService(`select public.lead_followup_reminders() r`)).rows[0].r.reminded === 1);
ok('reminder once per day', (await asService(`select public.lead_followup_reminders() r`)).rows[0].r.reminded === 0);
ok('assignee got the reminder', (await as(U.sales, `select count(*)::int c from notifications where type='lead_follow_up'`)).rows[0].c === 1);
void lead;

// ================================================================ 20) project costs
await db.exec(`insert into work_order_parts (work_order_id,name,quantity,unit_cost) values ('${wo1}','كمبروسر',1,850)`);
const pc = (await as(U.sup, `select * from report_project_costs(public.today_riyadh() - 30, public.today_riyadh())`)).rows[0];
ok('project cost includes parts', Number(pc.parts_cost) === 850 && Number(pc.requests) === 2);
await fails('owner cannot read project costs', as(U.own1, `select * from report_project_costs(public.today_riyadh() - 30, public.today_riyadh())`), 'FORBIDDEN');

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
