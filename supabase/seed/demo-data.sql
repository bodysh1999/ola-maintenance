-- =====================================================================
--  بيانات تجريبية على مشاريع علا التميز الحقيقية (عُلا 17 → عُلا 25)
--  شغّل هذا الملف كاملًا في Supabase → SQL Editor (بعد الـ migrations الأربعة).
--
--  ينشئ: موظف صيانة، 4 فنيين، مقاولَين، 10 عملاء (8 بحسابات)، وحدات في عُلا 17 و20 و21
--  مع ضماناتها، و22 بلاغ صيانة بكل المراحل — عبر نفس دوال سير العمل الحقيقية.
--
--  كل الحسابات على النطاق @demo.example.com وكلمة المرور:  Demo@12345
--  للحذف لاحقًا: شغّل supabase/seed/demo-purge.sql (المشاريع الحقيقية تبقى كما هي).
-- =====================================================================

-- ---------- helpers (temporary — disappear when the session ends)
create or replace function pg_temp.demo_user(p_email text, p_name text, p_role text, p_phone text)
returns uuid language plpgsql as $f$
declare v uuid := gen_random_uuid();
begin
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
  update public.profiles set full_name = p_name, phone = p_phone where id = v;
  return v;
end $f$;

-- act as a user so the workflow functions apply that user's role & name
create or replace function pg_temp.demo_as(p_uid uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  perform set_config('request.jwt.claims', case when p_uid is null then '' else json_build_object('sub', p_uid, 'role', 'authenticated')::text end, true);
end $f$;

-- move everything written "now" for a request back to the simulated moment p_t
create or replace function pg_temp.demo_stamp(p_req uuid, p_t timestamptz) returns void language plpgsql as $f$
begin
  update public.activity_logs  set created_at = p_t where request_id = p_req and created_at = now();
  update public.notifications  set created_at = p_t where request_id = p_req and created_at = now();
  update public.request_notes  set created_at = p_t where request_id = p_req and created_at = now();
  update public.appointments   set created_at = p_t where request_id = p_req and created_at = now();
  update public.ratings        set created_at = p_t where request_id = p_req and created_at = now();
  update public.attachments    set created_at = p_t where request_id = p_req and created_at = now();
  update public.quotes set
    created_at   = case when created_at   = now() then p_t else created_at end,
    responded_at = case when responded_at = now() then p_t else responded_at end
  where request_id = p_req;
  update public.work_orders set
    created_at   = case when created_at   = now() then p_t else created_at end,
    started_at   = case when started_at   = now() then p_t else started_at end,
    submitted_at = case when submitted_at = now() then p_t else submitted_at end,
    reviewed_at  = case when reviewed_at  = now() then p_t else reviewed_at end
  where request_id = p_req;
  update public.maintenance_requests set
    due_at            = case when created_at = now() then p_t + interval '120 hours' else due_at end,
    created_at        = case when created_at = now() then p_t else created_at end,
    first_response_at = case when first_response_at = now() then p_t else first_response_at end,
    completed_at      = case when completed_at = now() then p_t else completed_at end
  where id = p_req;
end $f$;

do $$
declare
  dom constant text := '@demo.example.com';
  v_sup uuid;
  v_c1 uuid; v_c2 uuid;
  v_p17 uuid; v_p20 uuid; v_p21 uuid; v_b uuid;
  v_uid uuid; v_owner uuid; v_unit uuid; v_req uuid; v_wo uuid; v_tech uuid; v_tech_uid uuid; v_q uuid;
  v_t timestamptz; v_visit timestamptz;
  i int; n int; f int; k int;
  owner_ids uuid[] := '{}'; owner_uids uuid[] := '{}';
  units17 uuid[] := '{}'; units20 uuid[] := '{}'; units21 uuid[] := '{}';
  req_units uuid[];
  r record;
  owners_def text[][] := array[
    ['عبدالله الشمري', '0501234561'], ['نورة القحطاني', '0501234562'], ['محمد الدوسري', '0501234563'],
    ['ريم العمري', '0501234564'], ['تركي السبيعي', '0501234565'], ['هند باعشن', '0501234566'],
    ['سلطان الجهني', '0501234567'], ['لمى الحازمي', '0501234568'], ['فهد الزهراني', '0501234569'],
    ['أمل الغامدي', '0501234570']];
  -- category, location, description
  scen text[][] := array[
    ['plumbing', 'المطبخ', 'تسريب ماء أسفل مغسلة المطبخ ويزداد عند فتح الماء الحار'],
    ['hvac', 'غرفة النوم الرئيسية', 'المكيف لا يبرد بشكل كافٍ ويصدر صوتًا عاليًا ليلًا'],
    ['electrical', 'الصالة', 'انقطاع متكرر في قاطع الإنارة عند تشغيل المكيف'],
    ['doors_windows', 'المدخل', 'باب الشقة لا يغلق بإحكام والقفل صعب الحركة'],
    ['tiles', 'دورة المياه', 'تشقق في بلاط أرضية دورة المياه بجانب الشاور'],
    ['insulation', 'غرفة نوم', 'ظهور بقع رطوبة في السقف بعد الأمطار'],
    ['painting', 'المجلس', 'تقشر الدهان في الجدار المجاور للنافذة'],
    ['appliances', 'المطبخ', 'شفاط المطبخ لا يعمل على السرعة العالية'],
    ['elevators', 'المدخل', 'المصعد يتوقف بين الأدوار أحيانًا ويصدر إنذارًا'],
    ['plumbing', 'دورة المياه', 'ضعف ضغط الماء في الدش والسخان يستغرق وقتًا طويلًا'],
    ['hvac', 'الصالة', 'تسرب ماء من وحدة التكييف الداخلية على الجدار'],
    ['electrical', 'غرفة نوم', 'أفياش الغرفة لا تعمل بعد انقطاع الكهرباء']];
  -- final stage, days ago (index → scenario & unit)
  plan text[][] := array[
    ['completed', '58'], ['completed', '51'], ['completed', '45'], ['completed', '39'], ['completed', '33'],
    ['completed', '27'], ['completed', '21'], ['completed', '16'], ['completed', '10'], ['rejected', '19'],
    ['pending_approval', '4'], ['pending_approval', '3'], ['in_progress', '2'], ['awaiting_parts', '9'],
    ['scheduled', '2'], ['scheduled', '1'], ['assigned', '1'], ['approved', '1'], ['under_review', '1'],
    ['new', '0'], ['new', '6'], ['reopened', '13']];
  v_stage text; v_ago int; v_cat text;
begin
  if exists (select 1 from auth.users where email like '%' || dom) then
    raise exception 'البيانات التجريبية موجودة مسبقًا — شغّل demo-purge.sql أولًا';
  end if;

  -- ---------- projects (real) — create if missing, keep if already there
  insert into public.projects (name_ar, name_en, city, sales_status, image_url, description)
  select v.name_ar, v.name_en, 'جدة', v.status, v.img, v.descr
  from (values
    ('عُلا 17', 'Ola 17', 'sold',         'https://files.cdn-files-a.com/uploads/7515788/800_6941347e1ea48.jpg', 'مشروع مباع'),
    ('عُلا 20', 'Ola 20', 'sold',         'https://files.cdn-files-a.com/uploads/7515788/800_693fe29a196be.jpg', 'مشروع مباع'),
    ('عُلا 21', 'Ola 21', 'selling',      'https://files.cdn-files-a.com/uploads/7515788/800_6914f1c01fbad.jpg', 'مرحلة البيع'),
    ('عُلا 22', 'Ola 22', 'construction', 'https://files.cdn-files-a.com/uploads/7515788/800_698a2dd4e35c6.jpg', 'مرحلة الإنشاء'),
    ('عُلا 23', 'Ola 23', 'construction', 'https://files.cdn-files-a.com/uploads/7515788/800_693fe02562daf.jpg', 'مرحلة الإنشاء'),
    ('عُلا 24', 'Ola 24', 'construction', 'https://files.cdn-files-a.com/uploads/7515788/800_693fe1cf770a2.png', 'مرحلة الإنشاء'),
    ('عُلا 25', 'Ola 25', 'construction', 'https://files.cdn-files-a.com/uploads/7515788/800_693fe11dc857d.jpg', 'مرحلة الإنشاء')
  ) as v(name_ar, name_en, status, img, descr)
  where not exists (select 1 from public.projects p where p.name_ar = v.name_ar);

  select id into v_p17 from public.projects where name_ar = 'عُلا 17' limit 1;
  select id into v_p20 from public.projects where name_ar = 'عُلا 20' limit 1;
  select id into v_p21 from public.projects where name_ar = 'عُلا 21' limit 1;

  -- ---------- staff, contractors, technicians
  v_sup := pg_temp.demo_user('supervisor' || dom, 'سارة الغامدي', 'supervisor', '0550000002');

  insert into public.contractors (name, cr_number, contact_name, phone, email, specialties)
  values ('مؤسسة البرودة المثالية للتكييف', '4030000001', 'خالد الزهراني', '0551110001', 'hvac' || dom, '{hvac,appliances}')
  returning id into v_c1;
  insert into public.contractors (name, cr_number, contact_name, phone, email, specialties)
  values ('شركة الإتقان للمقاولات', '4030000002', 'ماجد الحربي', '0551110002', 'etqan' || dom, '{tiles,painting,insulation,doors_windows}')
  returning id into v_c2;

  for r in select * from (values
      ('tech.ahmed', 'أحمد السيد',   '0552220001', '{electrical,appliances,other,elevators}'::public.maintenance_category[], null::uuid),
      ('tech.yousef', 'يوسف الشهري', '0552220002', '{plumbing,insulation,other}'::public.maintenance_category[], null::uuid),
      ('tech.imran', 'عمران خان',    '0552220003', '{hvac,appliances}'::public.maintenance_category[], v_c1),
      ('tech.hassan', 'حسن المالكي', '0552220004', '{tiles,painting,doors_windows,insulation}'::public.maintenance_category[], v_c2)
    ) t(login, name, phone, spec, contractor)
  loop
    v_uid := pg_temp.demo_user(r.login || dom, r.name, 'technician', r.phone);
    insert into public.technicians (profile_id, full_name, phone, specialties, contractor_id)
    values (v_uid, r.name, r.phone, r.spec, r.contractor);
  end loop;

  -- ---------- owners (first 8 get accounts, last 2 pending activation)
  for i in 1 .. array_length(owners_def, 1) loop
    v_uid := case when i <= 8 then pg_temp.demo_user('owner' || i || dom, owners_def[i][1], 'owner', owners_def[i][2]) end;
    insert into public.owners (profile_id, full_name, phone, email, account_status)
    values (v_uid, owners_def[i][1], owners_def[i][2], 'owner' || i || dom, case when i <= 8 then 'active' else 'pending' end)
    returning id into v_owner;
    owner_ids := owner_ids || v_owner;
    owner_uids := owner_uids || v_uid;
  end loop;

  -- ---------- buildings & units in the delivered / selling projects
  -- عُلا 17: 4 أدوار × 3 شقق — سُلّم قبل ~23 شهرًا
  insert into public.buildings (project_id, name, floors_count) values (v_p17, 'المبنى الرئيسي', 4)
  on conflict (project_id, name) do update set floors_count = excluded.floors_count returning id into v_b;
  for f in 1 .. 4 loop for k in 1 .. 3 loop
    insert into public.units (building_id, unit_number, floor, unit_type, area_sqm, bedrooms, handover_date)
    values (v_b, f || '0' || k, f, case when f = 4 then 'penthouse' else 'apartment' end,
            case when f = 4 then 245 else 165 + k * 10 end, case when f = 4 then 5 else 4 end, current_date - 700)
    on conflict (building_id, unit_number) do nothing;
  end loop; end loop;
  select array_agg(id order by unit_number) into units17 from public.units where building_id = v_b and owner_id is null;

  -- عُلا 20: 5 أدوار × 2 + ملحق — سُلّم قبل ~10 أشهر
  insert into public.buildings (project_id, name, floors_count) values (v_p20, 'المبنى الرئيسي', 5)
  on conflict (project_id, name) do update set floors_count = excluded.floors_count returning id into v_b;
  for f in 1 .. 5 loop for k in 1 .. 2 loop
    insert into public.units (building_id, unit_number, floor, unit_type, area_sqm, bedrooms, handover_date)
    values (v_b, f || '0' || k, f, 'apartment', 180 + k * 15, 4, current_date - 320)
    on conflict (building_id, unit_number) do nothing;
  end loop; end loop;
  insert into public.units (building_id, unit_number, floor, unit_type, area_sqm, bedrooms, handover_date)
  values (v_b, 'R1', 6, 'penthouse', 290, 5, current_date - 320) on conflict (building_id, unit_number) do nothing;
  select array_agg(id order by unit_number) into units20 from public.units where building_id = v_b and owner_id is null;

  -- عُلا 21: 4 أدوار × 3 — بعض الوحدات بيعت وسُلّمت قبل شهرين
  insert into public.buildings (project_id, name, floors_count) values (v_p21, 'المبنى الرئيسي', 4)
  on conflict (project_id, name) do update set floors_count = excluded.floors_count returning id into v_b;
  for f in 1 .. 4 loop for k in 1 .. 3 loop
    insert into public.units (building_id, unit_number, floor, unit_type, area_sqm, bedrooms, handover_date)
    values (v_b, f || '0' || k, f, 'apartment', 170 + k * 10, 4, null)
    on conflict (building_id, unit_number) do nothing;
  end loop; end loop;
  select array_agg(id order by unit_number) into units21 from public.units where building_id = v_b and owner_id is null;

  -- link owners → units
  update public.units set owner_id = owner_ids[1] where id = units17[1];
  update public.units set owner_id = owner_ids[1] where id = units17[5];   -- مالك لديه وحدتان
  update public.units set owner_id = owner_ids[2] where id = units17[2];
  update public.units set owner_id = owner_ids[3] where id = units17[4];
  update public.units set owner_id = owner_ids[4] where id = units17[8];
  update public.units set owner_id = owner_ids[5] where id = units20[1];
  update public.units set owner_id = owner_ids[6] where id = units20[4];
  update public.units set owner_id = owner_ids[7] where id = units20[11];  -- الملحق
  update public.units set owner_id = owner_ids[8],  handover_date = current_date - 60 where id = units21[2];
  update public.units set owner_id = owner_ids[9],  handover_date = current_date - 60 where id = units21[6];
  update public.units set owner_id = owner_ids[10], handover_date = current_date - 60 where id = units21[9];

  -- ---------- standard warranty package for every demo-owned unit
  insert into public.warranties (unit_id, category, title, start_date, end_date, covered_items, excluded_items, responsible_party, contractor_id)
  select u.id, w.cat::public.maintenance_category, w.title, u.handover_date,
         (u.handover_date + make_interval(years => w.yrs) - interval '1 day')::date, w.cov, w.exc, 'إدارة خدمات ما بعد البيع',
         case w.cat when 'hvac' then v_c1 when 'tiles' then v_c2 when 'painting' then v_c2 end
  from public.units u
  cross join (values
    ('other', 'الضمان الإنشائي (الهيكل)', 10, 'الأساسات والأعمدة والجسور والأسقف الخرسانية', 'التعديلات الإنشائية من المالك'),
    ('insulation', 'ضمان العزل المائي والحراري', 10, 'عزل الأسطح ودورات المياه والخزانات', 'تركيبات المالك على السطح'),
    ('electrical', 'ضمان الأعمال الكهربائية', 2, 'التمديدات واللوحات والقواطع والمفاتيح', 'أجهزة المالك وسوء الاستخدام'),
    ('plumbing', 'ضمان أعمال السباكة', 2, 'التمديدات والمحابس والصرف والسخانات', 'الانسداد بسبب سوء الاستخدام'),
    ('hvac', 'ضمان التكييف', 1, 'وحدات التكييف وتمديدات النحاس والتصريف', 'تنظيف الفلاتر والصيانة الدورية'),
    ('elevators', 'ضمان المصاعد', 2, 'المحرك ولوحات التحكم والأبواب', 'التحميل الزائد'),
    ('doors_windows', 'ضمان الأبواب والنوافذ', 1, 'المفصلات والأقفال والألمنيوم', 'الكسر الناتج عن الاستخدام'),
    ('tiles', 'ضمان البلاط والسيراميك', 1, 'التشققات والانفصال', 'الكسر بسبب سقوط أجسام'),
    ('painting', 'ضمان الدهانات', 1, 'التقشر والتشقق الطبيعي', 'الاتساخ والخدوش')
  ) as w(cat, title, yrs, cov, exc)
  where u.owner_id = any(owner_ids) and u.handover_date is not null
    and not exists (select 1 from public.warranties x where x.unit_id = u.id);

  -- ---------- maintenance requests through the real workflow
  select array_agg(u.id order by o.created_at, u.unit_number) into req_units
  from public.units u join public.owners o on o.id = u.owner_id
  where o.id = any(owner_ids) and o.profile_id is not null;
  n := array_length(req_units, 1);

  for i in 1 .. array_length(plan, 1) loop
    v_stage := plan[i][1];
    v_ago := plan[i][2]::int;
    v_unit := req_units[((i - 1) % n) + 1];
    v_cat := scen[((i - 1) % array_length(scen, 1)) + 1][1];
    if v_stage = 'approved' then   -- owner1 (عُلا 17, painting warranty expired) → quotation waiting for the customer
      v_unit := req_units[1];
      v_cat := 'painting';
    end if;
    select o.profile_id into v_uid from public.units u join public.owners o on o.id = u.owner_id where u.id = v_unit;

    v_t := now() - make_interval(days => v_ago, hours => 2 + (i % 6));
    perform pg_temp.demo_as(v_uid);
    insert into public.maintenance_requests (unit_id, owner_id, category, location_in_unit, description, preferred_date, preferred_slot)
    select v_unit, u.owner_id, v_cat::public.maintenance_category,
           case when v_stage = 'approved' then 'الصالة' else scen[((i - 1) % array_length(scen, 1)) + 1][2] end,
           case when v_stage = 'approved' then 'طلب إعادة دهان جدار الصالة بعد ظهور تشققات شعرية' else scen[((i - 1) % array_length(scen, 1)) + 1][3] end,
           (v_t + interval '2 days')::date, (array['morning', 'afternoon', 'evening'])[(i % 3) + 1]
    from public.units u where u.id = v_unit
    returning id into v_req;
    perform pg_temp.demo_stamp(v_req, v_t);

    if i % 4 = 0 then  -- a note from the owner on some requests
      v_t := v_t + interval '40 minutes';
      insert into public.request_notes (request_id, body) values (v_req, 'أفضّل أن تكون الزيارة بعد الساعة 10 صباحًا لو سمحتوا');
      perform pg_temp.demo_stamp(v_req, v_t);
    end if;
    continue when v_stage = 'new';

    perform pg_temp.demo_as(v_sup);
    v_t := v_t + interval '3 hours';
    perform public.transition_request(v_req, 'under_review', null);
    perform pg_temp.demo_stamp(v_req, v_t);
    continue when v_stage = 'under_review';

    if v_stage = 'rejected' then
      v_t := v_t + interval '5 hours';
      perform public.transition_request(v_req, 'rejected', 'العطل ناتج عن تعديلات أجراها المالك على التمديدات وغير مشمول بالضمان');
      perform pg_temp.demo_stamp(v_req, v_t);
      continue;
    end if;

    -- out-of-warranty requests get a quotation the owner approves first
    if (select warranty_state from public.maintenance_requests where id = v_req) = 'out_of_warranty' then
      v_t := v_t + interval '2 hours';
      v_q := public.create_quote(v_req, 450 + (i * 35), 'أعمال خارج الضمان: فحص وإصلاح مع توريد القطع اللازمة');
      perform pg_temp.demo_stamp(v_req, v_t);
      if v_stage = 'approved' then continue; end if;  -- left pending for the owner
      perform pg_temp.demo_as(v_uid);
      v_t := v_t + interval '6 hours';
      perform public.respond_quote(v_q, true);
      perform pg_temp.demo_stamp(v_req, v_t);
      perform pg_temp.demo_as(v_sup);
    else
      v_t := v_t + interval '2 hours';
      perform public.transition_request(v_req, 'approved', null);
      perform pg_temp.demo_stamp(v_req, v_t);
      continue when v_stage = 'approved';
    end if;

    select t.id, t.profile_id into v_tech, v_tech_uid from public.technicians t
    join public.profiles p on p.id = t.profile_id
    where p.email like '%' || dom and v_cat::public.maintenance_category = any(t.specialties)
    order by t.full_name limit 1;

    v_visit := case when v_stage = 'scheduled'
                    then date_trunc('day', now()) + make_interval(days => 1 + (i % 3), hours => 7)   -- 10:00 الرياض
                    else date_trunc('day', v_t) + interval '1 day' + make_interval(hours => 6 + (i % 5)) end;
    v_t := v_t + interval '1 hour';
    v_wo := public.assign_request(v_req, v_tech, 'يرجى التواصل مع العميل قبل الزيارة بساعة',
              (array['medium', 'high', 'medium', 'low', 'urgent'])[(i % 5) + 1]::public.request_priority,
              case when v_stage = 'assigned' then null else v_visit end, null);
    perform pg_temp.demo_stamp(v_req, v_t);
    continue when v_stage in ('assigned', 'scheduled');

    perform pg_temp.demo_as(v_tech_uid);
    v_t := greatest(v_visit, v_t + interval '1 hour');
    perform public.tech_start_work(v_wo);
    perform pg_temp.demo_stamp(v_req, v_t);

    if v_stage = 'awaiting_parts' then
      v_t := v_t + interval '1 hour';
      perform public.tech_awaiting_parts(v_wo, 'مطلوب قطعة بديلة — تم طلبها من الوكيل وتصل خلال أسبوع');
      perform pg_temp.demo_stamp(v_req, v_t);
      continue;
    end if;

    insert into public.work_order_parts (work_order_id, name, quantity, unit_cost, created_by)
    values (v_wo, (array['محبس زاوية', 'قاطع 20 أمبير', 'فلتر مكيف', 'مفصلة باب', 'سيليكون عازل', 'مروحة شفاط'])[(i % 6) + 1], 1 + (i % 3), 25 + (i * 11) % 160, v_tech_uid);
    continue when v_stage = 'in_progress';

    v_t := v_t + interval '2 hours';
    insert into public.attachments (request_id, work_order_id, kind, storage_path, file_name, mime_type, size_bytes, uploaded_by)
    values (v_req, v_wo, 'after', v_req || '/demo-after-' || i || '.jpg', 'صورة بعد الإصلاح.jpg', 'image/jpeg', 0, v_tech_uid);
    perform public.tech_submit_work(v_wo, 'تم إصلاح العطل واختبار التشغيل بحضور العميل');
    perform pg_temp.demo_stamp(v_req, v_t);
    continue when v_stage = 'pending_approval';

    perform pg_temp.demo_as(v_sup);
    v_t := v_t + interval '5 hours';
    perform public.review_work(v_wo, true, 'تم التحقق من التقرير واعتماد الإنجاز');
    perform pg_temp.demo_stamp(v_req, v_t);

    if v_stage = 'completed' and i % 7 <> 0 then
      perform pg_temp.demo_as(v_uid);
      v_t := v_t + interval '1 day';
      perform public.owner_rate_request(v_req, (array[5, 5, 4, 5, 3, 4])[(i % 6) + 1],
              (array['خدمة ممتازة وسريعة', 'الفني محترف ومرتب', null, 'شكرًا لكم', 'تأخر الموعد قليلًا', null])[(i % 6) + 1]);
      perform pg_temp.demo_stamp(v_req, v_t);
    elsif v_stage = 'reopened' then
      perform pg_temp.demo_as(v_uid);
      v_t := v_t + interval '2 days';
      perform public.owner_reopen_request(v_req, 'عاد التسريب بعد يومين من الإصلاح');
      perform pg_temp.demo_stamp(v_req, v_t);
    end if;
  end loop;

  perform pg_temp.demo_as(null);
  raise notice 'تم: % عملاء، % وحدة مملوكة، % بلاغ', array_length(owner_ids, 1),
    (select count(*) from public.units where owner_id = any(owner_ids)), array_length(plan, 1);
end $$;

-- summary
select 'كلمة المرور لكل الحسابات: Demo@12345' as info
union all select 'موظف صيانة: supervisor@demo.example.com'
union all select 'فني: tech.ahmed@demo.example.com'
union all select 'عميل: owner1@demo.example.com  (owner1 … owner8)';
