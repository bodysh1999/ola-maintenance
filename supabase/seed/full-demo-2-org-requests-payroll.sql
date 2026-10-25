-- =====================================================================
--  عرض كامل (2-4): شغّله بعد full-demo-1-hr.sql — كل الحسابات @demo.example.com / Demo@12345
--  يُحذف كله بـ demo-purge.sql قبل التشغيل الفعلي
-- =====================================================================

-- (2/4) طلبات الموظفين والعهد عبر سير العمل الحقيقي
create or replace function pg_temp.act(p_email text) returns uuid language plpgsql as $f$
declare v uuid;
begin
  select id into v from public.profiles where email = p_email;
  perform set_config('request.jwt.claim.sub', coalesce(v::text, ''), true);
  perform set_config('request.jwt.claims', case when v is null then '' else json_build_object('sub', v, 'role', 'authenticated')::text end, true);
  return v;
end $f$;

create or replace function pg_temp.approve(p_ref text, p_steps int default 99) returns void language plpgsql as $f$
declare r record; s record; n int := 0; v_email text;
begin
  loop
    select * into r from public.hr_requests where ref_no = p_ref;
    exit when r.status <> 'pending' or n >= p_steps;
    select * into s from public.hr_request_steps where request_id = r.id and step = r.current_step;
    if s.approver_kind = 'hr' then v_email := 'hr@demo.example.com';
    else select p.email into v_email from public.employees e join public.profiles p on p.id = e.profile_id where e.id = s.approver_employee_id; end if;
    perform pg_temp.act(v_email);
    perform public.decide_hr_request(r.id, true, case when n = 0 then 'موافق' else null end);
    n := n + 1;
  end loop;
  perform pg_temp.act(null);
end $f$;

do $$
declare
  v_today date := public.today_riyadh(); m date := date_trunc('month', public.today_riyadh())::date;
  ref text; e_reem uuid; e_hassan uuid; e_imran uuid; e_sales uuid; e_sup uuid; e_acc uuid; c uuid; v_hr uuid;
