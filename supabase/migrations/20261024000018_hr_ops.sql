-- =====================================================================
-- 18) HR operations
--   * approval delegation (manager away → a substitute approves their team's requests)
--   * escalation of approvals pending > 2 days (manager → their manager → HR; HR → admins)
--   * official holidays (not deducted from annual leave) + leave calendar data
--   * attendance alerts: absent without a request, repeated lateness
-- The existing functions are patched in place (pg_get_functiondef + replace) so nothing else in them changes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Delegation
-- ---------------------------------------------------------------------
create table if not exists public.approval_delegations (
  id            uuid primary key default gen_random_uuid(),
  delegator_id  uuid not null references public.employees(id) on delete cascade,
  delegate_id   uuid not null references public.employees(id) on delete cascade,
  start_date    date not null,
  end_date      date not null,
  reason        text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  cancelled_at  timestamptz,
  check (end_date >= start_date),
  check (delegator_id <> delegate_id)
);
create index if not exists approval_delegations_active_idx on public.approval_delegations (delegate_id, start_date, end_date) where cancelled_at is null;
alter table public.approval_delegations enable row level security;
drop policy if exists deleg_read on public.approval_delegations;
create policy deleg_read on public.approval_delegations for select to authenticated
  using (public.is_hr() or delegator_id = public.my_employee_id() or delegate_id = public.my_employee_id());
grant select on public.approval_delegations to authenticated;

-- employees the signed-in user may approve for today: self + anyone who delegated to them
create or replace function public.my_acting_for()
returns setof uuid language sql stable security definer set search_path = public as $$
  select public.my_employee_id()
  union
  select d.delegator_id from public.approval_delegations d
  where d.delegate_id = public.my_employee_id() and d.cancelled_at is null
    and public.today_riyadh() between d.start_date and d.end_date
$$;

create or replace function public.set_delegation(p_delegate uuid, p_start date, p_end date, p_reason text default null, p_delegator uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_from uuid := coalesce(p_delegator, public.my_employee_id()); v_id uuid;
begin
  if v_from is null then raise exception 'NO_EMPLOYEE_FILE' using errcode = 'P0001'; end if;
  if v_from <> public.my_employee_id() and not public.is_hr() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if p_delegate is null or p_delegate = v_from then raise exception 'REQUIRED' using errcode = 'P0001'; end if;
  if p_start is null or p_end is null or p_end < p_start or p_end < public.today_riyadh() then raise exception 'INVALID_DATE' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.employees where id = p_delegate and status = 'active' and profile_id is not null) then
    raise exception 'REQUIRED' using errcode = 'P0001';
  end if;
  insert into public.approval_delegations (delegator_id, delegate_id, start_date, end_date, reason, created_by)
  values (v_from, p_delegate, p_start, p_end, nullif(btrim(p_reason), ''), auth.uid()) returning id into v_id;
  perform public.notify_user((select profile_id from public.employees where id = p_delegate), 'delegation_received', null,
    jsonb_build_object('name', (select full_name from public.employees where id = v_from), 'from', p_start, 'to', p_end, 'link', '/me/approvals'));
  return v_id;
end $$;

create or replace function public.cancel_delegation(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.approval_delegations set cancelled_at = now()
  where id = p_id and cancelled_at is null and (delegator_id = public.my_employee_id() or public.is_hr());
  if not found then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
end $$;

revoke all on function public.my_acting_for(), public.set_delegation(uuid, date, date, text, uuid), public.cancel_delegation(uuid) from public, anon;
grant execute on function public.my_acting_for(), public.set_delegation(uuid, date, date, text, uuid), public.cancel_delegation(uuid) to authenticated;

-- patch existing functions: "approver = me" → "approver is me or someone I act for"
do $$
declare f text; n text;
begin
  -- decide_hr_request
  f := pg_get_functiondef('public.decide_hr_request(uuid,boolean,text)'::regprocedure);
  n := replace(f, '(s.approver_kind = ''manager'' and s.approver_employee_id = v_me)',
                  '(s.approver_kind = ''manager'' and s.approver_employee_id in (select public.my_acting_for()))');
  if n = f and position('my_acting_for' in f) = 0 then raise exception 'decide_hr_request: pattern not found'; end if;
  execute n;
  -- my_approval_queue
  f := pg_get_functiondef('public.my_approval_queue()'::regprocedure);
  n := replace(f, 's.approver_employee_id = public.my_employee_id()', 's.approver_employee_id in (select public.my_acting_for())');
  if n = f and position('my_acting_for' in f) = 0 then raise exception 'my_approval_queue: pattern not found'; end if;
  execute n;
  -- can_view_hr_request
  f := pg_get_functiondef('public.can_view_hr_request(uuid)'::regprocedure);
  n := replace(f, 's.approver_employee_id = public.my_employee_id()', 's.approver_employee_id in (select public.my_acting_for())');
  if n = f and position('my_acting_for' in f) = 0 then raise exception 'can_view_hr_request: pattern not found'; end if;
  execute n;
end $$;

-- the UI asks the database whether the decision buttons should show
create or replace function public.can_decide_hr_request(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.hr_requests r
    join public.hr_request_steps s on s.request_id = r.id and s.step = r.current_step
    where r.id = p_id and r.status = 'pending'
      and (r.employee_id is distinct from public.my_employee_id() or public.auth_role()::text = 'admin')
      and ((s.approver_kind = 'manager' and s.approver_employee_id in (select public.my_acting_for()))
        or (s.approver_kind = 'hr' and public.is_hr())
        or public.auth_role()::text = 'admin'))
$$;
grant execute on function public.can_decide_hr_request(uuid) to authenticated;

-- notify_hr_step: also tell the active delegate of a manager
create or replace function public.notify_hr_step(p_req uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record; s record; v_user uuid;
begin
  select hr.*, e.full_name into r from public.hr_requests hr join public.employees e on e.id = hr.employee_id where hr.id = p_req;
  select * into s from public.hr_request_steps where request_id = p_req and step = r.current_step;
  if s.approver_kind = 'manager' then
    for v_user in
      select e.profile_id from public.employees e where e.id = s.approver_employee_id
      union
      select e.profile_id from public.approval_delegations d join public.employees e on e.id = d.delegate_id
      where d.delegator_id = s.approver_employee_id and d.cancelled_at is null and public.today_riyadh() between d.start_date and d.end_date
    loop
      perform public.notify_user(v_user, 'hr_approval_needed', null,
        jsonb_build_object('ref_no', r.ref_no, 'name', r.full_name, 'link', '/me/requests/' || p_req));
    end loop;
  else
    for v_user in select id from public.profiles where role::text in ('admin', 'hr') and is_active loop
      perform public.notify_user(v_user, 'hr_approval_needed', null,
        jsonb_build_object('ref_no', r.ref_no, 'name', r.full_name, 'link', '/me/requests/' || p_req));
    end loop;
  end if;
end $$;
revoke execute on function public.notify_hr_step(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) Escalate approvals pending more than 2 days
-- ---------------------------------------------------------------------
alter table public.hr_request_steps add column if not exists escalated_at timestamptz;
alter table public.hr_request_steps add column if not exists escalated_from uuid references public.employees(id) on delete set null;

create or replace function public.escalate_hr_approvals()
returns jsonb language plpgsql security definer set search_path = public as $$
declare rec record; v_next uuid; v_moved int := 0; v_hr int := 0; v_user uuid;
begin
  for rec in
    select r.id, r.ref_no, r.employee_id, s.id as step_id, s.step, s.approver_kind, s.approver_employee_id, s.escalated_at,
      coalesce(s.escalated_at, (select max(p.decided_at) from public.hr_request_steps p where p.request_id = r.id and p.step < s.step), r.created_at) as since
    from public.hr_requests r
    join public.hr_request_steps s on s.request_id = r.id and s.step = r.current_step and s.decision = 'pending'
    where r.status = 'pending'
  loop
    continue when rec.since > now() - interval '48 hours';
    if rec.approver_kind = 'manager' then
      select e.manager_id into v_next from public.employees e where e.id = rec.approver_employee_id;
      if v_next is null or v_next = rec.employee_id then
        update public.hr_request_steps set approver_kind = 'hr', approver_employee_id = null,
          escalated_from = rec.approver_employee_id, escalated_at = now() where id = rec.step_id;
      else
        update public.hr_request_steps set approver_employee_id = v_next,
          escalated_from = rec.approver_employee_id, escalated_at = now() where id = rec.step_id;
      end if;
      perform public.notify_hr_step(rec.id);
      v_moved := v_moved + 1;
    elsif rec.escalated_at is null then
      -- HR step: remind the admins once
      update public.hr_request_steps set escalated_at = now() where id = rec.step_id;
      for v_user in select id from public.profiles where role = 'admin' and is_active loop
        perform public.notify_user(v_user, 'hr_approval_escalated', null,
          jsonb_build_object('ref_no', rec.ref_no, 'link', '/me/requests/' || rec.id));
      end loop;
      v_hr := v_hr + 1;
    end if;
  end loop;
  return jsonb_build_object('moved_up', v_moved, 'hr_reminded', v_hr);
end $$;
revoke all on function public.escalate_hr_approvals() from public, anon, authenticated;
grant execute on function public.escalate_hr_approvals() to service_role;

-- ---------------------------------------------------------------------
-- 3) Official holidays
-- ---------------------------------------------------------------------
create table if not exists public.public_holidays (
  id         uuid primary key default gen_random_uuid(),
  name_ar    text not null,
  name_en    text,
  start_date date not null,
  end_date   date not null,
  check (end_date >= start_date),
  unique (name_ar, start_date)
);
alter table public.public_holidays enable row level security;
drop policy if exists holidays_read on public.public_holidays;
drop policy if exists holidays_hr on public.public_holidays;
create policy holidays_read on public.public_holidays for select to authenticated using (true);
create policy holidays_hr   on public.public_holidays for all to authenticated using (public.is_hr()) with check (public.is_hr());
grant select, insert, update, delete on public.public_holidays to authenticated;

-- Saudi official holidays (Eid dates follow the moon sighting — HR adjusts them when announced)
insert into public.public_holidays (name_ar, name_en, start_date, end_date) values
  ('يوم التأسيس', 'Founding Day', '2026-02-22', '2026-02-22'),
  ('إجازة عيد الفطر', 'Eid al-Fitr', '2026-03-19', '2026-03-23'),
  ('إجازة عيد الأضحى', 'Eid al-Adha', '2026-05-25', '2026-05-29'),
  ('اليوم الوطني', 'National Day', '2026-09-23', '2026-09-23'),
  ('يوم التأسيس', 'Founding Day', '2027-02-22', '2027-02-22'),
  ('إجازة عيد الفطر', 'Eid al-Fitr', '2027-03-09', '2027-03-13'),
  ('إجازة عيد الأضحى', 'Eid al-Adha', '2027-05-15', '2027-05-19'),
  ('اليوم الوطني', 'National Day', '2027-09-23', '2027-09-23')
on conflict (name_ar, start_date) do nothing;

create or replace function public.holidays_between(p_start date, p_end date)
returns int language sql stable security definer set search_path = public as $$
  select count(distinct g)::int
  from public.public_holidays h, generate_series(greatest(h.start_date, p_start), least(h.end_date, p_end), interval '1 day') g
  where h.start_date <= p_end and h.end_date >= p_start
$$;
grant execute on function public.holidays_between(date, date) to authenticated;

-- annual-type leave (uses the balance) no longer counts official holidays
do $$
declare f text; n text;
begin
  f := pg_get_functiondef('public.submit_hr_request(jsonb)'::regprocedure);
  if position('holidays_between' in f) = 0 then
    n := regexp_replace(f,
      'v_days := v_end - v_start \+ 1;(\s+)if v_lt\.max_days',
      'v_days := v_end - v_start + 1 - case when v_lt.uses_balance then public.holidays_between(v_start, v_end) else 0 end;\1if v_days <= 0 then raise exception ''INVALID_DATE'' using errcode = ''P0001''; end if;\1if v_lt.max_days');
    if n = f then raise exception 'submit_hr_request: pattern not found'; end if;
    execute n;
  end if;
end $$;

-- leave calendar: approved + pending leave/trips visible to the caller (RLS-equivalent check)
create or replace function public.leave_calendar(p_from date, p_to date)
returns table (request_id uuid, employee_id uuid, employee_name text, department text, type text, leave_type text,
               leave_name_ar text, leave_name_en text, start_date date, end_date date, status text)
language sql stable security definer set search_path = public as $$
  select r.id, e.id, e.full_name, dp.name, r.type, r.leave_type, lt.name_ar, lt.name_en, r.start_date, r.end_date, r.status
  from public.hr_requests r
  join public.employees e on e.id = r.employee_id
  left join public.departments dp on dp.id = e.department_id
  left join public.leave_types lt on lt.code = r.leave_type
  where r.type in ('leave', 'business_trip') and r.status in ('approved', 'pending')
    and r.start_date <= p_to and r.end_date >= p_from
    and public.can_view_employee(e.id)
  order by r.start_date, e.full_name
$$;
grant execute on function public.leave_calendar(date, date) to authenticated;

-- ---------------------------------------------------------------------
-- 4) Attendance alerts
-- ---------------------------------------------------------------------
create table if not exists public.attendance_alerts (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  kind        text not null check (kind in ('absent_no_request', 'late_repeated')),
  period_key  text not null,
  detail      jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  unique (employee_id, kind, period_key)
);
alter table public.attendance_alerts enable row level security;
drop policy if exists att_alerts_read on public.attendance_alerts;
create policy att_alerts_read on public.attendance_alerts for select to authenticated using (public.can_view_employee(employee_id) and employee_id <> coalesce(public.my_employee_id(), '00000000-0000-0000-0000-000000000000'::uuid) or public.is_hr());
grant select on public.attendance_alerts to authenticated;

-- run on workdays late morning (Riyadh): absent with no leave/trip; ≥3 late arrivals (15+ min) in the last 30 days
create or replace function public.attendance_alerts_run()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_today date := public.today_riyadh(); v_now time := (now() at time zone 'Asia/Riyadh')::time;
  e record; v_abs int := 0; v_late int := 0; v_cnt int; v_mgr uuid; v_user uuid; v_week text := to_char(public.today_riyadh(), 'IYYY-IW');
begin
  -- Friday/Saturday weekend and official holidays: nothing to check
  if extract(isodow from v_today) in (5, 6) or public.holidays_between(v_today, v_today) > 0 then
    return jsonb_build_object('skipped', true);
  end if;
  for e in
    select x.* from public.employees x
    where x.status = 'active' and x.profile_id is not null and x.hire_date <= v_today
  loop
    -- absent: past start + 60 min, no check-in, no approved/pending leave, trip or presence request today
    if v_now > coalesce(e.work_start, '08:00'::time) + interval '60 minutes'
       and not exists (select 1 from public.attendance a where a.employee_id = e.id and a.work_date = v_today and a.check_in_at is not null)
       and not exists (select 1 from public.hr_requests r where r.employee_id = e.id and r.status in ('approved', 'pending')
                       and ((r.type in ('leave', 'business_trip', 'exit_reentry') and v_today between r.start_date and r.end_date)
                         or (r.type in ('presence', 'attendance_correction') and r.work_date = v_today)))
    then
      insert into public.attendance_alerts (employee_id, kind, period_key) values (e.id, 'absent_no_request', v_today::text)
      on conflict do nothing;
      if found then
        v_abs := v_abs + 1;
        for v_user in
          select m.profile_id from public.employees m where m.id = e.manager_id
          union select id from public.profiles where role::text = 'hr' and is_active
        loop
          perform public.notify_user(v_user, 'attendance_absent', null, jsonb_build_object('name', e.full_name, 'date', v_today, 'link', '/hr/attendance'));
        end loop;
      end if;
    end if;
    -- repeated lateness: once per ISO week
    select count(*) into v_cnt from public.attendance a
    where a.employee_id = e.id and a.work_date > v_today - 30 and a.check_in_at is not null
      and (a.check_in_at at time zone 'Asia/Riyadh')::time > coalesce(e.work_start, '08:00'::time) + interval '15 minutes';
    if v_cnt >= 3 then
      insert into public.attendance_alerts (employee_id, kind, period_key, detail) values (e.id, 'late_repeated', v_week, jsonb_build_object('count', v_cnt))
      on conflict do nothing;
      if found then
        v_late := v_late + 1;
        for v_user in
          select m.profile_id from public.employees m where m.id = e.manager_id
          union select id from public.profiles where role::text = 'hr' and is_active
        loop
          perform public.notify_user(v_user, 'attendance_late', null, jsonb_build_object('name', e.full_name, 'count', v_cnt, 'link', '/hr/attendance'));
        end loop;
      end if;
    end if;
  end loop;
  return jsonb_build_object('absent', v_abs, 'late', v_late);
end $$;
revoke all on function public.attendance_alerts_run() from public, anon, authenticated;
grant execute on function public.attendance_alerts_run() to service_role;

-- ---------------------------------------------------------------------
-- 5) Schedules (UTC): approvals every 2h, attendance 10:30 Riyadh Sun–Thu
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname in ('hr-approval-escalation', 'attendance-alerts');
    perform cron.schedule('hr-approval-escalation', '30 */2 * * *', 'select public.escalate_hr_approvals()');
    perform cron.schedule('attendance-alerts', '30 7 * * 0-4', 'select public.attendance_alerts_run()');
  end if;
end $$;

-- names of colleagues a manager can delegate to (names and titles only)
create or replace function public.delegation_candidates()
returns table (id uuid, full_name text, job_title text)
language sql stable security definer set search_path = public as $$
  select e.id, e.full_name, e.job_title from public.employees e
  where public.my_employee_id() is not null and e.status = 'active' and e.profile_id is not null and e.id <> public.my_employee_id()
  order by e.full_name
$$;
revoke all on function public.delegation_candidates() from public, anon;
grant execute on function public.delegation_candidates() to authenticated;
