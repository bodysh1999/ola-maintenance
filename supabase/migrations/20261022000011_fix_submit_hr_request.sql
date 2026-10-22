-- إصلاح: طلبات غير الإجازة (تعريف راتب، خارج دوام…) كانت تفشل في PostgreSQL الحقيقي
-- (record "v_lt" is not assigned yet). شغّله ثم أعد تشغيل hr-demo.sql
create or replace function public.submit_hr_request(p jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_emp record; v_type text := p ->> 'type'; v_lt record; v_lt_code text; v_req uuid; v_ref text;
  v_start date; v_end date; v_days numeric; v_work date; v_in time; v_out time; v_hours numeric; v_amount numeric;
  v_levels int; v_hr boolean; v_step int := 0; m record; v_today date := public.today_riyadh(); v_bal record;
  v_gross numeric; v_dept_mgr uuid; v_seen uuid[] := '{}';
begin
  select * into v_emp from public.employees where id = public.my_employee_id();
  if v_emp.id is null or v_emp.status <> 'active' then raise exception 'NO_EMPLOYEE_FILE' using errcode = 'P0001'; end if;

  v_start := nullif(p ->> 'start_date', '')::date;
  v_end   := nullif(p ->> 'end_date', '')::date;
  v_work  := nullif(p ->> 'work_date', '')::date;
  v_in    := nullif(p ->> 'time_in', '')::time;
  v_out   := nullif(p ->> 'time_out', '')::time;
  v_hours := nullif(p ->> 'hours', '')::numeric;
  v_amount := nullif(p ->> 'amount', '')::numeric;

  if v_type = 'leave' then
    select * into v_lt from public.leave_types where code = p ->> 'leave_type' and is_active;
    if v_lt.code is null then raise exception 'LEAVE_TYPE_REQUIRED' using errcode = 'P0001'; end if;
    v_lt_code := v_lt.code;
    if v_start is null or v_end is null or v_end < v_start then raise exception 'INVALID_RANGE' using errcode = 'P0001'; end if;
    if v_start < v_today - 30 then raise exception 'DATE_TOO_OLD' using errcode = 'P0001'; end if;
    v_days := v_end - v_start + 1;
    if v_lt.max_days is not null and v_days > v_lt.max_days then raise exception 'LEAVE_MAX_EXCEEDED' using errcode = 'P0001'; end if;
    if v_lt.gender is not null and v_lt.gender <> v_emp.gender then raise exception 'LEAVE_NOT_ELIGIBLE' using errcode = 'P0001'; end if;
    if v_today - v_emp.hire_date < v_lt.min_service_days then raise exception 'LEAVE_SERVICE_REQUIRED' using errcode = 'P0001'; end if;
    if v_lt.once_per_service and exists (select 1 from public.hr_requests where employee_id = v_emp.id and leave_type = v_lt.code and status in ('pending', 'approved')) then
      raise exception 'LEAVE_ONCE_ONLY' using errcode = 'P0001';
    end if;
    if v_lt.requires_attachment and coalesce(p ->> 'attachment_path', '') = '' and v_lt.code in ('sick', 'maternity') then
      raise exception 'ATTACHMENT_REQUIRED' using errcode = 'P0001';
    end if;
    if v_lt.yearly_max is not null and (
      select coalesce(sum(days), 0) from public.hr_requests where employee_id = v_emp.id and leave_type = v_lt.code
        and status in ('pending', 'approved') and start_date > v_start - 365) + v_days > v_lt.yearly_max then
      raise exception 'LEAVE_MAX_EXCEEDED' using errcode = 'P0001';
    end if;
    if v_lt.uses_balance then
      select * into v_bal from public.leave_balance(v_emp.id);
      if v_bal.available < v_days then raise exception 'INSUFFICIENT_BALANCE' using errcode = 'P0001'; end if;
    end if;
    if exists (select 1 from public.hr_requests where employee_id = v_emp.id and type in ('leave', 'business_trip')
               and status in ('pending', 'approved') and daterange(start_date, end_date, '[]') && daterange(v_start, v_end, '[]')) then
      raise exception 'OVERLAPPING_REQUEST' using errcode = 'P0001';
    end if;
    v_levels := 1; v_hr := true;

  elsif v_type = 'business_trip' then
    if v_start is null or v_end is null or v_end < v_start then raise exception 'INVALID_RANGE' using errcode = 'P0001'; end if;
    if coalesce(btrim(p ->> 'destination'), '') = '' then raise exception 'REQUIRED' using errcode = 'P0001'; end if;
    if exists (select 1 from public.hr_requests where employee_id = v_emp.id and type in ('leave', 'business_trip')
               and status in ('pending', 'approved') and daterange(start_date, end_date, '[]') && daterange(v_start, v_end, '[]')) then
      raise exception 'OVERLAPPING_REQUEST' using errcode = 'P0001';
    end if;
    v_days := v_end - v_start + 1;
    v_amount := v_days * (select trip_per_diem from public.company_settings where id = 1);
    v_levels := 2; v_hr := true;

  elsif v_type = 'overtime' then
    if v_work is null or v_work > v_today + 30 or v_work < v_today - 30 then raise exception 'INVALID_DATE' using errcode = 'P0001'; end if;
    if v_hours is null or v_hours <= 0 or v_hours > 12 then raise exception 'INVALID_HOURS' using errcode = 'P0001'; end if;
    v_levels := 2; v_hr := true;

  elsif v_type in ('attendance_correction', 'presence') then
    if v_type = 'presence' then v_work := v_today; v_in := null; v_out := null; end if;  -- proof of presence is always "now"
    if v_work is null or v_work > v_today or v_work < v_today - 30 then raise exception 'INVALID_DATE' using errcode = 'P0001'; end if;
    if v_type = 'attendance_correction' and v_in is null and v_out is null then raise exception 'REQUIRED' using errcode = 'P0001'; end if;
    if v_in is not null and v_out is not null and v_out <= v_in then raise exception 'INVALID_RANGE' using errcode = 'P0001'; end if;
    if v_type = 'presence' and (p ->> 'lat') is null then raise exception 'LOCATION_REQUIRED' using errcode = 'P0001'; end if;
    if exists (select 1 from public.hr_requests where employee_id = v_emp.id and type = v_type and work_date = v_work and status = 'pending') then
      raise exception 'OVERLAPPING_REQUEST' using errcode = 'P0001';
    end if;
    if coalesce(btrim(p ->> 'reason'), '') = '' then raise exception 'NOTE_REQUIRED' using errcode = 'P0001'; end if;
    v_levels := 1; v_hr := false;

  elsif v_type = 'salary_advance' then
    select basic + housing + transport + other_allowances into v_gross from public.employee_salaries where employee_id = v_emp.id;
    if v_amount is null or v_amount <= 0 or v_amount > coalesce(v_gross, 0) then raise exception 'INVALID_AMOUNT' using errcode = 'P0001'; end if;
    v_levels := 1; v_hr := true;

  elsif v_type = 'exit_reentry' then
    if v_emp.nationality_type <> 'resident' then raise exception 'NOT_ELIGIBLE' using errcode = 'P0001'; end if;
    if v_start is null or v_end is null or v_end < v_start then raise exception 'INVALID_RANGE' using errcode = 'P0001'; end if;
    v_days := v_end - v_start + 1;
    v_levels := 1; v_hr := true;

  elsif v_type in ('salary_certificate', 'experience_letter') then
    if exists (select 1 from public.hr_requests where employee_id = v_emp.id and type = v_type and status = 'pending') then
      raise exception 'OVERLAPPING_REQUEST' using errcode = 'P0001';
    end if;
    v_levels := 0; v_hr := true;
  else
    raise exception 'INVALID_KIND' using errcode = 'P0001';
  end if;

  if (p ->> 'attachment_path') is not null and (p ->> 'attachment_path') !~ ('^' || v_emp.id::text || '/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp)$') then
    raise exception 'INVALID_FILE' using errcode = 'P0001';
  end if;

  insert into public.hr_requests (employee_id, type, leave_type, start_date, end_date, days, work_date, time_in, time_out, hours,
    destination, amount, addressed_to, lat, lng, accuracy_m, reason, attachment_path)
  values (v_emp.id, v_type, v_lt_code, v_start, v_end, v_days, v_work, v_in, v_out, v_hours,
    left(nullif(btrim(p ->> 'destination'), ''), 200), v_amount, left(nullif(btrim(p ->> 'addressed_to'), ''), 200),
    nullif(p ->> 'lat', '')::double precision, nullif(p ->> 'lng', '')::double precision, nullif(p ->> 'accuracy_m', '')::numeric::int,
    left(nullif(btrim(p ->> 'reason'), ''), 2000), nullif(p ->> 'attachment_path', ''))
  returning id, ref_no into v_req, v_ref;

  -- approval chain: managers up the structure, then HR
  for m in select c.manager_id from public.manager_chain(v_emp.id) c join public.employees e on e.id = c.manager_id
           where e.status = 'active' order by c.depth limit v_levels loop
    v_step := v_step + 1; v_seen := v_seen || m.manager_id;
    insert into public.hr_request_steps (request_id, step, approver_kind, approver_employee_id) values (v_req, v_step, 'manager', m.manager_id);
  end loop;
  -- no direct manager → department manager
  if v_step = 0 and v_levels > 0 then
    select d.manager_employee_id into v_dept_mgr from public.departments d where d.id = v_emp.department_id;
    if v_dept_mgr is not null and v_dept_mgr <> v_emp.id then
      v_step := 1;
      insert into public.hr_request_steps (request_id, step, approver_kind, approver_employee_id) values (v_req, 1, 'manager', v_dept_mgr);
    end if;
  end if;
  if v_hr or v_step = 0 then
    v_step := v_step + 1;
    insert into public.hr_request_steps (request_id, step, approver_kind) values (v_req, v_step, 'hr');
  end if;

  perform public.notify_hr_step(v_req);
  return v_ref;
end $$;
