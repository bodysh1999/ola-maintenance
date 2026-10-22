-- =====================================================================
--  فحص شامل لكل التحديثات (ملفات SQL من 1 إلى 12 + البيانات التجريبية)
--  شغّله في Supabase → SQL Editor. للقراءة فقط — لا يغيّر أي شيء.
--
--  ✅ = موجود وسليم   ❌ = ناقص (العمود الأخير يقول أي ملف تشغّل)   ⚠️ = اختياري / تنبيه
-- =====================================================================

-- helpers (temporary — disappear when the session ends)
create or replace function pg_temp.n(p_sql text) returns bigint language plpgsql as $f$
declare v bigint;
begin execute p_sql into v; return v;
exception when others then return -1;
end $f$;

create or replace function pg_temp.has_table(p text) returns boolean language sql as $f$ select to_regclass(p) is not null $f$;
create or replace function pg_temp.has_col(p_table text, p_col text) returns boolean language sql as $f$
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = p_table and column_name = p_col) $f$;
create or replace function pg_temp.has_fn(p text) returns boolean language sql as $f$
  select exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = $1) $f$;
create or replace function pg_temp.has_policy(p_table text, p_name text) returns boolean language sql as $f$
  select exists (select 1 from pg_policies where tablename = p_table and policyname = p_name) $f$;
create or replace function pg_temp.has_role_value(p text) returns boolean language sql as $f$
  select exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'app_role' and e.enumlabel = $1) $f$;
create or replace function pg_temp.has_bucket(p text) returns boolean language plpgsql as $f$
begin return exists (select 1 from storage.buckets where id = p); exception when others then return false; end $f$;
create or replace function pg_temp.qt_safe(p_sql text) returns text language plpgsql as $f$
declare v text;
begin execute p_sql into v; return v;
exception when others then return null;
end $f$;
create or replace function pg_temp.missing(p_tables text[]) returns text language sql as $f$
  select string_agg(t, '، ') from unnest(p_tables) t where to_regclass('public.' || t) is null $f$;