begin
  if exists (select 1 from public.hr_requests r join public.employees e on e.id = r.employee_id where e.email = 'employee@demo.example.com') then
    raise notice 'part 2 already done'; return;
  end if;
  select id into e_reem from public.employees where email = 'employee@demo.example.com';
  select id into e_hassan from public.employees where email = 'tech.hassan@demo.example.com';
  select id into e_imran from public.employees where email = 'tech.imran@demo.example.com';
  select id into e_sales from public.employees where email = 'sales@demo.example.com';
  select id into e_sup from public.employees where email = 'supervisor@demo.example.com';
  select id into e_acc from public.employees where email = 'accountant@demo.example.com';
  select id into v_hr from public.profiles where email = 'hr@demo.example.com';

  -- custody approval rule: manager → accountant → HR (manager's manager only from 10,000)
  update public.approval_chains set steps = jsonb_build_array(
      jsonb_build_object('kind', 'manager'), jsonb_build_object('kind', 'employee', 'employee_id', e_acc),
      jsonb_build_object('kind', 'manager2', 'min_amount', 10000), jsonb_build_object('kind', 'hr')),
    max_amount = 20000, updated_at = now() where type = 'custody';

  -- leave already taken this month (approved) + next month (pending)
  delete from public.attendance where employee_id = e_reem and work_date between m + 11 and m + 13;
  perform pg_temp.act('employee@demo.example.com');
  ref := public.submit_hr_request(jsonb_build_object('type', 'leave', 'leave_type', 'annual', 'start_date', m + 11, 'end_date', m + 13, 'reason', 'ظرف عائلي'));
  perform pg_temp.approve(ref);
  perform pg_temp.act('employee@demo.example.com');
  perform public.submit_hr_request(jsonb_build_object('type', 'leave', 'leave_type', 'annual', 'start_date', v_today + 22, 'end_date', v_today + 25, 'reason', 'سفر'));
  perform pg_temp.act('employee@demo.example.com');
  perform public.submit_hr_request(jsonb_build_object('type', 'experience_letter', 'addressed_to', 'إلى من يهمه الأمر'));

  -- overtime (approved), business trip (approved), unpaid leave (approved), attendance correction (pending)
  perform pg_temp.act('tech.yousef@demo.example.com');
  ref := public.submit_hr_request(jsonb_build_object('type', 'overtime', 'work_date', m + 19, 'hours', 4, 'reason', 'طوارئ تسريب مياه في عُلا 21 بعد الدوام'));
  perform pg_temp.approve(ref);
  delete from public.attendance where employee_id = e_hassan and work_date between m + 5 and m + 6;
  perform pg_temp.act('tech.hassan@demo.example.com');
  ref := public.submit_hr_request(jsonb_build_object('type', 'business_trip', 'start_date', m + 5, 'end_date', m + 6, 'destination', 'مكة المكرمة — معاينة مشروع', 'reason', 'معاينة أعمال التشطيب'));
  perform pg_temp.approve(ref);
  delete from public.attendance where employee_id = e_imran and work_date between m + 18 and m + 19;
  perform pg_temp.act('tech.imran@demo.example.com');
  ref := public.submit_hr_request(jsonb_build_object('type', 'leave', 'leave_type', 'unpaid', 'start_date', m + 18, 'end_date', m + 19, 'reason', 'ظرف خاص'));
  perform pg_temp.approve(ref);
  perform pg_temp.act('tech.imran@demo.example.com');
  perform public.submit_hr_request(jsonb_build_object('type', 'attendance_correction', 'work_date', m + 15, 'time_in', '07:35', 'time_out', '16:30', 'reason', 'كنت في موقع عُلا 17 ولم يعمل التطبيق'));

  -- salary advance + salary certificate (approved)
  perform pg_temp.act('sales@demo.example.com');
  ref := public.submit_hr_request(jsonb_build_object('type', 'salary_advance', 'amount', 2000, 'reason', 'ظرف طارئ'));
  perform pg_temp.approve(ref);
  perform pg_temp.act('sales@demo.example.com');
  ref := public.submit_hr_request(jsonb_build_object('type', 'salary_certificate', 'addressed_to', 'البنك الأهلي السعودي'));
  perform pg_temp.approve(ref);

  -- custody 1: technician, open with expenses in every state
  perform pg_temp.act('tech.hassan@demo.example.com');
  ref := public.submit_custody_request(5000, 'مشتريات قطع غيار وصيانة — مشروع عُلا 21');
  perform pg_temp.approve(ref);
  select id into c from public.custodies where ref_no = ref;
  insert into public.custody_expenses (custody_id, kind, category, description, vendor, invoice_no, amount, expense_date, status, reviewed_by, reviewed_at, review_note) values
    (c, 'invoice', 'materials', 'محابس وخلاطات وتمديدات', 'مؤسسة الأدوات الصحية', 'INV-20458', 1850, v_today - 9, 'approved', v_hr, now(), null),
    (c, 'no_invoice', 'labor', 'أجور سبّاك مساعد — يومين', null, null, 600, v_today - 8, 'approved', v_hr, now(), null),
    (c, 'invoice', 'materials', 'لمبات LED ومفاتيح', 'محل النور للكهرباء', 'A-7781', 420, v_today - 6, 'rejected', v_hr, now(), 'الفاتورة باسم شخص آخر — أعد رفعها باسم الشركة'),
    (c, 'no_invoice', 'cleaning', 'تنظيف شقة A-302 بعد أعمال الصيانة', null, null, 350, v_today - 2, 'pending', null, null, null),
    (c, 'invoice', 'transport', 'نقل مواد للموقع', 'نقليات الساحل', '1192', 180, v_today - 1, 'pending', null, null, null);

  -- custody 2: sales, settlement requested
  perform pg_temp.act('sales@demo.example.com');
  ref := public.submit_custody_request(3000, 'ضيافة وتجهيز معرض عُلا 25');
  perform pg_temp.approve(ref);
  select id into c from public.custodies where ref_no = ref;
  insert into public.custody_expenses (custody_id, kind, category, description, vendor, invoice_no, amount, expense_date, status, reviewed_by, reviewed_at) values
    (c, 'invoice', 'hospitality', 'ضيافة زوار المعرض — 3 أيام', 'بن وضيافة', 'H-332', 1240, v_today - 12, 'approved', v_hr, now()),
    (c, 'invoice', 'materials', 'مطبوعات ورول أب', 'مطبعة جدة', 'P-901', 980, v_today - 13, 'approved', v_hr, now()),
    (c, 'no_invoice', 'transport', 'نقل وتركيب الاستاند', null, null, 300, v_today - 12, 'approved', v_hr, now());
  update public.custodies set status = 'settlement_requested', settlement_requested_at = now() - interval '1 day' where id = c;

  -- custody 3: supervisor, closed
  perform pg_temp.act('supervisor@demo.example.com');
  ref := public.submit_custody_request(2000, 'مستلزمات طوارئ لفريق الصيانة');
  perform pg_temp.approve(ref);
  select id into c from public.custodies where ref_no = ref;
  update public.custodies set issued_at = now() - interval '20 days' where id = c;
  insert into public.custody_expenses (custody_id, kind, category, description, vendor, invoice_no, amount, expense_date, status, reviewed_by, reviewed_at) values
    (c, 'invoice', 'maintenance', 'عدة وأدوات فنية', 'الساعد للعدد', 'T-55', 1450, v_today - 19, 'approved', v_hr, now()),
    (c, 'invoice', 'fuel', 'وقود سيارة الصيانة', 'محطة الدريس', 'F-1180', 400, v_today - 15, 'approved', v_hr, now());
  update public.custodies set status = 'closed', returned_amount = 150, closed_at = now() - interval '3 days', closed_by = v_hr,
    close_note = 'تم استلام المتبقي نقدًا' where id = c;

  -- custody 4: engineer, waiting at the accountant step
  perform pg_temp.act('employee@demo.example.com');
  ref := public.submit_custody_request(8000, 'مصاريف استلام وحدات عُلا 24 (فحص ومعالجة ملاحظات)');
  perform pg_temp.approve(ref, 1);

  perform pg_temp.act(null);
end $$;

select r.ref_no, e.full_name, r.type, r.status, r.current_step from public.hr_requests r join public.employees e on e.id = r.employee_id where e.email like '%@demo.example.com' order by r.created_at;

-- (3/4) الهيكل التنظيمي الكامل: 30 وظيفة في 7 إدارات
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
  v_today date := public.today_riyadh(); m date := date_trunc('month', public.today_riyadh())::date;
  v_loc uuid; d_top uuid; d_fin uuid; d_proj uuid; d_sales uuid; d_maint uuid; d_hr uuid; d_it uuid;
  e_chair uuid; e_ceo uuid; e_cfo uuid; e_pm uuid; e_smgr uuid; e_ssup uuid; e_mmgr uuid; e_msup uuid; e_hrm uuid; e_it uuid; e_civil uuid;
  r record; v_uid uuid; v_emp uuid; v_mgr uuid; day date; late int;
begin
  if exists (select 1 from public.employees where email = 'chairman@demo.example.com') then raise notice 'org already built'; return; end if;
  select id into v_loc from public.work_locations where name = 'المكتب الرئيسي — جدة' limit 1;

  -- departments (7)
  select id into d_top from public.departments where name = 'الإدارة العليا' limit 1;
  update public.departments set name = 'الصيانة وخدمات ما بعد البيع' where name = 'خدمات ما بعد البيع' returning id into d_maint;
  select id into d_sales from public.departments where name = 'المبيعات والتسويق' limit 1;
  update public.departments set name = 'الموارد البشرية والشؤون الإدارية' where name = 'الموارد البشرية والمالية' returning id into d_hr;
  update public.departments set name = 'المشاريع والتطوير العقاري', parent_id = d_top where name = 'المشاريع' returning id into d_proj;
  insert into public.departments (name, parent_id) values ('المالية والمشتريات', d_top) returning id into d_fin;
  insert into public.departments (name, parent_id) values ('تقنية المعلومات', d_top) returning id into d_it;

  -- 1) chairman (top manager) and 2) CEO (existing admin demo account)
  v_uid := pg_temp.demo_user('chairman@demo.example.com', 'عبدالعزيز الشهري', 'admin', '0550000100');
  insert into public.employees (profile_id, full_name, email, phone, job_title, department_id, nationality_type, nationality, gender, hire_date, annual_leave_days, work_location_id, remote_allowed)
  values (v_uid, 'عبدالعزيز الشهري', 'chairman@demo.example.com', '0550000100', 'المالك / رئيس مجلس الإدارة', d_top, 'saudi', 'سعودي', 'male', v_today - 6000, 30, v_loc, true) returning id into e_chair;
  update public.employees set job_title = 'الرئيس التنفيذي (CEO)', manager_id = e_chair where email = 'gm@demo.example.com' returning id into e_ceo;
  update public.departments set manager_employee_id = e_chair where id = d_top;

  -- existing demo staff into their positions
  update public.employees set job_title = 'مدير الموارد البشرية والشؤون الإدارية', department_id = d_hr, manager_id = e_ceo where email = 'hr@demo.example.com' returning id into e_hrm;
  update public.employees set job_title = 'مشرف الصيانة', department_id = d_maint where email = 'supervisor@demo.example.com' returning id into e_msup;
  update public.employees set job_title = 'مهندسة مدنية', department_id = d_proj where email = 'employee@demo.example.com' returning id into e_civil;
  update public.employees set job_title = 'محاسب عام', department_id = d_fin where email = 'accountant@demo.example.com';
  update public.employees set job_title = 'أخصائي مبيعات عقارية', department_id = d_sales where email = 'sales@demo.example.com';
  update public.employees set job_title = 'فني كهرباء', department_id = d_maint where email = 'tech.hassan@demo.example.com';
  update public.employees set job_title = 'فني سباكة', department_id = d_maint where email = 'tech.yousef@demo.example.com';
  update public.employees set job_title = 'فني تكييف', department_id = d_maint where email = 'tech.imran@demo.example.com';

  -- new positions: email, name, system role, title, department, manager key, gender, nationality type, basic
  create temp table _org (ord int, email text, name text, role text, title text, dept text, mgr text, gender text, nat text, basic numeric) on commit drop;
  insert into _org values
   (3,  'cfo@demo.example.com',         'نايف القرشي',     'employee',   'المدير المالي',                      'fin',   'ceo',   'male',   'saudi',    22000),
   (4,  'finance@demo.example.com',     'أمجد الحارثي',    'employee',   'أخصائي مالي',                        'fin',   'cfo',   'male',   'saudi',    9000),
   (6,  'procurement@demo.example.com', 'وليد باسلامة',    'employee',   'أخصائي مشتريات',                     'fin',   'cfo',   'male',   'saudi',    8000),
   (7,  'contracts@demo.example.com',   'هالة الزهراني',   'employee',   'أخصائي عقود وموردين',                'fin',   'cfo',   'female', 'saudi',    8500),
   (8,  'pm@demo.example.com',          'م. فارس العمري',  'employee',   'مدير المشاريع',                      'proj',  'ceo',   'male',   'saudi',    24000),
   (10, 'architect@demo.example.com',   'م. لينا كعكي',    'employee',   'مهندس معماري',                       'proj',  'pm',    'female', 'saudi',    13000),
   (11, 'mep@demo.example.com',         'م. سامر حداد',    'employee',   'مهندس كهرباء وميكانيكا',             'proj',  'pm',    'male',   'resident', 12500),
   (12, 'site@demo.example.com',        'ماجد الحربي',     'employee',   'مشرف موقع',                          'proj',  'civil', 'male',   'saudi',    9500),
   (13, 'qc@demo.example.com',          'إبراهيم عسيري',   'employee',   'مراقب جودة واستلام',                 'proj',  'pm',    'male',   'saudi',    9000),
   (14, 'salesmgr@demo.example.com',    'رنا الدباغ',      'sales',      'مدير المبيعات والتسويق',             'sales', 'ceo',   'female', 'saudi',    20000),
   (15, 'salessup@demo.example.com',    'عمر بخاري',       'sales',      'مشرف المبيعات',                      'sales', 'smgr',  'male',   'saudi',    11000),
   (17, 'marketing@demo.example.com',   'شهد المطيري',     'employee',   'أخصائي تسويق رقمي',                  'sales', 'smgr',  'female', 'saudi',    8000),
   (18, 'cx@demo.example.com',          'نوف القحطاني',    'sales',      'أخصائي علاقات العملاء',              'sales', 'ssup',  'female', 'saudi',    7500),
   (19, 'maintmgr@demo.example.com',    'م. طارق السلمي',  'supervisor', 'مدير الصيانة',                       'maint', 'ceo',   'male',   'saudi',    19000),
   (20, 'mainteng@demo.example.com',    'م. يزن الأحمدي',  'supervisor', 'مهندس صيانة',                        'maint', 'mmgr',  'male',   'saudi',    12000),
   (25, 'tech.fahad@demo.example.com',  'فهد البلوي',      'technician', 'فني تشطيبات',                        'maint', 'msup',  'male',   'saudi',    4500),
   (27, 'hrspec@demo.example.com',      'دانة الجهني',     'hr',         'أخصائي موارد بشرية',                 'hr',    'hrm',   'female', 'saudi',    9000),
   (28, 'personnel@demo.example.com',   'سعود العنزي',     'hr',         'مسؤول شؤون موظفين',                  'hr',    'hrm',   'male',   'saudi',    7500),
   (29, 'it@demo.example.com',          'أنس الغامدي',     'admin',      'مسؤول تقنية المعلومات',              'it',    'ceo',   'male',   'saudi',    15000),
   (30, 'support@demo.example.com',     'زياد الثقفي',     'employee',   'أخصائي دعم فني وأنظمة',              'it',    'it',    'male',   'saudi',    8000);

  for r in select * from _org order by ord loop
    v_mgr := case r.mgr when 'ceo' then e_ceo when 'cfo' then e_cfo when 'pm' then e_pm when 'civil' then e_civil when 'smgr' then e_smgr
      when 'ssup' then e_ssup when 'mmgr' then e_mmgr when 'msup' then e_msup when 'hrm' then e_hrm when 'it' then e_it end;
    v_uid := pg_temp.demo_user(r.email, r.name, r.role, '055' || lpad((2000000 + r.ord)::text, 7, '0'));
    insert into public.employees (profile_id, full_name, email, phone, job_title, department_id, manager_id, nationality_type, nationality, gender, hire_date, work_location_id, remote_allowed, work_start, work_end)
    values (v_uid, r.name, r.email, '055' || lpad((2000000 + r.ord)::text, 7, '0'), r.title,
      case r.dept when 'fin' then d_fin when 'proj' then d_proj when 'sales' then d_sales when 'maint' then d_maint when 'hr' then d_hr when 'it' then d_it end,
      v_mgr, r.nat, case when r.nat = 'saudi' then 'سعودي' else 'أردني' end, r.gender, v_today - (400 + abs(hashtext(r.email)) % 2200), v_loc,
      r.dept in ('proj', 'maint'), case when r.role = 'technician' then '07:30'::time else '08:00'::time end, case when r.role = 'technician' then '16:30'::time else '17:00'::time end)
    returning id into v_emp;
    case r.mgr when 'x' then null; else null; end case;
    if r.email = 'cfo@demo.example.com' then e_cfo := v_emp; update public.departments set manager_employee_id = v_emp where id = d_fin; end if;
    if r.email = 'pm@demo.example.com' then e_pm := v_emp; update public.departments set manager_employee_id = v_emp where id = d_proj;
      update public.employees set manager_id = v_emp where id = e_civil; end if;
    if r.email = 'salesmgr@demo.example.com' then e_smgr := v_emp; update public.departments set manager_employee_id = v_emp where id = d_sales; end if;
    if r.email = 'salessup@demo.example.com' then e_ssup := v_emp; update public.employees set manager_id = v_emp where email = 'sales@demo.example.com'; end if;
    if r.email = 'maintmgr@demo.example.com' then e_mmgr := v_emp; update public.departments set manager_employee_id = v_emp where id = d_maint;
      update public.employees set manager_id = v_emp where id = e_msup; end if;
    if r.email = 'it@demo.example.com' then e_it := v_emp; update public.departments set manager_employee_id = v_emp where id = d_it; end if;
    -- salary + bank details
    insert into public.employee_salaries (employee_id, basic, housing, transport, other_allowances) values (v_emp, r.basic, round(r.basic * 0.25), round(r.basic * 0.10), 0);
    insert into public.employee_private (employee_id, id_number, id_expiry, iban, bank_name)
    values (v_emp, case when r.nat = 'saudi' then '10' else '24' end || lpad((abs(hashtext(r.email)) % 100000000)::text, 8, '0'), v_today + 120 + abs(hashtext(r.email)) % 700,
      'SA' || lpad((abs(hashtext(r.email || 'i')) % 100)::text, 2, '0') || '80000000' || lpad((abs(hashtext(r.email || 'a')) % 1000000000)::text, 14, '0'),
      (array['مصرف الراجحي', 'البنك الأهلي السعودي', 'بنك الرياض', 'مصرف الإنماء'])[1 + abs(hashtext(r.email)) % 4]);
    -- technician record for field staff
    if r.role = 'technician' then
      insert into public.technicians (profile_id, full_name, phone, specialties) values (v_uid, r.name, '055' || lpad((2000000 + r.ord)::text, 7, '0'), '{tiles,painting,doors_windows}');
    end if;
    -- attendance this month
    for day in select g::date from generate_series(m, v_today, interval '1 day') g loop
      continue when extract(isodow from day) in (5, 6) or public.holidays_between(day, day) > 0;
      late := -12 + (abs(hashtext(r.email || day)) % (case when r.ord in (12, 18) then 40 else 24 end));
      insert into public.attendance (employee_id, work_date, check_in_at, check_out_at, in_lat, in_lng, in_distance_m, location_id, source)
      values (v_emp, day,
        (day + (case when r.role = 'technician' then '07:30'::time else '08:00'::time end) + make_interval(mins => late)) at time zone 'Asia/Riyadh',
        case when day = v_today then null else (day + (case when r.role = 'technician' then '16:35'::time else '17:05'::time end) + make_interval(mins => abs(hashtext(r.email || day || 'o')) % 35)) at time zone 'Asia/Riyadh' end,
        21.5433, 39.1728, abs(hashtext(r.email || day)) % 150, v_loc, 'gps')
      on conflict (employee_id, work_date) do nothing;
    end loop;
  end loop;

  -- CEO/chairman salaries
  update public.employee_salaries set basic = 35000, housing = 8750, transport = 3500 where employee_id = e_ceo;
  insert into public.employee_salaries (employee_id, basic, housing, transport) values (e_chair, 45000, 11250, 4500) on conflict do nothing;
  insert into public.employee_private (employee_id, id_number, iban, bank_name) values (e_chair, '1000000100', 'SA4480000000000000000100', 'البنك الأهلي السعودي') on conflict do nothing;

  -- custody rule: manager → accountant → CFO from 10,000 → HR
  update public.approval_chains set steps = jsonb_build_array(
      jsonb_build_object('kind', 'manager'),
      jsonb_build_object('kind', 'employee', 'employee_id', (select id from public.employees where email = 'accountant@demo.example.com')),
      jsonb_build_object('kind', 'employee', 'employee_id', e_cfo, 'min_amount', 10000),
      jsonb_build_object('kind', 'hr')) where type = 'custody';
