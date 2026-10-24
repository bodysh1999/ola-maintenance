-- =====================================================================
-- 24) Payroll (مسيرات الرواتب)
--   generate_payroll('YYYY-MM') builds one line per employee from:
--     salary (basic, housing, transport, other allowances, fixed deductions) — prorated for joiners in the month
--     attendance: absence on working days (Sun–Thu, not an official holiday, no approved leave/trip) and late minutes
--     approved requests: overtime (Art. 107 rate), business-trip allowance, unpaid leave, salary advance
--     GOSI employee share, HR adjustments (bonus / allowance / deduction), a manual adjustment per line
--   HR prepares (draft, can regenerate), the admin approves (locks), then it is marked paid; employees see payslips.
-- =====================================================================
alter table public.company_settings
  add column if not exists payroll_absence_deduct  boolean not null default true,
  add column if not exists payroll_late_deduct     boolean not null default true,
  add column if not exists payroll_late_grace_min  int not null default 15,
  add column if not exists payroll_day_hours       numeric(4,2) not null default 8;

create table if not exists public.payroll_runs (
  id              uuid primary key default gen_random_uuid(),
  period          text not null unique check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  period_start    date not null,
  period_end      date not null,
  status          text not null default 'draft' check (status in ('draft', 'approved', 'paid')),
  include_absence boolean not null default true,
  notes           text,
  generated_at    timestamptz,
  generated_by    uuid references public.profiles(id) on delete set null,
  approved_at     timestamptz,
  approved_by     uuid references public.profiles(id) on delete set null,
  paid_at         timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists public.payroll_lines (
  id                    uuid primary key default gen_random_uuid(),
  run_id                uuid not null references public.payroll_runs(id) on delete cascade,
  employee_id           uuid not null references public.employees(id) on delete cascade,
  emp_no                text, full_name text not null, job_title text, department text, nationality_type text,
  payable_days          int not null default 30,
  basic                 numeric(12,2) not null default 0,
  housing               numeric(12,2) not null default 0,
  transport             numeric(12,2) not null default 0,
  other_allowances      numeric(12,2) not null default 0,
  overtime_hours        numeric(6,2) not null default 0,
  overtime_amount       numeric(12,2) not null default 0,
  trip_days             numeric(6,2) not null default 0,
  trip_amount           numeric(12,2) not null default 0,
  bonus_amount          numeric(12,2) not null default 0,
  workdays              int not null default 0,
  absence_days          int not null default 0,
  absence_deduction     numeric(12,2) not null default 0,
  late_minutes          int not null default 0,
  late_deduction        numeric(12,2) not null default 0,
  unpaid_leave_days     numeric(6,2) not null default 0,
  unpaid_leave_deduction numeric(12,2) not null default 0,
  advance_deduction     numeric(12,2) not null default 0,
  gosi_rate             numeric(5,2) not null default 0,
  gosi_amount           numeric(12,2) not null default 0,
  fixed_deductions      numeric(12,2) not null default 0,
  other_deductions      numeric(12,2) not null default 0,
  manual_adjustment     numeric(12,2) not null default 0,
  gross                 numeric(12,2) not null default 0,
  total_deductions      numeric(12,2) not null default 0,
  net                   numeric(12,2) not null default 0,
  note                  text,
  details               jsonb not null default '{}',
  unique (run_id, employee_id)
);
create index if not exists payroll_lines_emp_idx on public.payroll_lines (employee_id);

create table if not exists public.payroll_adjustments (
  id          uuid primary key default gen_random_uuid(),
  period      text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  employee_id uuid not null references public.employees(id) on delete cascade,
  kind        text not null check (kind in ('bonus', 'allowance', 'deduction')),
  amount      numeric(12,2) not null check (amount > 0),
  reason      text not null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists payroll_adjustments_period_idx on public.payroll_adjustments (period, employee_id);

alter table public.payroll_runs enable row level security;
alter table public.payroll_lines enable row level security;
alter table public.payroll_adjustments enable row level security;
drop policy if exists payroll_runs_read on public.payroll_runs;
drop policy if exists payroll_lines_read on public.payroll_lines;
drop policy if exists payroll_adj_read on public.payroll_adjustments;
create policy payroll_runs_read on public.payroll_runs for select to authenticated
  using (public.is_hr() or (status in ('approved', 'paid') and exists (select 1 from public.payroll_lines l where l.run_id = payroll_runs.id and l.employee_id = public.my_employee_id())));
-- payslip: the employee sees their own line once the run is approved; HR sees everything
-- (definer helper avoids runs ↔ lines policy recursion)
create or replace function public._payroll_released(p_run uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.payroll_runs r where r.id = p_run and r.status in ('approved', 'paid'))
$$;
create policy payroll_lines_read on public.payroll_lines for select to authenticated
  using (public.is_hr() or (employee_id = public.my_employee_id() and public._payroll_released(run_id)));
create policy payroll_adj_read on public.payroll_adjustments for select to authenticated using (public.is_hr());
grant select on public.payroll_runs, public.payroll_lines, public.payroll_adjustments to authenticated;

-- ---------------------------------------------------------------------
-- line totals
-- ---------------------------------------------------------------------
create or replace function public._payroll_totals(l public.payroll_lines)
returns public.payroll_lines language plpgsql immutable as $$
begin
  l.gross := round(l.basic + l.housing + l.transport + l.other_allowances + l.overtime_amount + l.trip_amount + l.bonus_amount
             + greatest(l.manual_adjustment, 0), 2);
  l.total_deductions := round(l.absence_deduction + l.late_deduction + l.unpaid_leave_deduction + l.advance_deduction + l.gosi_amount
             + l.fixed_deductions + l.other_deductions + greatest(-l.manual_adjustment, 0), 2);
  l.net := round(l.gross - l.total_deductions, 2);
  return l;
end $$;

-- ---------------------------------------------------------------------
-- generate (or regenerate a draft)
-- ---------------------------------------------------------------------
create or replace function public.generate_payroll(p_period text, p_include_absence boolean default true)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_start date; v_end date; v_run uuid; v_status text; v_today date := public.today_riyadh(); v_until date;
  s record; e record; sal record; l public.payroll_lines; v_prev record;
  v_dim int; v_from date; v_daily numeric; v_minute numeric; v_hourly_ot numeric; v_factor numeric; v_rate numeric;
  v_absent int; v_work int; v_late int; v_unpaid numeric; v_ot numeric; v_trip_days numeric; v_trip numeric; v_adv numeric;
  v_bonus numeric; v_allow numeric; v_ded numeric;
begin
  if not public.is_hr() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if p_period !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_DATE' using errcode = 'P0001'; end if;
  v_start := (p_period || '-01')::date;
  v_end := (v_start + interval '1 month' - interval '1 day')::date;
  if v_start > v_today then raise exception 'INVALID_DATE' using errcode = 'P0001'; end if;
  v_until := least(v_end, v_today);   -- attendance is only judged up to today
  v_dim := v_end - v_start + 1;
  select * into s from public.company_settings where id = 1;

  select id, status into v_run, v_status from public.payroll_runs where period = p_period;
  if v_status in ('approved', 'paid') then raise exception 'PAYROLL_LOCKED' using errcode = 'P0001'; end if;
  if v_run is null then
    insert into public.payroll_runs (period, period_start, period_end) values (p_period, v_start, v_end) returning id into v_run;
  end if;
  update public.payroll_runs set include_absence = coalesce(p_include_absence, true), generated_at = now(), generated_by = auth.uid() where id = v_run;

  -- keep manual adjustments / notes across regeneration
  create temp table if not exists _keep (employee_id uuid primary key, manual_adjustment numeric, note text) on commit drop;
  delete from _keep;
  insert into _keep select employee_id, manual_adjustment, note from public.payroll_lines where run_id = v_run;
  delete from public.payroll_lines where run_id = v_run;

  for e in
    select x.*, dp.name as dept from public.employees x left join public.departments dp on dp.id = x.department_id
    where x.status = 'active' and x.hire_date <= v_end
  loop
    select * into sal from public.employee_salaries where employee_id = e.id;
    continue when sal.employee_id is null;
    v_from := greatest(v_start, e.hire_date);
    v_factor := least(1, (v_end - v_from + 1)::numeric / v_dim);
    v_daily := (sal.basic + sal.housing + sal.transport + sal.other_allowances) / 30.0;
    v_minute := v_daily / (s.payroll_day_hours * 60);
    v_hourly_ot := v_daily / s.payroll_day_hours + 0.5 * (sal.basic / 30.0 / s.payroll_day_hours);
    v_rate := coalesce(sal.gosi_rate, case when e.nationality_type = 'saudi' then s.gosi_saudi_rate else s.gosi_resident_rate end, 0);

    -- working days & absence (Sun–Thu, not a holiday, from joining date up to today)
    select count(*) filter (where true),
           count(*) filter (where not exists (select 1 from public.attendance a where a.employee_id = e.id and a.work_date = g::date and a.check_in_at is not null)
                             and not exists (select 1 from public.hr_requests r where r.employee_id = e.id and r.status = 'approved'
                                             and r.type in ('leave', 'business_trip', 'exit_reentry') and g::date between r.start_date and r.end_date))
      into v_work, v_absent
    from generate_series(v_from, v_until, interval '1 day') g
    where extract(isodow from g) not in (5, 6)
      and not exists (select 1 from public.public_holidays h where g::date between h.start_date and h.end_date);
    if v_until < v_from then v_work := 0; v_absent := 0; end if;

    -- late minutes after the grace period (counted from the start time)
    select coalesce(sum(m), 0)::int into v_late from (
      select extract(epoch from ((a.check_in_at at time zone 'Asia/Riyadh')::time - coalesce(e.work_start, '08:00'::time))) / 60 as m
      from public.attendance a
      where a.employee_id = e.id and a.work_date between v_from and v_end and a.check_in_at is not null
    ) t where m > s.payroll_late_grace_min;

    -- unpaid leave days inside the month
    select coalesce(sum(least(r.end_date, v_end) - greatest(r.start_date, v_start) + 1), 0) into v_unpaid
    from public.hr_requests r join public.leave_types lt on lt.code = r.leave_type
    where r.employee_id = e.id and r.type = 'leave' and r.status = 'approved' and lt.pay = 'none'
      and r.start_date <= v_end and r.end_date >= v_start;

    select coalesce(sum(hours), 0) into v_ot from public.hr_requests
    where employee_id = e.id and type = 'overtime' and status = 'approved' and work_date between v_start and v_end;
    select coalesce(sum(days), 0), coalesce(sum(amount), 0) into v_trip_days, v_trip from public.hr_requests
    where employee_id = e.id and type = 'business_trip' and status = 'approved' and start_date between v_start and v_end;
    select coalesce(sum(amount), 0) into v_adv from public.hr_requests
    where employee_id = e.id and type = 'salary_advance' and status = 'approved'
      and (decided_at at time zone 'Asia/Riyadh')::date between v_start and v_end;
    select coalesce(sum(amount) filter (where kind = 'bonus'), 0), coalesce(sum(amount) filter (where kind = 'allowance'), 0),
           coalesce(sum(amount) filter (where kind = 'deduction'), 0)
      into v_bonus, v_allow, v_ded
    from public.payroll_adjustments where period = p_period and employee_id = e.id;

    select * into v_prev from _keep where employee_id = e.id;
    l := null;
    l.id := gen_random_uuid(); l.run_id := v_run; l.employee_id := e.id;
    l.emp_no := e.emp_no; l.full_name := e.full_name; l.job_title := e.job_title; l.department := e.dept; l.nationality_type := e.nationality_type;
    l.payable_days := round(v_factor * 30);
    l.basic := round(sal.basic * v_factor, 2); l.housing := round(sal.housing * v_factor, 2);
    l.transport := round(sal.transport * v_factor, 2); l.other_allowances := round(sal.other_allowances * v_factor + v_allow, 2);
    l.overtime_hours := v_ot; l.overtime_amount := round(v_ot * v_hourly_ot, 2);
    l.trip_days := v_trip_days; l.trip_amount := round(v_trip, 2);
    l.bonus_amount := round(v_bonus, 2);
    l.workdays := coalesce(v_work, 0);
    l.absence_days := case when coalesce(p_include_absence, true) and s.payroll_absence_deduct then coalesce(v_absent, 0) else 0 end;
    l.absence_deduction := round(l.absence_days * v_daily, 2);
    l.late_minutes := coalesce(v_late, 0);
    l.late_deduction := case when s.payroll_late_deduct then round(l.late_minutes * v_minute, 2) else 0 end;
    l.unpaid_leave_days := v_unpaid; l.unpaid_leave_deduction := round(v_unpaid * v_daily, 2);
    l.advance_deduction := round(v_adv, 2);
    l.gosi_rate := v_rate; l.gosi_amount := round(least(sal.basic + sal.housing, 45000) * v_factor * v_rate / 100, 2);
    l.fixed_deductions := round(sal.other_deductions, 2);
    l.other_deductions := round(v_ded, 2);
    l.manual_adjustment := coalesce(v_prev.manual_adjustment, 0); l.note := v_prev.note;
    l.details := jsonb_build_object('daily_rate', round(v_daily, 2), 'overtime_hourly', round(v_hourly_ot, 2),
      'absent_counted', coalesce(v_absent, 0), 'judged_until', v_until, 'factor', round(v_factor, 4));
    l := public._payroll_totals(l);
    insert into public.payroll_lines select l.*;
  end loop;
  return v_run;
end $$;

create or replace function public.update_payroll_line(p_line uuid, p_manual numeric, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare l public.payroll_lines;
begin
  if not public.is_hr() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  select pl.* into l from public.payroll_lines pl join public.payroll_runs r on r.id = pl.run_id where pl.id = p_line and r.status = 'draft';
  if l.id is null then raise exception 'PAYROLL_LOCKED' using errcode = 'P0001'; end if;
  if p_manual is not null and abs(p_manual) > 1000000 then raise exception 'INVALID_AMOUNT' using errcode = 'P0001'; end if;
  l.manual_adjustment := coalesce(p_manual, 0); l.note := nullif(btrim(p_note), '');
  l := public._payroll_totals(l);
  update public.payroll_lines set manual_adjustment = l.manual_adjustment, note = l.note,
    gross = l.gross, total_deductions = l.total_deductions, net = l.net where id = p_line;
end $$;

create or replace function public.add_payroll_adjustment(p_period text, p_employee uuid, p_kind text, p_amount numeric, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_hr() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if exists (select 1 from public.payroll_runs where period = p_period and status <> 'draft') then raise exception 'PAYROLL_LOCKED' using errcode = 'P0001'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT' using errcode = 'P0001'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'NOTE_REQUIRED' using errcode = 'P0001'; end if;
  insert into public.payroll_adjustments (period, employee_id, kind, amount, reason, created_by)
  values (p_period, p_employee, p_kind, round(p_amount, 2), left(btrim(p_reason), 300), auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.delete_payroll_adjustment(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_hr() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  delete from public.payroll_adjustments a where a.id = p_id
    and not exists (select 1 from public.payroll_runs r where r.period = a.period and r.status <> 'draft');
  if not found then raise exception 'PAYROLL_LOCKED' using errcode = 'P0001'; end if;
end $$;

-- admin approves (locks); HR/admin mark paid (employees are notified); admin can reopen an approved run
create or replace function public.set_payroll_status(p_run uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare r record; v_user uuid;
begin
  select * into r from public.payroll_runs where id = p_run for update;
  if r.id is null then raise exception 'REQUEST_NOT_ACTIVE' using errcode = 'P0001'; end if;
  if p_status = 'approved' and r.status = 'draft' then
    if public.auth_role()::text <> 'admin' then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
    if not exists (select 1 from public.payroll_lines where run_id = p_run) then raise exception 'REQUIRED' using errcode = 'P0001'; end if;
    update public.payroll_runs set status = 'approved', approved_at = now(), approved_by = auth.uid() where id = p_run;
  elsif p_status = 'paid' and r.status = 'approved' then
    if not public.is_hr() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
    update public.payroll_runs set status = 'paid', paid_at = now() where id = p_run;
    for v_user in select e.profile_id from public.payroll_lines l join public.employees e on e.id = l.employee_id
                  where l.run_id = p_run and e.profile_id is not null loop
      perform public.notify_user(v_user, 'payslip_ready', null, jsonb_build_object('title', r.period, 'link', '/me/payslips'));
    end loop;
  elsif p_status = 'draft' and r.status = 'approved' then
    if public.auth_role()::text <> 'admin' then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
    update public.payroll_runs set status = 'draft', approved_at = null, approved_by = null where id = p_run;
  else
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;
end $$;

create or replace function public.update_payroll_settings(p_absence boolean, p_late boolean, p_grace int, p_day_hours numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_hr() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  update public.company_settings set payroll_absence_deduct = coalesce(p_absence, payroll_absence_deduct),
    payroll_late_deduct = coalesce(p_late, payroll_late_deduct),
    payroll_late_grace_min = greatest(0, least(coalesce(p_grace, payroll_late_grace_min), 120)),
    payroll_day_hours = greatest(4, least(coalesce(p_day_hours, payroll_day_hours), 12)) where id = 1;
end $$;

-- bank details for the transfer sheet (HR only)
create or replace function public.payroll_bank_sheet(p_run uuid)
returns table (employee_id uuid, iban text, bank_name text, id_number text)
language sql stable security definer set search_path = public as $$
  select l.employee_id, p.iban, p.bank_name, p.id_number
  from public.payroll_lines l left join public.employee_private p on p.employee_id = l.employee_id
  where l.run_id = p_run and public.is_hr()
$$;

revoke all on function public._payroll_totals(public.payroll_lines) from public, anon, authenticated;
revoke all on function public.generate_payroll(text, boolean), public.update_payroll_line(uuid, numeric, text),
  public.add_payroll_adjustment(text, uuid, text, numeric, text), public.delete_payroll_adjustment(uuid),
  public.set_payroll_status(uuid, text), public.update_payroll_settings(boolean, boolean, int, numeric), public.payroll_bank_sheet(uuid)
  from public, anon;
grant execute on function public.generate_payroll(text, boolean), public.update_payroll_line(uuid, numeric, text),
  public.add_payroll_adjustment(text, uuid, text, numeric, text), public.delete_payroll_adjustment(uuid),
  public.set_payroll_status(uuid, text), public.update_payroll_settings(boolean, boolean, int, numeric), public.payroll_bank_sheet(uuid)
  to authenticated;
