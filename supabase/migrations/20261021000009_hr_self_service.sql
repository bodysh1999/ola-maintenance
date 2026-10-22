-- =====================================================================
--  الموارد البشرية والخدمات الذاتية للموظفين
--  ملف الموظف · الراتب والبدلات والحسميات · الحضور بالموقع · الإجازات حسب نظام العمل
--  الطلبات (إجازة، تعريف راتب، خارج دوام، تصحيح بصمة، إثبات تواجد، انتداب، سلفة، خروج وعودة، شهادة خبرة)
--  مع سلسلة اعتماد حسب الهيكل (المدير المباشر ← مديره ← الموارد البشرية)
--  شغّله بعد 20261021000008_role_employee.sql
-- =====================================================================

insert into public.roles (code, name_ar, name_en, description) values
  ('employee', 'موظف', 'Employee', 'الخدمات الذاتية: الحضور والإجازات والطلبات')
on conflict (code) do nothing;

alter table public.company_settings
  add column if not exists gosi_saudi_rate     numeric(5,2) not null default 9.75,  -- حصة الموظف السعودي (معاش 9% + ساند 0.75%)
  add column if not exists gosi_resident_rate  numeric(5,2) not null default 0,     -- غير السعودي: لا يُستقطع منه شيء
  add column if not exists trip_per_diem       numeric(10,2) not null default 500,  -- بدل الانتداب اليومي (ر.س)
  add column if not exists hr_letter_signatory text;                                -- اسم الموقّع على خطابات الموارد البشرية

-- ---------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------
create table if not exists public.work_locations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  lat        double precision not null check (lat between -90 and 90),
  lng        double precision not null check (lng between -180 and 180),
  radius_m   int not null default 150 check (radius_m between 20 and 5000),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.departments (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null unique,
  parent_id           uuid references public.departments (id) on delete set null,
  manager_employee_id uuid,
  created_at          timestamptz not null default now()
);

create sequence if not exists public.employee_no_seq start 1001;