end $$;

select d.name as dept, count(e.id) as staff, string_agg(e.job_title, '، ' order by e.job_title) as titles
from public.departments d left join public.employees e on e.department_id = d.id and e.email like '%@demo.example.com'
group by d.name order by d.name;

-- (4/4) طلبات على مكاتب المدراء + مسيرات الرواتب + العملاء المحتملون + وحدات الملاك
create or replace function pg_temp.act(p_email text) returns uuid language plpgsql as $f$
declare v uuid;
begin
  select id into v from public.profiles where email = p_email;
  perform set_config('request.jwt.claim.sub', coalesce(v::text, ''), true);
  perform set_config('request.jwt.claims', case when v is null then '' else json_build_object('sub', v, 'role', 'authenticated')::text end, true);
  return v;
end $f$;
create or replace function pg_temp.approve(p_ref text, p_steps int default 99) returns void language plpgsql as $f$
declare r record; s record; n int := 0; v_email text;
begin
  loop
    select * into r from public.hr_requests where ref_no = p_ref;
    exit when r.status <> 'pending' or n >= p_steps;
    select * into s from public.hr_request_steps where request_id = r.id and step = r.current_step;
    if s.approver_kind = 'hr' then v_email := 'hr@demo.example.com';
    else select p.email into v_email from public.employees e join public.profiles p on p.id = e.profile_id where e.id = s.approver_employee_id; end if;
    perform pg_temp.act(v_email);
    perform public.decide_hr_request(r.id, true, null);
    n := n + 1;
  end loop;
  perform pg_temp.act(null);
