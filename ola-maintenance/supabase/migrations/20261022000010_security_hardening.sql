-- =====================================================================
--  تقوية الأمان حسب ملاحظات Supabase Security Advisor
--  آمن لإعادة التشغيل. شغّله بعد ملف 9.
-- =====================================================================

-- 1) Function Search Path Mutable → ثبّت search_path
alter function public.touch_updated_at() set search_path = public;
alter function public.status_transition_allowed(public.request_status, public.request_status) set search_path = public;
alter function public.request_id_from_path(text) set search_path = public;
alter function public.normalize_phone(text) set search_path = public;
alter function public.distance_m(double precision, double precision, double precision, double precision) set search_path = public;
alter function public.today_riyadh() set search_path = public;

-- 2) Public Bucket Allows Listing → الشعار يظهر من رابطه العام بدون سياسة قراءة عامة؛
--    القراءة عبر الـ API للإدارة فقط (يحتاجها رفع الشعار بالاستبدال)
drop policy if exists "branding read" on storage.objects;
drop policy if exists "branding admin read" on storage.objects;
create policy "branding admin read" on storage.objects for select to authenticated
  using (bucket_id = 'branding' and public.is_admin());

-- 3) دوال الصلاحيات الداخلية: غير مسجّل الدخول لا يحتاجها إطلاقًا
--    (سياسات الزائر لا تستخدم أيًا منها — الدوال المقصودة للزوار فقط submit_lead و submit_application)
revoke execute on function
  public.auth_role(), public.is_staff(), public.is_admin(), public.is_sales(), public.is_hr(),
  public.my_owner_id(), public.my_technician_id(), public.my_employee_id(),
  public.can_view_request(uuid), public.can_view_unit(uuid), public.can_view_employee(uuid), public.can_view_hr_request(uuid),
  public.request_owner_profile(uuid), public.request_technician_profile(uuid), public.manager_chain(uuid)
from public, anon;

-- المسجّلون يحتاجون دوال التحقق فقط لأن سياسات RLS تستدعيها باسمهم
grant execute on function
  public.auth_role(), public.is_staff(), public.is_admin(), public.is_sales(), public.is_hr(),
  public.my_owner_id(), public.my_technician_id(), public.my_employee_id(),
  public.can_view_request(uuid), public.can_view_unit(uuid), public.can_view_employee(uuid), public.can_view_hr_request(uuid)
to authenticated;

-- دوال داخلية لا تُستدعى إلا من دوال النظام نفسها — لا أحد يستدعيها مباشرة
revoke execute on function
  public.request_owner_profile(uuid), public.request_technician_profile(uuid), public.manager_chain(uuid),
  public.evaluate_warranty(uuid, public.maintenance_category, date)
from authenticated;

-- دوال المشغلات (triggers) لا تُستدعى عبر الـ API
revoke execute on function public.guard_sales_unit_update(), public.guard_self_hr_edit() from public, anon, authenticated;
