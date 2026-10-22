-- =====================================================================
--  الموقع العام: عرض قائمة المشاريع (الاسم والصورة والحالة) للزوار بدون تسجيل دخول
--  لا يكشف أي بيانات أخرى — الوحدات والملاك والبلاغات تبقى محمية.
-- =====================================================================
grant select (id, name_ar, name_en, city, district, image_url, delivery_year, sales_status) on public.projects to anon;

drop policy if exists projects_public_read on public.projects;
create policy projects_public_read on public.projects for select to anon using (true);
