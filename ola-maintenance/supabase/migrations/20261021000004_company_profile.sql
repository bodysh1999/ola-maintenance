-- =====================================================================
--  بيانات الشركة الرسمية (من موقع ola-altamayuz.com) + حالة المشاريع
-- =====================================================================

alter table public.company_settings
  add column if not exists whatsapp      text,
  add column if not exists website_url   text,
  add column if not exists instagram_url text,
  add column if not exists snapchat_url  text,
  add column if not exists tiktok_url    text;

update public.company_settings set
  name_ar       = 'علا التميز للاستثمار والتسويق العقاري',
  name_en       = 'Ola Al-Tamayuz Real Estate Investment & Marketing',
  primary_color = '#3C2E52',
  support_phone = coalesce(support_phone, '8001111379'),
  support_email = coalesce(support_email, 'info@ola-altamayuz.com'),
  whatsapp      = coalesce(whatsapp, '966555003618'),
  website_url   = coalesce(website_url, 'https://www.ola-altamayuz.com'),
  instagram_url = coalesce(instagram_url, 'https://www.instagram.com/ola.altamayuz'),
  snapchat_url  = coalesce(snapchat_url, 'https://www.snapchat.com/add/olaaltamayuz'),
  tiktok_url    = coalesce(tiktok_url, 'https://www.tiktok.com/@ola.altamayuz')
where id = 1;

-- Sales/construction stage shown on project cards (مباع / مرحلة البيع / مرحلة الإنشاء)
alter table public.projects
  add column if not exists sales_status text not null default 'sold'
    check (sales_status in ('construction', 'selling', 'sold'));