create table if not exists public.employees (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid unique references public.profiles (id) on delete set null,
  emp_no                text not null unique default ('E' || nextval('public.employee_no_seq')),
  full_name             text not null,
  full_name_en          text,
  email                 text,
  phone                 text,
  job_title             text not null,
  department_id         uuid references public.departments (id) on delete set null,
  manager_id            uuid references public.employees (id) on delete set null,
  nationality_type      text not null default 'saudi' check (nationality_type in ('saudi', 'resident')),
  nationality           text,
  gender                text not null default 'male' check (gender in ('male', 'female')),
  hire_date             date not null,                                   -- تاريخ المباشرة
  contract_type         text not null default 'unlimited' check (contract_type in ('unlimited', 'fixed')),
  contract_end          date,
  annual_leave_days     int not null default 21 check (annual_leave_days between 21 and 60),  -- حسب العقد (الحد الأدنى النظامي 21)
  leave_opening_balance numeric(6,2) not null default 0,                 -- رصيد افتتاحي عند بدء الاحتساب
  leave_accrual_start   date,                                            -- بداية احتساب الاستحقاق (افتراضيًا تاريخ المباشرة)
  work_location_id      uuid references public.work_locations (id) on delete set null,
  remote_allowed        boolean not null default false,                  -- يسمح بالبصمة من أي مكان (عمل ميداني/عن بعد)
  work_start            time not null default '08:00',
  work_end              time not null default '17:00',
  status                text not null default 'active' check (status in ('active', 'suspended', 'terminated')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint employees_not_own_manager check (manager_id is distinct from id)
);
create index if not exists employees_manager_idx on public.employees (manager_id);

alter table public.departments drop constraint if exists departments_manager_fk;
alter table public.departments add constraint departments_manager_fk
  foreign key (manager_employee_id) references public.employees (id) on delete set null;

drop trigger if exists trg_employees_touch on public.employees;
create trigger trg_employees_touch before update on public.employees for each row execute function public.touch_updated_at();

-- private data (ID, bank) — only the employee and HR
create table if not exists public.employee_private (
  employee_id uuid primary key references public.employees (id) on delete cascade,
  id_number   text,            -- رقم الهوية / الإقامة
  id_expiry   date,            -- انتهاء الإقامة / الهوية
  birth_date  date,
  iban        text,
  bank_name   text
);

-- salary — only the employee and HR
create table if not exists public.employee_salaries (
  employee_id       uuid primary key references public.employees (id) on delete cascade,
  basic             numeric(12,2) not null default 0 check (basic >= 0),
  housing           numeric(12,2) not null default 0 check (housing >= 0),
  transport         numeric(12,2) not null default 0 check (transport >= 0),
  other_allowances  numeric(12,2) not null default 0 check (other_allowances >= 0),
  other_deductions  numeric(12,2) not null default 0 check (other_deductions >= 0),
  gosi_rate         numeric(5,2),                        -- فارغ = حسب الجنسية من الإعدادات
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Leave types (Saudi Labor Law defaults — HR can adjust)
-- ---------------------------------------------------------------------
create table if not exists public.leave_types (
  code                text primary key,
  name_ar             text not null,
  name_en             text not null,
  max_days            int,                 -- الحد الأقصى للطلب الواحد (فارغ = بلا حد/حسب الرصيد)
  yearly_max          int,                 -- الحد السنوي (مثل المرضية 120)
  pay                 text not null default 'full' check (pay in ('full', 'partial', 'none')),
  uses_balance        boolean not null default false,
  requires_attachment boolean not null default false,
  gender              text check (gender in ('male', 'female')),
  min_service_days    int not null default 0,
  once_per_service    boolean not null default false,
  note_ar             text,
  sort                int not null default 0,
  is_active           boolean not null default true
);

insert into public.leave_types (code, name_ar, name_en, max_days, yearly_max, pay, uses_balance, requires_attachment, gender, min_service_days, once_per_service, note_ar, sort) values
  ('annual',      'إجازة سنوية',                 'Annual leave',        null, null, 'full',    true,  false, null,     0,   false, '21 يومًا سنويًا، وتصبح 30 يومًا بعد 5 سنوات خدمة (المادة 109)', 1),
  ('sick',        'إجازة مرضية',                 'Sick leave',          null, 120,  'partial', false, true,  null,     0,   false, 'في السنة: 30 يومًا بأجر كامل، ثم 60 بثلاثة أرباع الأجر، ثم 30 بدون أجر (المادة 117)', 2),
  ('marriage',    'إجازة زواج',                  'Marriage leave',      5,    null, 'full',    false, true,  null,     0,   false, '5 أيام بأجر كامل (المادة 113)', 3),
  ('newborn',     'إجازة مولود',                 'Newborn (paternity)', 3,    null, 'full',    false, true,  'male',   0,   false, '3 أيام بأجر كامل (المادة 113)', 4),
  ('bereavement', 'إجازة وفاة (زوج/أصول/فروع)',  'Bereavement',         5,    null, 'full',    false, true,  null,     0,   false, '5 أيام بأجر كامل (المادة 113)', 5),
  ('bereavement_sibling', 'إجازة وفاة أخ/أخت',  'Bereavement (sibling)', 3,  null, 'full',    false, true,  null,     0,   false, '3 أيام بأجر كامل', 6),
  ('maternity',   'إجازة وضع',                   'Maternity leave',     84,   null, 'full',    false, true,  'female', 0,   false, '12 أسبوعًا بأجر كامل حسب تعديلات نظام العمل', 7),
  ('hajj',        'إجازة حج',                    'Hajj leave',          15,   null, 'full',    false, false, null,     730, true,  'من 10 إلى 15 يومًا مرة واحدة طوال الخدمة بعد سنتين متصلتين (المادة 114)', 8),
  ('exam',        'إجازة امتحان',                'Exam leave',          null, null, 'full',    false, true,  null,     0,   false, 'بقدر أيام الامتحان الفعلية (المادة 115)', 9),
  ('idda',        'إجازة عدة',                   'Idda leave',          130,  null, 'full',    false, true,  'female', 0,   false, 'للمسلمة 4 أشهر و10 أيام، ولغير المسلمة 15 يومًا (المادة 160)', 10),
  ('unpaid',      'إجازة بدون أجر',              'Unpaid leave',        null, null, 'none',    false, false, null,     0,   false, 'بموافقة صاحب العمل', 11)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- Attendance
-- ---------------------------------------------------------------------
create table if not exists public.attendance (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references public.employees (id) on delete cascade,
  work_date       date not null,
  check_in_at     timestamptz,
  check_out_at    timestamptz,
  in_lat          double precision, in_lng double precision, in_distance_m int,
  out_lat         double precision, out_lng double precision, out_distance_m int,
  location_id     uuid references public.work_locations (id) on delete set null,
  source          text not null default 'gps' check (source in ('gps', 'manual', 'presence')),
  request_id      uuid,
  note            text,
  created_at      timestamptz not null default now(),
  unique (employee_id, work_date),
  constraint attendance_out_after_in check (check_out_at is null or check_in_at is null or check_out_at > check_in_at)
);

-- ---------------------------------------------------------------------
-- Requests + approval chain
-- ---------------------------------------------------------------------
create sequence if not exists public.hr_request_seq start 1001;

create table if not exists public.hr_requests (
  id              uuid primary key default gen_random_uuid(),
  ref_no          text not null unique default ('RQ-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.hr_request_seq')::text, 5, '0')),
  employee_id     uuid not null references public.employees (id) on delete cascade,
  type            text not null check (type in ('leave', 'salary_certificate', 'overtime', 'attendance_correction', 'presence',
                                                 'business_trip', 'salary_advance', 'exit_reentry', 'experience_letter')),
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  current_step    int not null default 1,
  leave_type      text references public.leave_types (code),
  start_date      date,
  end_date        date,
  days            numeric(6,2),
  work_date       date,
  time_in         time,
  time_out        time,
  hours           numeric(5,2),
  destination     text,
  amount          numeric(12,2),
  addressed_to    text,
  lat             double precision,
  lng             double precision,
  accuracy_m      int,
  reason          text,
  attachment_path text,
  created_at      timestamptz not null default now(),
  decided_at      timestamptz
);
create index if not exists hr_requests_emp_idx on public.hr_requests (employee_id, created_at desc);
create index if not exists hr_requests_status_idx on public.hr_requests (status, created_at desc);

