-- =====================================================================
--  أدوار جديدة: موظف مبيعات + موارد بشرية
--  (ملف مستقل لأن PostgreSQL لا يسمح باستخدام قيمة enum جديدة في نفس العملية)
-- =====================================================================
alter type public.app_role add value if not exists 'sales';
alter type public.app_role add value if not exists 'hr';
