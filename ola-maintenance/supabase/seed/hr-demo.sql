-- =====================================================================
--  بيانات تجريبية للموارد البشرية — شغّله بعد: demo-data.sql و sales-demo.sql وملفات SQL رقم 8 و 9
--
--  ينشئ: موقع عمل، 5 إدارات، ملفات موظفين مرتبطة بالحسابات التجريبية (موظف الصيانة، الفنيين، المبيعات، الموارد البشرية)
--        + حساب موظف جديد  employee@demo.example.com  (كلمة المرور Demo@12345)
--        + رواتب، وحضور آخر أسبوعين، وطلبات بمراحل مختلفة.
--  ويُربط "المدير العام" بأول حساب إدارة لديك (ola@ola.com) ليعتمد الطلبات.
--  ⚠️ إحداثيات المكتب مثال — عدّلها من: الموارد البشرية ← الهيكل والمواقع
-- =====================================================================

create or replace function pg_temp.demo_user(p_email text, p_name text, p_role text, p_phone text)
returns uuid language plpgsql as $f$
declare v uuid;
begin
  select id into v from auth.users where email = p_email;
  if found then return v; end if;
  v := gen_random_uuid();
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated', p_email,
    extensions.crypt('Demo@12345', extensions.gen_salt('bf')), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', p_role),
    jsonb_build_object('full_name', p_name, 'phone', p_phone), now(), now(),
    '', '', '', '', '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v, v::text,
    jsonb_build_object('sub', v::text, 'email', p_email, 'email_verified', true), 'email', now(), now(), now());
  update public.profiles set full_name = p_name, phone = p_phone, role = p_role::public.app_role where id = v;
  return v;
end $f$;