create table if not exists public.hr_request_steps (
  id                    uuid primary key default gen_random_uuid(),
  request_id            uuid not null references public.hr_requests (id) on delete cascade,
  step                  int not null,
  approver_kind         text not null check (approver_kind in ('manager', 'hr')),
  approver_employee_id  uuid references public.employees (id) on delete set null,
  decision              text not null default 'pending' check (decision in ('pending', 'approved', 'rejected', 'cancelled')),
  comment               text,
  decided_by            uuid references public.profiles (id) on delete set null,
  decided_at            timestamptz,
  unique (request_id, step)
);
create index if not exists hr_request_steps_approver_idx on public.hr_request_steps (approver_employee_id, decision);

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.my_employee_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.employees where profile_id = auth.uid() and status <> 'terminated'
$$;

-- managers above an employee (direct manager first), cycle-safe
create or replace function public.manager_chain(p_emp uuid)
returns table (manager_id uuid, depth int) language sql stable security definer set search_path = public as $$
  with recursive up(id, depth, path) as (
    select e.manager_id, 1, array[e.id] from public.employees e where e.id = p_emp and e.manager_id is not null
    union all
    select e.manager_id, up.depth + 1, up.path || e.id
    from up join public.employees e on e.id = up.id
    where e.manager_id is not null and not e.manager_id = any(up.path || up.id) and up.depth < 10
  )
  select id, depth from up
$$;