create or replace function pg_temp.verify_all()
returns table ("الملف" text, "الفحص" text, "النتيجة" text, "التفاصيل" text) language plpgsql as $f$
declare m text; n bigint; ok boolean; v text;
begin
  -- ================= 1 · schema
  m := pg_temp.missing(array['roles','profiles','company_settings','projects','buildings','owners','units','contractors','technicians',
    'warranties','maintenance_requests','work_orders','work_order_parts','appointments','attachments','request_notes','quotes',
    'ratings','notifications','notification_outbox','activity_logs']);
  return query select '1', 'جداول نظام الصيانة (21)', case when m is null then '✅' else '❌' end, coalesce('ناقص: ' || m || ' ← شغّل ملف 1', 'كلها موجودة');
  n := pg_temp.n($$select count(*) from pg_trigger where tgname = 'on_auth_user_created'$$);
  return query select '1', 'إنشاء ملف شخصي لكل مستخدم جديد', case when n = 1 then '✅' else '❌' end, case when n = 1 then 'سليم' else 'شغّل ملف 1' end;

  -- ================= 2 · workflow
  ok := pg_temp.has_fn('transition_request') and pg_temp.has_fn('assign_request') and pg_temp.has_fn('report_summary') and pg_temp.has_fn('review_work');
  return query select '2', 'دوال سير عمل الصيانة', case when ok then '✅' else '❌' end, case when ok then 'سليم' else 'شغّل ملف 2' end;
  ok := pg_temp.has_table('public.request_overview');
  return query select '2', 'عرض البلاغات (request_overview)', case when ok then '✅' else '❌' end, case when ok then 'سليم' else 'شغّل ملف 2' end;

  -- ================= 3 · security
  select string_agg(c.relname, '، ') into v from pg_class c join pg_namespace s on s.oid = c.relnamespace
  where s.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  return query select '3', 'الحماية (RLS) مفعّلة على كل الجداول', case when v is null then '✅' else '❌' end, coalesce('بدون حماية: ' || v || ' ← شغّل الملف الخاص بها', 'كل الجداول محمية');
  ok := pg_temp.has_bucket('attachments') and pg_temp.has_bucket('branding');
  return query select '3', 'مخازن الملفات (المرفقات والشعار)', case when ok then '✅' else '❌' end, case when ok then 'سليم' else 'شغّل ملف 3' end;

  -- ================= 4 · company profile
  ok := pg_temp.has_col('company_settings', 'whatsapp') and pg_temp.has_col('company_settings', 'website_url') and pg_temp.has_col('projects', 'sales_status');
  return query select '4', 'بيانات الشركة وحالة المشاريع', case when ok then '✅' else '❌' end, case when ok then 'سليم' else 'شغّل ملف 4' end;

  -- ================= 5 · public site
  ok := pg_temp.has_policy('projects', 'projects_public_read');
  return query select '5', 'عرض المشاريع في الموقع للزوار', case when ok then '✅' else '❌' end, case when ok then 'سليم' else 'شغّل ملف 5' end;

  -- ================= 6 · roles
  ok := pg_temp.has_role_value('sales') and pg_temp.has_role_value('hr');
  return query select '6', 'دورا المبيعات والموارد البشرية', case when ok then '✅' else '❌' end, case when ok then 'سليم' else 'شغّل ملف 6 (لوحده)' end;

  -- ================= 7 · sales / services / careers
  m := pg_temp.missing(array['leads','job_openings','job_applications']);
  return query select '7', 'جداول طلبات العملاء والتوظيف', case when m is null then '✅' else '❌' end, coalesce('ناقص: ' || m || ' ← شغّل ملف 7', 'سليم');
  ok := pg_temp.has_col('units', 'price') and pg_temp.has_col('units', 'sale_status') and pg_temp.has_col('projects', 'map_query');
  return query select '7', 'أسعار الوحدات وموقع المشروع', case when ok then '✅' else '❌' end, case when ok then 'سليم' else 'شغّل ملف 7' end;
  ok := pg_temp.has_fn('submit_lead') and pg_temp.has_fn('submit_application');
  return query select '7', 'نماذج الزيارة والحجز والتوظيف', case when ok then '✅' else '❌' end, case when ok then 'سليم' else 'شغّل ملف 7' end;
  ok := pg_temp.has_bucket('cvs');
  return query select '7', 'مخزن السير الذاتية', case when ok then '✅' else '❌' end, case when ok then 'سليم' else 'شغّل ملف 7' end;
  n := pg_temp.n($$select count(*) from pg_trigger where tgname = 'trg_guard_sales_unit'$$);
  return query select '7', 'منع المبيعات من تعديل ملكية الوحدات', case when n = 1 then '✅' else '❌' end, case when n = 1 then 'سليم' else 'شغّل ملف 7 (النسخة الأخيرة)' end;

  -- ================= 8 · employee role
  ok := pg_temp.has_role_value('employee');
  return query select '8', 'دور الموظف', case when ok then '✅' else '❌' end, case when ok then 'سليم' else 'شغّل ملف 8 (لوحده)' end;

  -- ================= 9 · HR self-service
  m := pg_temp.missing(array['employees','employee_private','employee_salaries','leave_types','attendance','hr_requests','hr_request_steps','departments','work_locations']);
  return query select '9', 'جداول الموارد البشرية (9)', case when m is null then '✅' else '❌' end, coalesce('ناقص: ' || m || ' ← شغّل ملف 9', 'سليم');
  n := pg_temp.n($$select count(*) from public.leave_types$$);
  return query select '9', 'أنواع الإجازات حسب نظام العمل', case when n >= 11 then '✅' else '❌' end, case when n >= 11 then n || ' نوع' else 'شغّل ملف 9' end;
  ok := pg_temp.has_fn('attendance_punch') and pg_temp.has_fn('decide_hr_request') and pg_temp.has_fn('my_approval_queue') and pg_temp.has_fn('update_hr_settings');
  return query select '9', 'البصمة والاعتماد والإعدادات', case when ok then '✅' else '❌' end, case when ok then 'سليم' else 'شغّل ملف 9 (النسخة الأخيرة)' end;
  ok := pg_temp.has_bucket('hr-docs') and pg_temp.has_col('company_settings', 'gosi_saudi_rate');
  return query select '9', 'مرفقات الموظفين وإعدادات التأمينات', case when ok then '✅' else '❌' end, case when ok then 'سليم' else 'شغّل ملف 9' end;

  -- ================= 10 · hardening
  ok := case when pg_temp.has_fn('is_admin') then not has_function_privilege('anon', 'public.is_admin()', 'execute') else false end;
  return query select '10', 'دوال الصلاحيات مقفلة عن الزوار', case when ok then '✅' else '❌' end, case when ok then 'سليم' else 'شغّل ملف 10' end;
  ok := exists (select 1 from pg_proc where proname = 'touch_updated_at' and proconfig::text like '%search_path%');
  return query select '10', 'تثبيت search_path للدوال', case when ok then '✅' else '❌' end, case when ok then 'سليم' else 'شغّل ملف 10' end;
  ok := not pg_temp.has_policy('objects', 'branding read');
  return query select '10', 'منع استعراض ملفات الشعار', case when ok then '✅' else '❌' end, case when ok then 'سليم' else 'شغّل ملف 10' end;

  -- ================= 11 · fix
  ok := exists (select 1 from pg_proc where proname = 'submit_hr_request' and prosrc like '%v_lt_code%');
  return query select '11', 'إصلاح طلبات الموظفين (تعريف راتب، خارج دوام…)', case when ok then '✅' else '❌' end, case when ok then 'سليم' else 'شغّل ملف 11' end;

  -- ================= 12 · letters verification
  ok := pg_temp.has_fn('verify_hr_document') and pg_temp.has_col('hr_requests', 'verify_code') and pg_temp.has_col('company_settings', 'hr_signature_url');
  return query select '12', 'رمز QR للتحقق وتوقيع الخطابات', case when ok then '✅' else '❌' end, case when ok then 'سليم' else 'شغّل ملف 12' end;
  v := pg_temp.qt_safe($$select coalesce(hr_letter_signatory, '') from public.company_settings where id = 1$$);
  if ok and coalesce(v, '') = '' then
    return query select 'تنبيه', 'اسم مدير تنمية رأس المال البشري غير مُدخل', '⚠️', 'أدخله مع التوقيع من الموارد البشرية ← الهيكل والمواقع';
  end if;

  -- ================= accounts & data
  n := pg_temp.n($$select count(*) from public.profiles where role = 'admin' and is_active$$);
  return query select 'حسابات', 'حساب إدارة فعّال', case when n > 0 then '✅' else '❌' end, case when n > 0 then n || ' حساب' else 'أنشئ حساب إدارة' end;
  n := pg_temp.n($$select count(*) from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id)$$);
  return query select 'حسابات', 'كل مستخدم له ملف شخصي', case when n = 0 then '✅' else '❌' end, case when n = 0 then 'سليم' else n || ' مستخدم بدون ملف' end;
  n := pg_temp.n($$select count(*) from public.projects where name_ar like 'عُلا %'$$);
  return query select 'بيانات', 'مشاريع علا (17 → 25)', case when n >= 7 then '✅' else '⚠️' end, case when n >= 0 then n || ' مشروع' else '—' end || case when n < 7 then ' ← شغّل ola-projects.sql' else '' end;
  n := pg_temp.n($$select count(*) from auth.users where email like '%@demo.example.com'$$);
  return query select 'تجريبي', 'حسابات تجريبية', case when n > 0 then '⚠️' else '✅' end, case when n > 0 then n || ' حساب تجريبي — احذفها بـ demo-purge.sql قبل الإطلاق' else 'لا توجد حسابات تجريبية' end;
  n := pg_temp.n($$select count(*) from auth.users where email in ('sales@demo.example.com','hr@demo.example.com')$$);
  return query select 'تجريبي', 'المبيعات والموارد البشرية (sales-demo.sql)', case when n = 2 then '✅' else '⚠️' end, case when n = 2 then 'موجودة' else 'اختياري — لم يُشغّل' end;
  n := pg_temp.n($$select count(*) from public.employees$$);
  return query select 'تجريبي', 'ملفات الموظفين (hr-demo.sql)', case when n > 0 then '✅' else '⚠️' end, case when n > 0 then n || ' موظف' else 'لا يوجد موظفون بعد — شغّل hr-demo.sql أو أضفهم من الموارد البشرية' end;
  n := pg_temp.n($$select count(*) from public.work_locations where name like '%(مثال)%' and is_active$$);
  if n > 0 then
    return query select 'تنبيه', 'إحداثيات المكتب ما زالت مثالًا', '⚠️', 'عدّلها من الموارد البشرية ← الهيكل والمواقع وإلا ستُرفض البصمة';
  end if;
  n := pg_temp.n($$select count(*) from public.projects where sales_status = 'selling' and map_query is null$$);
  if n > 0 then
    return query select 'تنبيه', 'مشاريع للبيع بدون موقع على الخريطة', '⚠️', n || ' مشروع — أضف الموقع من الإدارة ← المشاريع';
  end if;
end $f$;

select * from pg_temp.verify_all();