end $f$;

do $$
declare
  v_today date := public.today_riyadh(); m date := date_trunc('month', public.today_riyadh())::date;
  prev text := to_char(date_trunc('month', public.today_riyadh()) - interval '1 month', 'YYYY-MM');
  cur text := to_char(public.today_riyadh(), 'YYYY-MM');
  ref text; v_run uuid; v_sales uuid; o record; u record; i int := 0; v_proj uuid;
begin
  if exists (select 1 from public.payroll_runs where period = prev) then raise notice 'part 4 already done'; return; end if;

  -- requests waiting on different managers (so every manager has something in their approvals inbox)
  perform pg_temp.act('architect@demo.example.com');
  perform public.submit_hr_request(jsonb_build_object('type', 'leave', 'leave_type', 'annual', 'start_date', v_today + 10, 'end_date', v_today + 14, 'reason', 'إجازة سنوية'));
  perform pg_temp.act('qc@demo.example.com');
  perform public.submit_hr_request(jsonb_build_object('type', 'overtime', 'work_date', v_today - 3, 'hours', 3, 'reason', 'استلام وحدات عُلا 24 مع المالك بعد الدوام'));
  perform pg_temp.act('marketing@demo.example.com');
  perform public.submit_hr_request(jsonb_build_object('type', 'business_trip', 'start_date', v_today + 5, 'end_date', v_today + 6, 'destination', 'الرياض — معرض سيتي سكيب', 'reason', 'تمثيل الشركة في المعرض'));
  perform pg_temp.act('site@demo.example.com');
  ref := public.submit_hr_request(jsonb_build_object('type', 'overtime', 'work_date', m + 14, 'hours', 5, 'reason', 'صبّة سقف الدور الثالث — عُلا 25'));
  perform pg_temp.approve(ref);
  perform pg_temp.act('procurement@demo.example.com');
  ref := public.submit_custody_request(12000, 'شراء عينات تشطيب ومواد لمشروع عُلا 24');
  perform pg_temp.approve(ref, 2);   -- passed manager + accountant → waiting at the CFO
  perform pg_temp.act('support@demo.example.com');
  perform public.submit_hr_request(jsonb_build_object('type', 'salary_certificate', 'addressed_to', 'سفارة المملكة المتحدة'));

  -- payroll: last month approved + paid (payslips visible), this month draft with bonus/deduction
  perform pg_temp.act('hr@demo.example.com');
  v_run := public.generate_payroll(prev, false);
  perform pg_temp.act('chairman@demo.example.com');
  perform public.set_payroll_status(v_run, 'approved');
  perform pg_temp.act('hr@demo.example.com');
  perform public.set_payroll_status(v_run, 'paid');
  perform public.add_payroll_adjustment(cur, (select id from public.employees where email = 'tech.yousef@demo.example.com'), 'bonus', 1000, 'تقييم ممتاز من الملاك هذا الشهر');
  perform public.add_payroll_adjustment(cur, (select id from public.employees where email = 'salesmgr@demo.example.com'), 'bonus', 5000, 'عمولة بيع 4 وحدات في عُلا 25');
  perform public.add_payroll_adjustment(cur, (select id from public.employees where email = 'tech.imran@demo.example.com'), 'deduction', 300, 'مخالفة تعليمات السلامة في الموقع');
  perform public.add_payroll_adjustment(cur, (select id from public.employees where email = 'site@demo.example.com'), 'allowance', 800, 'بدل موقع بعيد');
  perform public.generate_payroll(cur, true);
  perform pg_temp.act(null);

  -- leads across the pipeline, assigned to the sales team with follow-ups
  select id into v_sales from public.profiles where email = 'sales@demo.example.com';
  select id into v_proj from public.projects where name_ar like 'عُلا 25' limit 1;
  insert into public.leads (kind, project_id, full_name, phone, email, city, preferred_date, preferred_time, message, status, assigned_to, follow_up_at, internal_notes) values
    ('visit',   v_proj, 'بندر الحربي',   '0561112233', 'bandar@example.com', 'جدة', v_today + 2, 'مساءً', 'أرغب بزيارة الشقق النموذجية', 'new', null, null, null),
    ('booking', v_proj, 'مها السليمان',  '0562223344', null, 'جدة', v_today + 1, 'صباحًا', 'مهتمة بوحدة 4 غرف', 'contacted', v_sales, v_today, 'تفضل الدور الثالث'),
    ('visit',   v_proj, 'خالد بن محفوظ', '0563334455', null, 'مكة', v_today - 2, 'مساءً', null, 'visited', v_sales, v_today + 1, 'زار الموقع وأعجبه المشروع'),
    ('inquiry', null,   'عائشة الفيفي',  '0564445566', 'aisha@example.com', 'جدة', null, null, 'هل يوجد تمويل عقاري مع البنوك؟', 'negotiating', (select id from public.profiles where email = 'salessup@demo.example.com'), v_today, 'بانتظار موافقة البنك'),
    ('booking', v_proj, 'ماجد قاري',     '0565556677', null, 'جدة', v_today - 6, 'صباحًا', null, 'booked', v_sales, null, 'تم دفع العربون'),
    ('visit',   v_proj, 'سارة باحمدان',  '0566667788', null, 'جدة', v_today - 10, 'مساءً', null, 'won', v_sales, null, 'تم توقيع العقد'),
    ('service', null,   'فيصل الأنصاري', '0567778899', null, 'جدة', null, null, 'تصميم داخلي لشقة 180م', 'lost', v_sales, null, 'اختار جهة أخرى');

  -- owners: every demo owner gets an active account with at least one unit; some get a second unit + warranties
  for o in select ow.id, ow.full_name from public.owners ow join public.profiles p on p.id = ow.profile_id
           where p.email like 'owner%@demo.example.com' order by p.email loop
    update public.owners set account_status = 'active' where id = o.id;
    i := i + 1;
    continue when i > 5;
    for u in select un.id from public.units un where un.owner_id is null and coalesce(un.sale_status, 'available') <> 'not_for_sale'
             order by un.created_at limit 1 loop
      update public.units set owner_id = o.id, sale_status = 'sold', handover_date = v_today - (60 + i * 25) where id = u.id;
      insert into public.warranties (unit_id, category, title, start_date, end_date, covered_items, excluded_items, responsible_party) values
        (u.id, 'other', 'الضمان الإنشائي (الهيكل)', v_today - (60 + i * 25), v_today - (60 + i * 25) + 3650, 'الأساسات والأعمدة والجسور والأسقف', 'التعديلات الإنشائية من المالك', 'إدارة خدمات ما بعد البيع'),
        (u.id, 'insulation', 'ضمان العزل المائي والحراري', v_today - (60 + i * 25), v_today - (60 + i * 25) + 3650, 'الأسطح ودورات المياه', 'تركيبات المالك على السطح', 'إدارة خدمات ما بعد البيع'),
        (u.id, 'electrical', 'ضمان الأعمال الكهربائية', v_today - (60 + i * 25), v_today - (60 + i * 25) + 730, 'التمديدات واللوحات والقواطع', 'أجهزة المالك', 'إدارة خدمات ما بعد البيع'),
        (u.id, 'plumbing', 'ضمان أعمال السباكة', v_today - (60 + i * 25), v_today - (60 + i * 25) + 730, 'التمديدات والمحابس والصرف', 'الانسداد بسوء الاستخدام', 'إدارة خدمات ما بعد البيع'),
        (u.id, 'hvac', 'ضمان التكييف', v_today - (60 + i * 25), v_today - (60 + i * 25) + 365, 'وحدات التكييف والتمديدات', 'تنظيف الفلاتر', 'إدارة خدمات ما بعد البيع');
    end loop;
  end loop;
