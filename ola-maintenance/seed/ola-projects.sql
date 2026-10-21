-- =====================================================================
--  مشاريع علا التميز الحالية (من الموقع الرسمي) — تُشغَّل مرة واحدة بعد الـ migrations
--  الصور مرتبطة بمكتبة صور موقع الشركة؛ يمكن استبدالها لاحقًا من صفحة المشروع.
--  المدينة/الحي غير مذكورة في الموقع — عدّلها من لوحة الإدارة.
-- =====================================================================
insert into public.projects (name_ar, name_en, city, sales_status, image_url, description)
select v.name_ar, v.name_en, 'جدة', v.status, v.img, v.descr
from (values
  ('عُلا 17', 'Ola 17', 'sold',         'https://files.cdn-files-a.com/uploads/7515788/800_6941347e1ea48.jpg', 'مشروع مباع — ضمن خدمة ما بعد البيع'),
  ('عُلا 20', 'Ola 20', 'sold',         'https://files.cdn-files-a.com/uploads/7515788/800_693fe29a196be.jpg', 'مشروع مباع — ضمن خدمة ما بعد البيع'),
  ('عُلا 21', 'Ola 21', 'selling',      'https://files.cdn-files-a.com/uploads/7515788/800_6914f1c01fbad.jpg', 'مرحلة البيع'),
  ('عُلا 22', 'Ola 22', 'construction', 'https://files.cdn-files-a.com/uploads/7515788/800_698a2dd4e35c6.jpg', 'مرحلة الإنشاء'),
  ('عُلا 23', 'Ola 23', 'construction', 'https://files.cdn-files-a.com/uploads/7515788/800_693fe02562daf.jpg', 'مرحلة الإنشاء'),
  ('عُلا 24', 'Ola 24', 'construction', 'https://files.cdn-files-a.com/uploads/7515788/800_693fe1cf770a2.png', 'مرحلة الإنشاء'),
  ('عُلا 25', 'Ola 25', 'construction', 'https://files.cdn-files-a.com/uploads/7515788/800_693fe11dc857d.jpg', 'مرحلة الإنشاء')
) as v(name_ar, name_en, status, img, descr)
where not exists (select 1 from public.projects p where p.name_ar = v.name_ar);