-- self, HR/admin, anyone above them in the structure, or their own managers (to show names)
create or replace function public.can_view_employee(p_emp uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_hr()
      or p_emp = public.my_employee_id()
      or exists (select 1 from public.manager_chain(p_emp) c where c.manager_id = public.my_employee_id())
      or exists (select 1 from public.manager_chain(public.my_employee_id()) c where c.manager_id = p_emp)
$$;

create or replace function public.can_view_hr_request(p_req uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.hr_requests r
    where r.id = p_req and (
      public.is_hr() or r.employee_id = public.my_employee_id()
      or exists (select 1 from public.hr_request_steps s where s.request_id = r.id and s.approver_employee_id = public.my_employee_id())
    ))
$$;

create or replace function public.today_riyadh()
returns date language sql stable as $$ select (now() at time zone 'Asia/Riyadh')::date $$;

create or replace function public.distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

-- Annual leave entitlement: contract days per year, at least 30/year after 5 years of service (Art. 109)
create or replace function public.leave_balance(p_emp uuid)
returns table (accrued numeric, used numeric, pending numeric, available numeric, yearly_rate int, service_years numeric)
language plpgsql stable security definer set search_path = public as $$
declare e record; v_start date; v_five date; v_today date := public.today_riyadh(); v_acc numeric := 0;
begin
  if not public.can_view_employee(p_emp) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  select * into e from public.employees where id = p_emp;
  if not found then return; end if;
  v_start := coalesce(e.leave_accrual_start, e.hire_date);
  v_five := (e.hire_date + interval '5 years')::date;
  if v_today > v_start then
    v_acc := (least(v_today, greatest(v_five, v_start)) - v_start) * e.annual_leave_days / 365.0
           + greatest(0, v_today - greatest(v_five, v_start)) * greatest(e.annual_leave_days, 30) / 365.0;
  end if;
  accrued := round(e.leave_opening_balance + v_acc, 2);
  select coalesce(sum(days) filter (where status = 'approved'), 0), coalesce(sum(days) filter (where status = 'pending'), 0)
    into used, pending
  from public.hr_requests where employee_id = p_emp and type = 'leave' and leave_type = 'annual' and start_date >= v_start;
  available := round(accrued - used - pending, 2);
  yearly_rate := case when v_today >= v_five then greatest(e.annual_leave_days, 30) else e.annual_leave_days end;
  service_years := round((v_today - e.hire_date) / 365.25, 1);
  return next;
end $$;

-- ---------------------------------------------------------------------
-- Submit a request (validations + approval chain)
-- ---------------------------------------------------------------------
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

-- notify whoever must act on the current step
create or replace function public.notify_hr_step(p_req uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record; s record; v_user uuid;
begin
  select hr.*, e.full_name into r from public.hr_requests hr join public.employees e on e.id = hr.employee_id where hr.id = p_req;
  select * into s from public.hr_request_steps where request_id = p_req and step = r.current_step;
  if s.approver_kind = 'manager' then
    select profile_id into v_user from public.employees where id = s.approver_employee_id;
    perform public.notify_user(v_user, 'hr_approval_needed', null,
      jsonb_build_object('ref_no', r.ref_no, 'name', r.full_name, 'link', '/me/requests/' || p_req));
  else
    for v_user in select id from public.profiles where role::text in ('admin', 'hr') and is_active loop
      perform public.notify_user(v_user, 'hr_approval_needed', null,
        jsonb_build_object('ref_no', r.ref_no, 'name', r.full_name, 'link', '/me/requests/' || p_req));
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Approve / reject the current step
-- ---------------------------------------------------------------------
create or replace function public.decide_hr_request(p_id uuid, p_approve boolean, p_comment text default null)
returns text language plpgsql security definer set search_path = public as $$
declare r record; s record; v_me uuid := public.my_employee_id(); v_last int; v_user uuid; v_loc uuid;
begin
  select * into r from public.hr_requests where id = p_id for update;
  if r.id is null or r.status <> 'pending' then raise exception 'REQUEST_NOT_ACTIVE' using errcode = 'P0001'; end if;
  select * into s from public.hr_request_steps where request_id = p_id and step = r.current_step;
  if not (
       (s.approver_kind = 'manager' and s.approver_employee_id = v_me)
    or (s.approver_kind = 'hr' and public.is_hr())
    or public.auth_role()::text = 'admin'
  ) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if r.employee_id = v_me and public.auth_role()::text <> 'admin' then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if not p_approve and coalesce(btrim(p_comment), '') = '' then raise exception 'NOTE_REQUIRED' using errcode = 'P0001'; end if;

  update public.hr_request_steps set decision = case when p_approve then 'approved' else 'rejected' end,
    comment = nullif(btrim(p_comment), ''), decided_by = auth.uid(), decided_at = now()
  where id = s.id;

  select profile_id into v_user from public.employees where id = r.employee_id;
  select max(step) into v_last from public.hr_request_steps where request_id = p_id;

  if not p_approve then
    update public.hr_requests set status = 'rejected', decided_at = now() where id = p_id;
    perform public.notify_user(v_user, 'hr_request_rejected', null, jsonb_build_object('ref_no', r.ref_no, 'link', '/me/requests/' || p_id, 'note', p_comment));
    return 'rejected';
  end if;

  if r.current_step < v_last then
    update public.hr_requests set current_step = current_step + 1 where id = p_id;
    perform public.notify_hr_step(p_id);
    return 'next';
  end if;

  update public.hr_requests set status = 'approved', decided_at = now() where id = p_id;
  -- effects
  select work_location_id into v_loc from public.employees where id = r.employee_id;
  if r.type = 'attendance_correction' then
    insert into public.attendance (employee_id, work_date, check_in_at, check_out_at, location_id, source, request_id, note)
    values (r.employee_id, r.work_date,
      case when r.time_in  is not null then (r.work_date + r.time_in)  at time zone 'Asia/Riyadh' end,
      case when r.time_out is not null then (r.work_date + r.time_out) at time zone 'Asia/Riyadh' end,
      v_loc, 'manual', r.id, r.reason)
    on conflict (employee_id, work_date) do update set
      check_in_at  = coalesce(excluded.check_in_at, attendance.check_in_at),
      check_out_at = coalesce(excluded.check_out_at, attendance.check_out_at),
      source = 'manual', request_id = excluded.request_id, note = excluded.note;
  elsif r.type = 'presence' then
    -- the recorded moment becomes the check-in, or the check-out if already checked in that day
    insert into public.attendance (employee_id, work_date, check_in_at, in_lat, in_lng, location_id, source, request_id, note)
    values (r.employee_id, r.work_date, r.created_at, r.lat, r.lng, v_loc, 'presence', r.id, r.reason)
    on conflict (employee_id, work_date) do update set
      check_out_at = case when attendance.check_out_at is null and r.created_at > attendance.check_in_at then r.created_at else attendance.check_out_at end,
      out_lat = case when attendance.check_out_at is null then r.lat else attendance.out_lat end,
      out_lng = case when attendance.check_out_at is null then r.lng else attendance.out_lng end,
      source = 'presence', request_id = excluded.request_id, note = excluded.note;
  end if;
  perform public.notify_user(v_user, 'hr_request_approved', null, jsonb_build_object('ref_no', r.ref_no, 'link', '/me/requests/' || p_id));
  return 'approved';
end $$;

create or replace function public.cancel_hr_request(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.hr_requests set status = 'cancelled', decided_at = now()
  where id = p_id and employee_id = public.my_employee_id() and status = 'pending';
  if not found then raise exception 'REQUEST_NOT_ACTIVE' using errcode = 'P0001'; end if;
  update public.hr_request_steps set decision = 'cancelled' where request_id = p_id and decision = 'pending';
end $$;

-- ---------------------------------------------------------------------
-- GPS check-in / check-out (geofence checked in the database)
-- ---------------------------------------------------------------------
create or replace function public.attendance_punch(p_kind text, p_lat double precision, p_lng double precision, p_accuracy double precision default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e record; loc record; v_dist double precision; v_today date := public.today_riyadh(); a record;
begin
  select * into e from public.employees where id = public.my_employee_id();
  if e.id is null or e.status <> 'active' then raise exception 'NO_EMPLOYEE_FILE' using errcode = 'P0001'; end if;
  if p_lat is null or p_lng is null then raise exception 'LOCATION_REQUIRED' using errcode = 'P0001'; end if;
  if p_accuracy is not null and p_accuracy > 200 then raise exception 'LOW_ACCURACY' using errcode = 'P0001'; end if;

  select l.*, public.distance_m(p_lat, p_lng, l.lat, l.lng) as d into loc
  from public.work_locations l
  where l.is_active and (e.work_location_id is null or l.id = e.work_location_id)
  order by public.distance_m(p_lat, p_lng, l.lat, l.lng) limit 1;
  v_dist := loc.d;

  if not e.remote_allowed then
    if loc.id is null then raise exception 'NO_WORK_LOCATION' using errcode = 'P0001'; end if;
    if v_dist > loc.radius_m + least(coalesce(p_accuracy, 0), 50) then
      raise exception 'OUT_OF_RANGE' using errcode = 'P0001', detail = round(v_dist)::text;
    end if;
  end if;

  select * into a from public.attendance where employee_id = e.id and work_date = v_today;
  if p_kind = 'in' then
    if a.check_in_at is not null then raise exception 'ALREADY_CHECKED_IN' using errcode = 'P0001'; end if;
    insert into public.attendance (employee_id, work_date, check_in_at, in_lat, in_lng, in_distance_m, location_id, source)
    values (e.id, v_today, now(), p_lat, p_lng, round(v_dist), loc.id, 'gps')
    on conflict (employee_id, work_date) do update set check_in_at = now(), in_lat = p_lat, in_lng = p_lng, in_distance_m = round(v_dist), location_id = loc.id;
  elsif p_kind = 'out' then
    if a.check_in_at is null then raise exception 'NOT_CHECKED_IN' using errcode = 'P0001'; end if;
    if a.check_out_at is not null then raise exception 'ALREADY_CHECKED_OUT' using errcode = 'P0001'; end if;
    update public.attendance set check_out_at = now(), out_lat = p_lat, out_lng = p_lng, out_distance_m = round(v_dist) where id = a.id;
  else
    raise exception 'INVALID_KIND' using errcode = 'P0001';
  end if;
  return jsonb_build_object('distance_m', round(v_dist), 'location', loc.name, 'at', now());
end $$;

-- requests waiting for the signed-in user (manager step assigned to them, or HR step for HR/admin)
create or replace function public.my_approval_queue()
returns table (id uuid, ref_no text, type text, leave_type text, start_date date, end_date date, days numeric, work_date date,
               hours numeric, amount numeric, created_at timestamptz, employee_id uuid, employee_name text, job_title text, step int, approver_kind text)
language sql stable security definer set search_path = public as $$
  select r.id, r.ref_no, r.type, r.leave_type, r.start_date, r.end_date, r.days, r.work_date, r.hours, r.amount, r.created_at,
         e.id, e.full_name, e.job_title, s.step, s.approver_kind
  from public.hr_requests r
  join public.hr_request_steps s on s.request_id = r.id and s.step = r.current_step
  join public.employees e on e.id = r.employee_id
  where r.status = 'pending'
    and ((s.approver_kind = 'manager' and s.approver_employee_id = public.my_employee_id())
      or (s.approver_kind = 'hr' and public.is_hr()))
    and (r.employee_id is distinct from public.my_employee_id() or public.auth_role()::text = 'admin')
  order by r.created_at
$$;
create or replace function public.my_pending_approvals_count()
returns int language sql stable security definer set search_path = public as $$ select count(*)::int from public.my_approval_queue() $$;

revoke execute on function public.notify_hr_step(uuid) from public, anon, authenticated;
revoke execute on function public.my_approval_queue(), public.my_pending_approvals_count() from public, anon;
grant execute on function public.my_approval_queue(), public.my_pending_approvals_count() to authenticated;
revoke execute on function public.submit_hr_request(jsonb), public.decide_hr_request(uuid, boolean, text), public.cancel_hr_request(uuid),
  public.attendance_punch(text, double precision, double precision, double precision), public.leave_balance(uuid) from public, anon;
grant execute on function public.submit_hr_request(jsonb), public.decide_hr_request(uuid, boolean, text), public.cancel_hr_request(uuid),
  public.attendance_punch(text, double precision, double precision, double precision), public.leave_balance(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Security
-- ---------------------------------------------------------------------
alter table public.work_locations    enable row level security;
alter table public.departments       enable row level security;
alter table public.employees         enable row level security;
alter table public.employee_private  enable row level security;
alter table public.employee_salaries enable row level security;
alter table public.leave_types       enable row level security;
alter table public.attendance        enable row level security;
alter table public.hr_requests       enable row level security;
alter table public.hr_request_steps  enable row level security;

revoke all on public.work_locations, public.departments, public.employees, public.employee_private, public.employee_salaries,
  public.leave_types, public.attendance, public.hr_requests, public.hr_request_steps from anon;
-- requests, steps: changed only through the functions above
revoke insert, update, delete on public.hr_requests, public.hr_request_steps from authenticated;

do $$ declare t text; begin
  foreach t in array array['work_locations', 'departments', 'leave_types'] loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_hr', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.my_employee_id() is not null or public.is_hr())', t || '_read', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_hr()) with check (public.is_hr())', t || '_hr', t);
  end loop;
end $$;

drop policy if exists employees_read on public.employees;
drop policy if exists employees_hr on public.employees;
create policy employees_read on public.employees for select to authenticated using (public.can_view_employee(id));
create policy employees_hr   on public.employees for all to authenticated using (public.is_hr()) with check (public.is_hr());

drop policy if exists private_read on public.employee_private;
drop policy if exists private_hr on public.employee_private;
create policy private_read on public.employee_private for select to authenticated using (employee_id = public.my_employee_id() or public.is_hr());
create policy private_hr   on public.employee_private for all to authenticated using (public.is_hr()) with check (public.is_hr());

drop policy if exists salaries_read on public.employee_salaries;
drop policy if exists salaries_hr on public.employee_salaries;
create policy salaries_read on public.employee_salaries for select to authenticated using (employee_id = public.my_employee_id() or public.is_hr());
create policy salaries_hr   on public.employee_salaries for all to authenticated using (public.is_hr()) with check (public.is_hr());

drop policy if exists attendance_read on public.attendance;
drop policy if exists attendance_hr on public.attendance;
create policy attendance_read on public.attendance for select to authenticated using (public.can_view_employee(employee_id));
create policy attendance_hr   on public.attendance for all to authenticated using (public.is_hr()) with check (public.is_hr());

drop policy if exists hr_requests_read on public.hr_requests;
create policy hr_requests_read on public.hr_requests for select to authenticated using (public.can_view_hr_request(id));
drop policy if exists hr_steps_read on public.hr_request_steps;
create policy hr_steps_read on public.hr_request_steps for select to authenticated using (public.can_view_hr_request(request_id));

-- the employee may not change their own salary/leave settings even if they are HR
create or replace function public.guard_self_hr_edit()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.auth_role()::text <> 'admin' and (to_jsonb(new) ->> case when tg_table_name = 'employees' then 'id' else 'employee_id' end)::uuid = public.my_employee_id() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_self_salary on public.employee_salaries;
create trigger trg_guard_self_salary before insert or update on public.employee_salaries for each row execute function public.guard_self_hr_edit();
drop trigger if exists trg_guard_self_employee on public.employees;
create trigger trg_guard_self_employee before update on public.employees for each row execute function public.guard_self_hr_edit();

-- HR can change only the payroll/trip settings (company settings stay admin-only)
create or replace function public.update_hr_settings(p_gosi_saudi numeric, p_gosi_resident numeric, p_per_diem numeric, p_signatory text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_hr() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  update public.company_settings set
    gosi_saudi_rate = greatest(0, least(coalesce(p_gosi_saudi, gosi_saudi_rate), 30)),
    gosi_resident_rate = greatest(0, least(coalesce(p_gosi_resident, gosi_resident_rate), 30)),
    trip_per_diem = greatest(0, coalesce(p_per_diem, trip_per_diem)),
    hr_letter_signatory = nullif(btrim(p_signatory), '')
  where id = 1;
end $$;
revoke execute on function public.update_hr_settings(numeric, numeric, numeric, text) from public, anon;
grant execute on function public.update_hr_settings(numeric, numeric, numeric, text) to authenticated;

-- HR / managers may see profile names of employees
drop policy if exists profiles_hr_read on public.profiles;
create policy profiles_hr_read on public.profiles for select to authenticated using (public.is_hr());

-- attachments (medical reports, etc.): employee uploads to their own folder; HR and approvers can read
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hr-docs', 'hr-docs', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "hr-docs upload" on storage.objects;
drop policy if exists "hr-docs read" on storage.objects;
create policy "hr-docs upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'hr-docs' and split_part(name, '/', 1) = public.my_employee_id()::text);
create policy "hr-docs read" on storage.objects for select to authenticated
  using (bucket_id = 'hr-docs' and (
    public.is_hr() or split_part(name, '/', 1) = public.my_employee_id()::text
    or exists (select 1 from public.hr_requests r where r.attachment_path = name and public.can_view_hr_request(r.id))));
