-- =====================================================================
--  عرض كامل (3): المشتريات — فريق، موردون، وطلبات شراء بكل الحالات
--  المندوب: procurement@demo · المعتمد: cfo@demo · المالك/الإدارة يعتمدون دائمًا
--  يُحذف بـ demo-purge.sql. آمن لإعادة التشغيل.
-- =====================================================================
do $$
declare
  u_rep uuid; u_appr uuid; u_mm uuid; u_pm uuid; u_site uuid; u_adm uuid; v_proj uuid;
  s_cool uuid; s_air uuid; s_bina uuid; s_hadid uuid; s_cem uuid; s_paint uuid; s_jotun uuid; s_plumb uuid;
  r1 uuid; r2 uuid; r3 uuid; r4 uuid; q uuid; v_today date := public.today_riyadh();
begin
  select id into u_rep  from auth.users where email = 'procurement@demo.example.com';
  select id into u_appr from auth.users where email = 'cfo@demo.example.com';
  select id into u_mm   from auth.users where email = 'maintmgr@demo.example.com';
  select id into u_pm   from auth.users where email = 'pm@demo.example.com';
  select id into u_site from auth.users where email = 'site@demo.example.com';
  select id into u_adm  from auth.users where email = 'admin@demo.example.com';
  if u_rep is null or u_appr is null then raise notice 'run full-demo-1/2 first'; return; end if;
  if exists (select 1 from public.purchase_requests where requested_by in (u_mm, u_pm, u_site) and title like '%(تجريبي)%') then
    raise notice 'procurement demo already loaded'; return;
  end if;
  select id into v_proj from public.projects order by created_at limit 1;

  insert into public.procurement_members (profile_id, role, added_by) values (u_rep, 'rep', u_adm), (u_appr, 'approver', u_adm)
  on conflict (profile_id) do update set role = excluded.role;
  update public.procurement_settings set quotes_required = 3, admin_threshold = 50000 where id = 1;

  -- suppliers
  insert into public.suppliers (name, category, contact_name, phone, cr_no, vat_no, created_by) values
    ('مؤسسة التبريد المتقدم (تجريبي)', 'تكييف وتبريد', 'م. سامي', '0551110001', '4030100001', '300100000100003', u_rep) returning id into s_cool;
  insert into public.suppliers (name, category, contact_name, phone, cr_no, created_by) values
    ('شركة هواء جدة للمكيفات (تجريبي)', 'تكييف وتبريد', 'أ. ماجد', '0551110002', '4030100002', u_rep) returning id into s_air;
  insert into public.suppliers (name, category, phone, cr_no, created_by) values
    ('مؤسسة البناء الحديث (تجريبي)', 'مواد بناء', '0551110003', '4030100003', u_rep) returning id into s_bina;
  insert into public.suppliers (name, category, phone, cr_no, vat_no, created_by) values
    ('شركة الحديد المتحدة (تجريبي)', 'مواد بناء', '0551110004', '4030100004', '300100000400003', u_rep) returning id into s_hadid;
  insert into public.suppliers (name, category, phone, created_by) values
    ('مصنع أسمنت الغربية (تجريبي)', 'مواد بناء', '0551110005', u_rep) returning id into s_cem;
  insert into public.suppliers (name, category, phone, created_by) values
    ('معرض الألوان الذهبية (تجريبي)', 'دهانات', '0551110006', u_rep) returning id into s_paint;
  insert into public.suppliers (name, category, contact_name, phone, created_by) values
    ('وكيل جوتن — جدة (تجريبي)', 'دهانات', 'أ. فهد', '0551110007', u_rep) returning id into s_jotun;
  insert into public.suppliers (name, category, phone, created_by) values
    ('مستودع أدوات السباكة (تجريبي)', 'سباكة', '0551110008', u_rep) returning id into s_plumb;

  -- 1) purchased: split ACs for the show building
  insert into public.purchase_requests (title, description, needed_by, project_id, requested_by, rep_id, status, submitted_at,
      decided_by, decided_at, decision_note, purchased_amount, purchase_note, purchased_at, created_at)
  values ('مكيفات سبليت لوحدات مبنى العرض (تجريبي)', 'استبدال مكيفات الوحدات 101 و102 بعد انتهاء ضمان المصنع.', v_today - 10, v_proj,
      u_mm, u_rep, 'purchased', now() - interval '12 days', u_appr, now() - interval '11 days', 'أفضل ضمان وتوريد خلال يومين',
      21900, 'استُلمت كاملة', now() - interval '8 days', now() - interval '15 days')
  returning id into r1;
  insert into public.purchase_items (request_id, position, name, qty, unit) values
    (r1, 1, 'مكيف سبليت 24 ألف وحدة — انفرتر', 6, 'قطعة'), (r1, 2, 'تمديدات نحاس وتركيب', 6, 'مجموعة');
  insert into public.purchase_quotes (request_id, quote_no, supplier_id, amount, vat_included, delivery_days, valid_until, notes, uploaded_by, created_at)
  values (r1, 1, s_air, 23400, true, 5, v_today + 5, 'ضمان سنتين', u_rep, now() - interval '14 days');
  insert into public.purchase_quotes (request_id, quote_no, supplier_id, amount, vat_included, delivery_days, valid_until, notes, uploaded_by, created_at)
  values (r1, 2, s_cool, 21900, true, 2, v_today + 5, 'ضمان 5 سنوات على الكمبروسر', u_rep, now() - interval '13 days') returning id into q;
  update public.purchase_requests set chosen_quote_id = q where id = r1;
  insert into public.purchase_quotes (request_id, quote_no, supplier_id, amount, vat_included, delivery_days, uploaded_by, created_at)
  values (r1, 3, s_bina, 24750, false, 7, u_rep, now() - interval '13 days');

  -- 2) approved: buyer told to buy from quote #2
  insert into public.purchase_requests (title, description, needed_by, project_id, requested_by, rep_id, status, submitted_at,
      decided_by, decided_at, decision_note, created_at)
  values ('أسمنت وحديد لأعمال الأسوار (تجريبي)', null, v_today + 5, v_proj, u_site, u_rep, 'approved', now() - interval '2 days',
      u_appr, now() - interval '1 day', 'أقل سعر وتوريد خلال 3 أيام', now() - interval '4 days')
  returning id into r2;
  insert into public.purchase_items (request_id, position, name, qty, unit) values
    (r2, 1, 'أسمنت مقاوم للأملاح', 80, 'كيس'), (r2, 2, 'حديد تسليح 12 مم', 3, 'طن'), (r2, 3, 'سلك رباط', 10, 'لفة');
  insert into public.purchase_quotes (request_id, quote_no, supplier_id, amount, vat_included, delivery_days, valid_until, uploaded_by, created_at)
  values (r2, 1, s_bina, 14500, true, 4, v_today + 10, u_rep, now() - interval '3 days');
  insert into public.purchase_quotes (request_id, quote_no, supplier_id, amount, vat_included, delivery_days, valid_until, notes, uploaded_by, created_at)
  values (r2, 2, s_hadid, 13200, true, 3, v_today + 10, 'يشمل التوصيل للموقع', u_rep, now() - interval '3 days') returning id into q;
  update public.purchase_requests set chosen_quote_id = q where id = r2;
  insert into public.purchase_quotes (request_id, quote_no, supplier_id, amount, vat_included, delivery_days, uploaded_by, created_at)
  values (r2, 3, s_cem, 15100, true, 6, u_rep, now() - interval '2 days');

  -- 3) awaiting approval: paint for handover touch-ups
  insert into public.purchase_requests (title, description, needed_by, project_id, requested_by, rep_id, status, submitted_at, created_at)
  values ('دهانات لتشطيبات ما قبل التسليم (تجريبي)', 'لون الوحدات المعتمد: أبيض عاجي — مطفي.', v_today + 7, v_proj, u_pm, u_rep,
      'pending_approval', now() - interval '3 hours', now() - interval '2 days')
  returning id into r3;
  insert into public.purchase_items (request_id, position, name, qty, unit) values
    (r3, 1, 'دهان داخلي مطفي 18 لتر', 40, 'جالون'), (r3, 2, 'معجون جدران', 25, 'كيس'), (r3, 3, 'رولات وفرش', 1, 'طقم');
  insert into public.purchase_quotes (request_id, quote_no, supplier_id, amount, vat_included, delivery_days, valid_until, uploaded_by, created_at) values
    (r3, 1, s_jotun, 9850, true, 2, v_today + 14, u_rep, now() - interval '1 day'),
    (r3, 2, s_paint, 8900, true, 4, v_today + 7, u_rep, now() - interval '20 hours'),
    (r3, 3, s_bina, 10400, false, 3, null, u_rep, now() - interval '5 hours');

  -- 4) collecting quotes: plumbing tools for the maintenance team
  insert into public.purchase_requests (title, needed_by, requested_by, rep_id, status, created_at)
  values ('أدوات وقطع سباكة لفريق الصيانة (تجريبي)', v_today + 3, u_mm, u_rep, 'quoting', now() - interval '6 hours')
  returning id into r4;
  insert into public.purchase_items (request_id, position, name, qty, unit) values
    (r4, 1, 'خلاطات مغاسل', 10, 'قطعة'), (r4, 2, 'وصلات مرنة 40 سم', 30, 'قطعة'), (r4, 3, 'شريط تفلون', 2, 'كرتون');
  insert into public.purchase_quotes (request_id, quote_no, supplier_id, amount, vat_included, delivery_days, uploaded_by, created_at)
  values (r4, 1, s_plumb, 3150, true, 1, u_rep, now() - interval '2 hours');

  -- notifications that would have been sent
  perform public.notify_user(u_rep, 'purchase_assigned', null, jsonb_build_object('ref_no', (select ref_no from public.purchase_requests where id = r4),
    'title', 'أدوات وقطع سباكة لفريق الصيانة (تجريبي)', 'count', 3, 'link', '/procurement/' || r4));
  perform public.notify_user(u_appr, 'purchase_submitted', null, jsonb_build_object('ref_no', (select ref_no from public.purchase_requests where id = r3),
    'title', 'دهانات لتشطيبات ما قبل التسليم (تجريبي)', 'link', '/procurement/' || r3));
  perform public.notify_user(u_rep, 'purchase_approved', null, jsonb_build_object('ref_no', (select ref_no from public.purchase_requests where id = r2),
    'no', 2, 'supplier', 'شركة الحديد المتحدة (تجريبي)', 'amount', 13200, 'link', '/procurement/' || r2));
end $$;

select (select count(*) from public.purchase_requests where title like '%(تجريبي)%') as demo_purchases,
       (select count(*) from public.suppliers where name like '%(تجريبي)%') as demo_suppliers;
