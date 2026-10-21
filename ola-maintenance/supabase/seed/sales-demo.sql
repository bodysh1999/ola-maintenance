-- =====================================================================
--  بيانات تجريبية للمبيعات والتوظيف — شغّله بعد demo-data.sql وبعد migrations 6 و 7
--
--  ينشئ:  موظف مبيعات  sales@demo.example.com
--         موارد بشرية  hr@demo.example.com          (كلمة المرور: Demo@12345)
--  ويضع موقعًا مؤقتًا وأسعارًا للوحدات غير المباعة في عُلا 21، وفرصًا وظيفية، وطلبات نموذجية.
--  ⚠️ الموقع والأسعار أمثلة — عدّلها من لوحة الإدارة ← المشاريع قبل الإطلاق.
--  للحذف: demo-purge.sql يحذف هذه الحسابات والطلبات أيضًا.
-- =====================================================================

create or replace function pg_temp.demo_user(p_email text, p_name text, p_role text, p_phone text)
returns uuid language plpgsql as $f$
declare v uuid := gen_random_uuid();
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

do $$
declare v_sales uuid; v_p21 uuid; v_unit uuid; v_open uuid;
begin
  v_sales := pg_temp.demo_user('sales@demo.example.com', 'ياسر المالكي', 'sales', '0551000001');
  perform pg_temp.demo_user('hr@demo.example.com', 'منى الحربي', 'hr', '0551000002');

  select id into v_p21 from public.projects where name_ar = 'عُلا 21' limit 1;
  if v_p21 is not null then
    update public.projects set
      description  = coalesce(nullif(description, 'مرحلة البيع'), 'شقق سكنية بتصميم عصري في جدة — 4 أدوار، 3 شقق في كل دور، مواقف خاصة، مدخل فندقي ومصعد. تشطيبات فاخرة وضمانات معتمدة على الهيكل والتمديدات.'),
      address_text = coalesce(address_text, 'جدة — (عنوان مثال، عدّله من لوحة الإدارة)'),
      map_query    = coalesce(map_query, 'جدة'),
      visit_hours  = coalesce(visit_hours, 'يوميًا عدا الجمعة · 4:00م – 10:00م')
    where id = v_p21;

    -- unsold units of Ola 21 go on sale with sample prices; two are reserved
    update public.units u set
      sale_status = case when u.unit_number in ('303', '401') then 'reserved' else 'available' end,
      price       = 780000 + coalesce(u.area_sqm, 180) * 1500 + u.floor * 15000,
      bathrooms   = coalesce(u.bathrooms, 3),
      features    = coalesce(u.features, 'غرفة خادمة · مطبخ مجهز · مدخل مستقل · موقف خاص')
    from public.buildings b
    where b.id = u.building_id and b.project_id = v_p21 and u.owner_id is null and u.sale_status in ('not_for_sale', 'available');

    -- sample leads
    if not exists (select 1 from public.leads where email like '%@demo.example.com') then
      insert into public.leads (kind, project_id, full_name, phone, email, preferred_date, preferred_time, message, status, assigned_to, created_at)
      values ('visit', v_p21, 'خالد العتيبي', '0552000001', 'khaled@demo.example.com', current_date + 2, 'مساءً', 'أرغب بزيارة الشقق النموذجية', 'new', null, now() - interval '3 hours'),
             ('inquiry', v_p21, 'سارة باحارث', '0552000002', 'sara@demo.example.com', null, null, 'هل يتوفر تمويل عقاري؟', 'contacted', v_sales, now() - interval '1 day');
      select u.id into v_unit from public.units u join public.buildings b on b.id = u.building_id
      where b.project_id = v_p21 and u.sale_status = 'available' order by u.unit_number limit 1;
      insert into public.leads (kind, project_id, unit_id, full_name, phone, email, message, status, assigned_to, follow_up_at, created_at)
      values ('booking', v_p21, v_unit, 'عمر بخش', '0552000003', 'omar@demo.example.com', 'أرغب بحجز الوحدة', 'negotiating', v_sales, current_date + 1, now() - interval '2 days');
      insert into public.leads (kind, service, full_name, phone, email, city, message, status, created_at)
      values ('service', 'supervision', 'ماجد الحربي', '0552000004', 'majed@demo.example.com', 'جدة', 'أبني فيلا في أبحر الشمالية وأحتاج إشراف هندسي', 'new', now() - interval '5 hours');
    end if;
  end if;

  -- job openings (only if none besides the default one)
  if (select count(*) from public.job_openings) <= 1 then
    insert into public.job_openings (title, department, employment, description, requirements) values
      ('أخصائي مبيعات عقارية', 'المبيعات', 'full_time', 'استقبال العملاء وإدارة زيارات المشاريع ومتابعة الحجوزات حتى الإفراغ.', 'خبرة سنتين في المبيعات العقارية · رخصة فال ميزة · مهارات تواصل ممتازة'),
      ('مشرف صيانة', 'خدمات ما بعد البيع', 'full_time', 'متابعة بلاغات الملاك والإشراف على الفنيين والمقاولين.', 'دبلوم أو بكالوريوس هندسي · خبرة 3 سنوات في الصيانة السكنية');
    insert into public.job_openings (title, department, employment, description, requirements) values
      ('برنامج التدريب التعاوني — هندسة', 'المشاريع', 'training', 'تدريب ميداني في مواقع الإنشاء ومكتب المشاريع.', 'طالب هندسة مدنية أو معمارية · خطاب من الجامعة');
  end if;

  if not exists (select 1 from public.job_applications where email like '%@demo.example.com') then
    select id into v_open from public.job_openings where is_open and employment <> 'training' order by created_at limit 1;
    insert into public.job_applications (kind, opening_id, full_name, phone, email, city, education, major, university, experience_years, cover_note)
    values ('job', v_open, 'نورة السلمي', '0553000001', 'noura@demo.example.com', 'جدة', 'بكالوريوس', 'إدارة أعمال', 'جامعة الملك عبدالعزيز', 3, 'عملت في مبيعات مشاريع سكنية لمدة 3 سنوات.');
    insert into public.job_applications (kind, full_name, phone, email, city, education, major, university, training_from, training_to)
    values ('training', 'عبدالرحمن الغامدي', '0553000002', 'abdulrahman@demo.example.com', 'جدة', 'طالب', 'هندسة مدنية', 'جامعة جدة', current_date + 30, current_date + 120);
  end if;
end $$;

select 'تم — sales@demo.example.com / hr@demo.example.com — كلمة المرور Demo@12345' as result;
