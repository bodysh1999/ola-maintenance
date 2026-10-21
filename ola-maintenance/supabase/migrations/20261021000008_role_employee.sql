-- دور "موظف" لمن ليس له دور آخر في النظام (يستخدم الخدمات الذاتية فقط)
-- شغّله وحده قبل ملف 20261021000009_hr_self_service.sql
alter type public.app_role add value if not exists 'employee';