end $$;

select (select count(*) from public.hr_requests r join public.employees e on e.id=r.employee_id where e.email like '%@demo.example.com') hr_requests,
  (select string_agg(period||':'||status||':'||(select count(*) from public.payroll_lines l where l.run_id=r.id), ', ') from public.payroll_runs r) payroll,
  (select count(*) from public.leads) leads,
  (select count(*) from public.units where owner_id is not null) owned_units,
  (select count(*) from public.custodies) custodies;

-- (4b) حضور الإدارة العليا وإعادة حساب مسير الشهر
create or replace function pg_temp.act(p_email text) returns uuid language plpgsql as $f$
declare v uuid;
begin
  select id into v from public.profiles where email = p_email;
  perform set_config('request.jwt.claim.sub', coalesce(v::text, ''), true);
  perform set_config('request.jwt.claims', case when v is null then '' else json_build_object('sub', v, 'role', 'authenticated')::text end, true);
  return v;
end $f$;
do $$
declare e record; day date; v_today date := public.today_riyadh(); m date := date_trunc('month', public.today_riyadh())::date; v_loc uuid;
begin
  select id into v_loc from public.work_locations where name = 'المكتب الرئيسي — جدة' limit 1;
  for e in select id, email from public.employees where email in ('chairman@demo.example.com', 'gm@demo.example.com') loop
    for day in select g::date from generate_series(m, v_today, interval '1 day') g loop
      continue when extract(isodow from day) in (5, 6) or public.holidays_between(day, day) > 0;
      insert into public.attendance (employee_id, work_date, check_in_at, check_out_at, in_lat, in_lng, in_distance_m, location_id, source)
      values (e.id, day, (day + time '08:20' + make_interval(mins => abs(hashtext(e.email || day)) % 25)) at time zone 'Asia/Riyadh',
        case when day = v_today then null else (day + time '16:30' + make_interval(mins => abs(hashtext(e.email || day)) % 60)) at time zone 'Asia/Riyadh' end,
        21.5433, 39.1728, 20, v_loc, 'gps') on conflict (employee_id, work_date) do nothing;
    end loop;
  end loop;
  -- executives: 30-minute grace so their 08:20+ arrival isn't counted as late
  update public.employees set work_start = '08:30' where email in ('chairman@demo.example.com', 'gm@demo.example.com');
  perform pg_temp.act('hr@demo.example.com');
  perform public.generate_payroll(to_char(v_today, 'YYYY-MM'), true);
  perform pg_temp.act(null);
end $$;
select sum(l.absence_days) abs_days, string_agg(case when l.absence_days > 0 then l.full_name||'('||l.absence_days||')' end, ', ') absentees, sum(net) net
from public.payroll_lines l join public.payroll_runs r on r.id = l.run_id where r.period = to_char(public.today_riyadh(), 'YYYY-MM');
