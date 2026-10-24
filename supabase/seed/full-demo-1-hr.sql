-- =====================================================================
--  عرض كامل (1/3): حسابات تجريبية + الهيكل + الرواتب + الحضور للشهر الحالي
--  كل الحسابات: <name>@demo.example.com / Demo@12345 — تُحذف بـ demo-purge.sql قبل الإطلاق
--  لا يلمس أي سجل حقيقي. آمن لإعادة التشغيل (يتخطى ما هو موجود).
-- =====================================================================
create or replace function pg_temp.demo_user(p_email text, p_name text, p_role text, p_phone text)
returns uuid language plpgsql as $f$
declare v uuid;
begin
  select id into v from auth.users where email = p_email;
  if v is null then
    v := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ('00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated', p_email,
      extensions.crypt('Demo@12345', extensions.gen_salt('bf')), now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', p_role),
      jsonb_build_object('full_name', p_name, 'phone', p_phone), now(), now(), '', '', '', '', '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v, v::text, jsonb_build_object('sub', v::text, 'email', p_email, 'email_verified', true), 'email', now(), now(), now());
  end if;
  update public.profiles set full_name = p_name, phone = p_phone, role = p_role::public.app_role, is_active = true,
    privacy_accepted_version = coalesce((select privacy_version from public.company_settings where id = 1), '1.0'), privacy_accepted_at = now()
  where id = v;
  return v;
end $f$;

do $$
declare
  v_loc uuid; d_top uuid; d_after uuid; d_sales uuid; d_hr uuid; d_proj uuid;
  u_gm uuid; u_hr uuid; u_sup uuid; u_sales uuid; u_emp uuid; u_acc uuid;
  e_gm uuid; e_hr uuid; e_sup uuid; e_sales uuid; e_emp uuid; e_acc uuid; e record; t record;
  day date; v_today date := public.today_riyadh(); v_start date := date_trunc('month', public.today_riyadh())::date; late int;
begin
  if exists (select 1 from public.employees where email = 'gm@demo.example.com') then
    raise notice 'part 1 already done'; return;
  end if;

  -- accounts
  u_gm    := pg_temp.demo_user('admin@demo.example.com', 'خالد العتيبي', 'admin', '0550000101');
  u_hr    := pg_temp.demo_user('hr@demo.example.com', 'منى الحربي', 'hr', '0551000002');
  u_sup   := pg_temp.demo_user('supervisor@demo.example.com', 'سارة الغامدي', 'supervisor', '0551000003');
  u_sales := pg_temp.demo_user('sales@demo.example.com', 'ياسر المالكي', 'sales', '0551000004');
  u_emp   := pg_temp.demo_user('employee@demo.example.com', 'ريم السبيعي', 'employee', '0553100001');
  u_acc   := pg_temp.demo_user('accountant@demo.example.com', 'محمد أنور', 'employee', '0553100002');

  -- office + departments
  insert into public.work_locations (name, lat, lng, radius_m) values ('المكتب الرئيسي — جدة', 21.5433, 39.1728, 200) returning id into v_loc;
  insert into public.departments (name) values ('الإدارة العليا') returning id into d_top;
  insert into public.departments (name, parent_id) values ('خدمات ما بعد البيع', d_top) returning id into d_after;
  insert into public.departments (name, parent_id) values ('المبيعات والتسويق', d_top) returning id into d_sales;
  insert into public.departments (name, parent_id) values ('الموارد البشرية والمالية', d_top) returning id into d_hr;
  select id into d_proj from public.departments where name = 'المشاريع' limit 1;
  if d_proj is null then insert into public.departments (name, parent_id) values ('المشاريع', d_top) returning id into d_proj;
  else update public.departments set parent_id = coalesce(parent_id, d_top) where id = d_proj; end if;

  -- employees
  insert into public.employees (profile_id, full_name, email, phone, job_title, department_id, nationality_type, nationality, gender, hire_date, annual_leave_days, work_location_id, remote_allowed)
  values (u_gm, 'خالد العتيبي', 'gm@demo.example.com', '0550000101', 'المدير العام', d_top, 'saudi', 'سعودي', 'male', v_today - 4200, 30, v_loc, true) returning id into e_gm;
  insert into public.employees (profile_id, full_name, email, phone, job_title, department_id, manager_id, nationality_type, nationality, gender, hire_date, work_location_id)
  values (u_hr, 'منى الحربي', 'hr@demo.example.com', '0551000002', 'مديرة الموارد البشرية', d_hr, e_gm, 'saudi', 'سعودية', 'female', v_today - 1500, v_loc) returning id into e_hr;
  insert into public.employees (profile_id, full_name, email, phone, job_title, department_id, manager_id, nationality_type, nationality, gender, hire_date, work_location_id)
  values (u_sup, 'سارة الغامدي', 'supervisor@demo.example.com', '0551000003', 'مشرفة خدمات ما بعد البيع', d_after, e_gm, 'saudi', 'سعودية', 'female', v_today - 1100, v_loc) returning id into e_sup;
  insert into public.employees (profile_id, full_name, email, phone, job_title, department_id, manager_id, nationality_type, nationality, gender, hire_date, work_location_id)
  values (u_sales, 'ياسر المالكي', 'sales@demo.example.com', '0551000004', 'أخصائي مبيعات عقارية', d_sales, e_gm, 'saudi', 'سعودي', 'male', v_today - 800, v_loc) returning id into e_sales;
  insert into public.employees (profile_id, full_name, email, phone, job_title, department_id, manager_id, nationality_type, nationality, gender, hire_date, work_location_id)
  values (u_emp, 'ريم السبيعي', 'employee@demo.example.com', '0553100001', 'مهندسة مشاريع', d_proj, e_gm, 'saudi', 'سعودية', 'female', v_today - 620, v_loc) returning id into e_emp;
  insert into public.employees (profile_id, full_name, email, phone, job_title, department_id, manager_id, nationality_type, nationality, gender, hire_date, contract_type, contract_end, work_location_id)
  values (u_acc, 'محمد أنور', 'accountant@demo.example.com', '0553100002', 'محاسب', d_hr, e_hr, 'resident', 'هندي', 'male', v_today - 300, 'fixed', v_today + 40, v_loc) returning id into e_acc;
  update public.departments set manager_employee_id = e_gm where id = d_top;
  update public.departments set manager_employee_id = e_sup where id = d_after;
  update public.departments set manager_employee_id = e_sales where id = d_sales;
  update public.departments set manager_employee_id = e_hr where id = d_hr;
  update public.departments set manager_employee_id = coalesce(manager_employee_id, e_emp) where id = d_proj;

  -- technicians with no employee file yet → report to the after-sales supervisor
  for t in select p.id, p.full_name, p.email, p.phone from public.profiles p
           where p.email like 'tech.%@demo.example.com' and not exists (select 1 from public.employees x where x.profile_id = p.id) order by p.email loop
    insert into public.employees (profile_id, full_name, email, phone, job_title, department_id, manager_id, nationality_type, nationality, gender, hire_date, work_location_id, remote_allowed, work_start, work_end)
    values (t.id, t.full_name, t.email, t.phone, 'فني صيانة', d_after, e_sup,
      case when t.email = 'tech.imran@demo.example.com' then 'resident' else 'saudi' end,
      case when t.email = 'tech.imran@demo.example.com' then 'باكستاني' else 'سعودي' end, 'male',
      v_today - (500 + (abs(hashtext(t.email)) % 900)), v_loc, true, '07:30', '16:30');
  end loop;

  -- salaries + bank details (demo IBANs)
  for e in select id, job_title, nationality_type from public.employees where email like '%@demo.example.com' and email <> 'tech.ahmed@demo.example.com' loop
    insert into public.employee_salaries (employee_id, basic, housing, transport, other_allowances)
    values (e.id,
      case e.job_title when 'المدير العام' then 30000 when 'مديرة الموارد البشرية' then 14000 when 'مشرفة خدمات ما بعد البيع' then 11000
        when 'أخصائي مبيعات عقارية' then 8000 when 'مهندسة مشاريع' then 12000 when 'محاسب' then 7000 else 4500 end, 0, 0, 0)
    on conflict (employee_id) do nothing;
    insert into public.employee_private (employee_id, id_number, id_expiry, iban, bank_name)
    values (e.id, case when e.nationality_type = 'saudi' then '10' else '24' end || lpad((abs(hashtext(e.id::text)) % 100000000)::text, 8, '0'),
      v_today + 200 + (abs(hashtext(e.id::text)) % 500),
      'SA' || lpad((abs(hashtext(e.id::text || 'iban')) % 100)::text, 2, '0') || '80000000' || lpad((abs(hashtext(e.id::text || 'acc')) % 1000000000000)::text, 14, '0'),
      (array['مصرف الراجحي', 'البنك الأهلي السعودي', 'بنك الرياض', 'مصرف الإنماء'])[1 + abs(hashtext(e.id::text)) % 4])
    on conflict (employee_id) do nothing;
  end loop;
  update public.employee_salaries s set housing = round(basic * 0.25), transport = round(basic * 0.10)
  from public.employees x where x.id = s.employee_id and x.email like '%@demo.example.com' and x.email <> 'tech.ahmed@demo.example.com';
  update public.employee_salaries set other_allowances = 500 where employee_id = e_sales;
  -- the accountant's ID expires soon (shows the expiry warning)
  update public.employee_private set id_expiry = v_today + 25 where employee_id = e_acc;

  -- attendance: every working day this month up to yesterday (+ today's check-ins); realistic lateness, a couple of absences
  for e in select x.id, x.email, coalesce(x.work_start, '08:00'::time) ws from public.employees x
           where x.email like '%@demo.example.com' and x.email not in ('gm@demo.example.com', 'tech.ahmed@demo.example.com') loop
    for day in select g::date from generate_series(v_start, v_today, interval '1 day') g loop
      continue when extract(isodow from day) in (5, 6) or public.holidays_between(day, day) > 0;
      -- planned absences without a request (tech.imran 2 days, tech.hassan 1 day)
      continue when e.email = 'tech.imran@demo.example.com' and day in (v_start + 7, v_start + 15);
      continue when e.email = 'tech.hassan@demo.example.com' and day = v_start + 13;
      late := case
        when e.email = 'sales@demo.example.com' and extract(day from day)::int % 4 = 0 then 25 + (abs(hashtext(e.email || day)) % 20)
        when e.email = 'tech.imran@demo.example.com' and extract(day from day)::int % 5 = 0 then 20 + (abs(hashtext(e.email || day)) % 25)
        else -10 + (abs(hashtext(e.email || day)) % 22) end;
      insert into public.attendance (employee_id, work_date, check_in_at, check_out_at, in_lat, in_lng, in_distance_m, location_id, source)
      values (e.id, day,
        (day + e.ws + make_interval(mins => late)) at time zone 'Asia/Riyadh',
        case when day = v_today then null else (day + e.ws + interval '9 hours' + make_interval(mins => abs(hashtext(e.email || day || 'o')) % 40)) at time zone 'Asia/Riyadh' end,
        21.5433 + ((abs(hashtext(e.email || day)) % 10) - 5) * 0.00008, 39.1728, abs(hashtext(e.email || day)) % 140, v_loc, 'gps')
      on conflict (employee_id, work_date) do nothing;
    end loop;
  end loop;
  -- today: one person has not checked in yet (shows on the attendance board)
  delete from public.attendance where work_date = v_today and employee_id = (select id from public.employees where email = 'tech.yousef@demo.example.com');
end $$;

select (select count(*) from public.employees where email like '%@demo.example.com') as demo_employees,
       (select count(*) from public.attendance a join public.employees x on x.id = a.employee_id where x.email like '%@demo.example.com') as attendance_rows;
