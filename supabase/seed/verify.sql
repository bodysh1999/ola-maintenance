-- =====================================================================
--  فحص التثبيت — شغّله في SQL Editor. لا يغيّر أي بيانات.
--  كل سطر ✅ = سليم، ❌ = ناقص (العمود الأخير يقول وش تسوي)
-- =====================================================================
create or replace function pg_temp.q(p_sql text) returns bigint language plpgsql as $f$
declare v bigint;
begin
  execute p_sql into v;
  return v;
exception when others then
  return -1;   -- table/column missing → treated as failed
end $f$;

create or replace function pg_temp.qt(p_sql text) returns text language plpgsql as $f$
declare v text;
begin
  execute p_sql into v;
  return v;
exception when others then
  return null;
end $f$;

create or replace function pg_temp.verify()
returns table ("#" text, "الفحص" text, "النتيجة" text, "التفاصيل" text) language plpgsql as $f$
declare
  t_expected text[] := array['roles','profiles','company_settings','projects','buildings','owners','units','contractors',
    'technicians','warranties','maintenance_requests','work_orders','work_order_parts','appointments','attachments',
    'request_notes','quotes','ratings','notifications','notification_outbox','activity_logs'];
  n bigint; m bigint; missing text;
begin
  -- ---------------- 1) schema
  select string_agg(t, '، ') into missing from unnest(t_expected) t where to_regclass('public.' || t) is null;
  return query select '1', 'الجداول (21 جدول)', case when missing is null then '✅' else '❌' end,
    coalesce('ناقص: ' || missing || ' — شغّل الملف 1', 'كل الجداول موجودة');
  n := pg_temp.q($$select count(*) from pg_trigger where tgname = 'on_auth_user_created'$$);
  return query select '1', 'إنشاء الملف الشخصي تلقائيًا للمستخدمين', case when n = 1 then '✅' else '❌' end,
    case when n = 1 then 'trigger on_auth_user_created موجود' else 'شغّل الملف 1' end;
  n := pg_temp.q($$select count(*) from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id)$$);
  return query select '1', 'كل مستخدم له ملف شخصي', case when n = 0 then '✅' else '❌' end,
    case when n = 0 then 'سليم' when n < 0 then 'شغّل الملف 1' else n || ' مستخدم بدون profile (أُنشئوا قبل تشغيل الملف 1)' end;

  -- ---------------- 2) workflow
  select string_agg(f, '، ') into missing from unnest(array['transition_request','assign_request','schedule_visit',
    'tech_start_work','tech_submit_work','review_work','owner_rate_request','owner_reopen_request','create_quote',
    'respond_quote','report_summary','evaluate_warranty']) f
  where not exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = f);
  return query select '2', 'دوال سير العمل (12 دالة)', case when missing is null then '✅' else '❌' end,
    coalesce('ناقص: ' || missing || ' — شغّل الملف 2', 'كل الدوال موجودة');
  n := (case when to_regclass('public.request_overview') is null then 0 else 1 end);
  return query select '2', 'عرض البلاغات request_overview', case when n = 1 then '✅' else '❌' end,
    case when n = 1 then 'موجود' else 'شغّل الملف 2' end;
  n := pg_temp.q($$select count(*) from pg_trigger where tgname in ('trg_request_status','trg_request_after_insert','trg_request_before_insert','trg_note_after_insert')$$);
  return query select '2', 'السجل الزمني والإشعارات التلقائية', case when n = 4 then '✅' else '❌' end,
    case when n = 4 then '4 triggers موجودة' else 'موجود ' || greatest(n, 0) || ' من 4 — شغّل الملف 2' end;

  -- ---------------- 3) security
  select string_agg(c.relname, '، ') into missing from pg_class c join pg_namespace s on s.oid = c.relnamespace
  where s.nspname = 'public' and c.relkind = 'r' and c.relname = any(t_expected) and not c.relrowsecurity;
  return query select '3', 'الحماية RLS مفعّلة على كل الجداول', case when missing is null and to_regclass('public.units') is not null then '✅' else '❌' end,
    coalesce('غير مفعّلة على: ' || missing || ' — شغّل الملف 3', case when to_regclass('public.units') is null then 'شغّل الملفات 1 و3' else 'مفعّلة' end);
  n := pg_temp.q($$select count(*) from pg_policies where schemaname = 'public'$$);
  return query select '3', 'سياسات الصلاحيات', case when n >= 30 then '✅' else '❌' end,
    case when n >= 30 then n || ' سياسة' else 'موجود ' || greatest(n, 0) || ' فقط — شغّل الملف 3' end;
  n := pg_temp.q($$select count(*) from storage.buckets where id in ('attachments','branding')$$);
  return query select '3', 'مخازن الملفات (المرفقات والشعار)', case when n = 2 then '✅' else '❌' end,
    case when n = 2 then 'attachments + branding' else 'شغّل الملف 3' end;
  n := pg_temp.q($$select count(*) from information_schema.column_privileges where table_schema = 'public' and table_name = 'maintenance_requests' and column_name = 'status' and grantee = 'authenticated' and privilege_type = 'UPDATE'$$);
  m := pg_temp.q($$select count(*) from pg_policies where schemaname = 'public' and tablename = 'maintenance_requests'$$);
  return query select '3', 'منع تعديل حالة الطلب مباشرة', case when n = 0 and m > 0 then '✅' else '❌' end,
    case when n = 0 and m > 0 then 'التغيير فقط عبر دوال سير العمل' else 'شغّل الملف 3' end;

  -- ---------------- 4) company profile
  n := pg_temp.q($$select count(*) from information_schema.columns where table_schema = 'public' and ((table_name = 'projects' and column_name = 'sales_status') or (table_name = 'company_settings' and column_name in ('whatsapp','website_url','instagram_url','snapchat_url','tiktok_url')))$$);
  return query select '4', 'أعمدة بيانات الشركة وحالة المشروع', case when n = 6 then '✅' else '❌' end,
    case when n = 6 then 'موجودة' else 'موجود ' || greatest(n, 0) || ' من 6 — شغّل الملف 4' end;
  n := pg_temp.q($$select count(*) from public.company_settings where name_ar like '%للاستثمار والتسويق العقاري%' and whatsapp is not null$$);
  return query select '4', 'اسم الشركة وبيانات التواصل', case when n = 1 then '✅' else '❌' end,
    case when n = 1 then 'علا التميز للاستثمار والتسويق العقاري' else 'شغّل الملف 4' end;

  -- ---------------- 5) demo data
  n := pg_temp.q($$select count(*) from public.projects where name_ar in ('عُلا 17','عُلا 20','عُلا 21','عُلا 22','عُلا 23','عُلا 24','عُلا 25')$$);
  return query select '5', 'مشاريع عُلا 17 → 25', case when n = 7 then '✅' else '❌' end,
    case when n = 7 then '7 مشاريع' else 'موجود ' || greatest(n, 0) || ' من 7 — شغّل الملف 5' end;
  n := pg_temp.q($$select count(*) from auth.users where email like '%@demo.example.com'$$);
  return query select '5', 'الحسابات التجريبية', case when n = 13 then '✅' else '❌' end,
    case when n = 13 then 'موظف صيانة + 4 فنيين + 8 عملاء' else n || ' من 13 — شغّل الملف 5' end;
  n := pg_temp.q($$select count(*) from public.owners where email like '%@demo.example.com'$$);
  m := pg_temp.q($$select count(*) from public.units u join public.owners o on o.id = u.owner_id where o.email like '%@demo.example.com'$$);
  return query select '5', 'العملاء ووحداتهم', case when n = 10 and m = 11 then '✅' else '❌' end,
    n || ' عميل، ' || m || ' وحدة مملوكة';
  n := pg_temp.q($$select count(*) from public.maintenance_requests r join public.owners o on o.id = r.owner_id where o.email like '%@demo.example.com'$$);
  m := pg_temp.q($$select count(distinct r.status) from public.maintenance_requests r join public.owners o on o.id = r.owner_id where o.email like '%@demo.example.com'$$);
  return query select '5', 'بلاغات الصيانة التجريبية', case when n = 22 then '✅' else '❌' end,
    n || ' بلاغ بـ ' || m || ' حالات مختلفة';
  n := pg_temp.q($$select count(*) from public.warranties w join public.units u on u.id = w.unit_id join public.owners o on o.id = u.owner_id where o.email like '%@demo.example.com'$$);
  return query select '5', 'ضمانات الوحدات', case when n >= 90 then '✅' else '❌' end, n || ' ضمان';

  -- ---------------- admin account
  n := pg_temp.q($$select count(*) from public.profiles where role = 'admin' and is_active$$);
  return query select '★', 'حساب مدير مفعّل', case when n >= 1 then '✅' else '❌' end,
    case when n >= 1 then pg_temp.qt($$select string_agg(email, '، ') from public.profiles where role = 'admin'$$) else 'أنشئ حساب المدير' end;
end $f$;

select * from pg_temp.verify();