create or replace function pg_temp.demo_as(p_uid uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  perform set_config('request.jwt.claims', case when p_uid is null then '' else json_build_object('sub', p_uid, 'role', 'authenticated')::text end, true);
end $f$;

do $$
declare
  v_loc uuid; d_top uuid; d_after uuid; d_sales uuid; d_hr uuid; d_proj uuid;
  e_gm uuid; e_hr uuid; e_sup uuid; e_sales uuid; e_emp uuid; e_acc uuid; e uuid;
  u record; v_admin uuid; v_emp_user uuid; day date; i int; v_ref text;
begin
  if exists (select 1 from public.employees where email like '%@demo.example.com') then
    raise exception 'بيانات الموارد البشرية التجريبية موجودة مسبقًا';
  end if;

  insert into public.work_locations (name, lat, lng, radius_m) values ('المكتب الرئيسي — جدة (مثال)', 21.5433, 39.1728, 200) returning id into v_loc;

  insert into public.departments (name) values ('الإدارة العليا') returning id into d_top;
  insert into public.departments (name, parent_id) values ('خدمات ما بعد البيع', d_top) returning id into d_after;
  insert into public.departments (name, parent_id) values ('المبيعات', d_top) returning id into d_sales;
  insert into public.departments (name, parent_id) values ('الموارد البشرية', d_top) returning id into d_hr;
  insert into public.departments (name, parent_id) values ('المشاريع', d_top) returning id into d_proj;

  -- general manager = first company admin account (so approvals reach you)
  select id into v_admin from public.profiles where role = 'admin' and is_active and coalesce(email, '') not like '%@demo.example.com' order by created_at limit 1;
  insert into public.employees (profile_id, full_name, email, phone, job_title, department_id, nationality_type, hire_date, annual_leave_days, work_location_id, remote_allowed)
  values (v_admin, 'المدير العام', 'gm@demo.example.com', '0550000001', 'المدير العام', d_top, 'saudi', current_date - 4200, 30, v_loc, true)
  returning id into e_gm;
  update public.departments set manager_employee_id = e_gm where id = d_top;

  insert into public.employees (profile_id, full_name, email, phone, job_title, department_id, manager_id, nationality_type, gender, hire_date, work_location_id)
  select p.id, 'منى الحربي', 'hr@demo.example.com', '0551000002', 'مديرة الموارد البشرية', d_hr, e_gm, 'saudi', 'female', current_date - 1500, v_loc
  from public.profiles p where p.email = 'hr@demo.example.com' returning id into e_hr;
  if e_hr is null then
    insert into public.employees (full_name, email, job_title, department_id, manager_id, gender, hire_date, work_location_id)
    values ('منى الحربي', 'hr@demo.example.com', 'مديرة الموارد البشرية', d_hr, e_gm, 'female', current_date - 1500, v_loc) returning id into e_hr;
  end if;
  update public.departments set manager_employee_id = e_hr where id = d_hr;

  insert into public.employees (profile_id, full_name, email, phone, job_title, department_id, manager_id, nationality_type, hire_date, work_location_id)
  select p.id, p.full_name, p.email, p.phone, 'مشرفة خدمات ما بعد البيع', d_after, e_gm, 'saudi', current_date - 1100, v_loc
  from public.profiles p where p.email = 'supervisor@demo.example.com' returning id into e_sup;
  update public.departments set manager_employee_id = e_sup where id = d_after;
  update public.employees set gender = 'female' where id = e_sup;

  -- technicians report to the after-sales supervisor; field staff may check in anywhere
  for u in select p.id, p.full_name, p.email, p.phone from public.profiles p where p.email like 'tech.%@demo.example.com' order by p.email loop
    insert into public.employees (profile_id, full_name, email, phone, job_title, department_id, manager_id, nationality_type, nationality, hire_date, work_location_id, remote_allowed, work_start, work_end)
    values (u.id, u.full_name, u.email, u.phone, 'فني صيانة', d_after, e_sup,
      case when u.email in ('tech.imran@demo.example.com', 'tech.ahmed@demo.example.com') then 'resident' else 'saudi' end,
      case when u.email = 'tech.imran@demo.example.com' then 'باكستاني' when u.email = 'tech.ahmed@demo.example.com' then 'مصري' else 'سعودي' end,
      current_date - (500 + (random() * 900)::int), v_loc, true, '07:30', '16:30');
  end loop;

  insert into public.employees (profile_id, full_name, email, phone, job_title, department_id, manager_id, hire_date, work_location_id)
  select p.id, p.full_name, p.email, p.phone, 'أخصائي مبيعات عقارية', d_sales, e_gm, current_date - 800, v_loc
  from public.profiles p where p.email = 'sales@demo.example.com' returning id into e_sales;
  update public.departments set manager_employee_id = e_sales where id = d_sales;

  v_emp_user := pg_temp.demo_user('employee@demo.example.com', 'ريم السبيعي', 'employee', '0553100001');
  insert into public.employees (profile_id, full_name, email, phone, job_title, department_id, manager_id, gender, hire_date, work_location_id)
  values (v_emp_user, 'ريم السبيعي', 'employee@demo.example.com', '0553100001', 'مهندسة مشاريع', d_proj, e_gm, 'female', current_date - 620, v_loc)
  returning id into e_emp;

  insert into public.employees (full_name, email, phone, job_title, department_id, manager_id, nationality_type, nationality, hire_date, contract_type, contract_end, work_location_id)
  values ('محمد أنور', 'anwar@demo.example.com', '0553100002', 'محاسب', d_hr, e_hr, 'resident', 'هندي', current_date - 300, 'fixed', current_date + 40, v_loc)
  returning id into e_acc;
  insert into public.employee_private (employee_id, id_number, id_expiry, iban, bank_name) values (e_acc, '2400000000', current_date + 25, 'SA0380000000608010167519', 'مصرف الراجحي');

  -- salaries
  insert into public.employee_salaries (employee_id, basic, housing, transport, other_allowances)
  select id,
    case job_title when 'المدير العام' then 30000 when 'مديرة الموارد البشرية' then 14000 when 'مشرفة خدمات ما بعد البيع' then 11000
      when 'أخصائي مبيعات عقارية' then 8000 when 'مهندسة مشاريع' then 12000 when 'محاسب' then 7000 else 4500 end,
    0, 0, 0
  from public.employees where email like '%@demo.example.com'
  on conflict (employee_id) do nothing;
  update public.employee_salaries set housing = round(basic * 0.25), transport = round(basic * 0.10)
  where employee_id in (select id from public.employees where email like '%@demo.example.com');
  update public.employee_salaries set other_allowances = 500 where employee_id = e_sales;

  -- attendance: last 14 days (Sun–Thu) for everyone except the GM
  for e in select id from public.employees where email like '%@demo.example.com' and id <> e_gm loop
    for i in 1 .. 14 loop
      day := public.today_riyadh() - i;
      continue when extract(isodow from day) in (5, 6) or random() < 0.08;
      insert into public.attendance (employee_id, work_date, check_in_at, check_out_at, in_lat, in_lng, in_distance_m, location_id, source)
      values (e, day,
        (day + time '07:45' + make_interval(mins => (random() * 40)::int)) at time zone 'Asia/Riyadh',
        (day + time '16:55' + make_interval(mins => (random() * 45)::int)) at time zone 'Asia/Riyadh',
        21.5433, 39.1728, (random() * 120)::int, v_loc, 'gps')
      on conflict do nothing;
    end loop;
  end loop;

  -- requests through the real workflow
  perform pg_temp.demo_as(v_emp_user);
  v_ref := public.submit_hr_request(jsonb_build_object('type', 'leave', 'leave_type', 'annual',
    'start_date', public.today_riyadh() + 20, 'end_date', public.today_riyadh() + 26, 'reason', 'إجازة عائلية'));
  v_ref := public.submit_hr_request(jsonb_build_object('type', 'salary_certificate', 'addressed_to', 'البنك الأهلي السعودي'));
  perform public.submit_hr_request(jsonb_build_object('type', 'overtime', 'work_date', public.today_riyadh() - 2, 'hours', 3, 'reason', 'استلام مرحلة الصبة في عُلا 24'));

  select profile_id into v_admin from public.employees where id = e_sup;
  for u in select p.id from public.profiles p where p.email = 'tech.yousef@demo.example.com' loop
    perform pg_temp.demo_as(u.id);
    perform public.submit_hr_request(jsonb_build_object('type', 'attendance_correction', 'work_date', public.today_riyadh() - 1,
      'time_in', '07:40', 'time_out', '16:35', 'reason', 'نسيت تسجيل البصمة — كنت في موقع عُلا 21'));
  end loop;
  for u in select p.id from public.profiles p where p.email = 'sales@demo.example.com' loop
    perform pg_temp.demo_as(u.id);
    perform public.submit_hr_request(jsonb_build_object('type', 'salary_certificate', 'addressed_to', 'إلى من يهمه الأمر'));
  end loop;
  -- HR approves the sales certificate so the printable letter can be seen
  for u in select p.id from public.profiles p where p.email = 'hr@demo.example.com' loop
    perform pg_temp.demo_as(u.id);
    perform public.decide_hr_request(r.id, true, null)
    from public.hr_requests r join public.employees em on em.id = r.employee_id
    where em.email = 'sales@demo.example.com' and r.type = 'salary_certificate' and r.status = 'pending';
  end loop;
  perform pg_temp.demo_as(null);
end $$;

select 'تم — employee@demo.example.com / Demo@12345 · المدير العام مرتبط بحساب الإدارة' as result;
