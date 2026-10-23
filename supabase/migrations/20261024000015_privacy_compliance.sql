-- =====================================================================
--  الامتثال لنظام حماية البيانات الشخصية (سدايا) وضوابط الأمن السيبراني
--  • سجل الموافقات (منح وسحب) لكل غرض ونسخة سياسة
--  • طلبات أصحاب البيانات (نسخة / تصحيح / حذف / اعتراض) بمهلة 30 يومًا
--  • سجل تعديلات (Audit log) للجداول الحساسة
--  • مدد الاحتفاظ والحذف التلقائي
--  • إعدادات: نسخة السياسة، مسؤول حماية البيانات، مكان الاستضافة، إلزام التحقق بخطوتين
--  شغّله بعد ملف 14. آمن لإعادة التشغيل.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------
alter table public.company_settings
  add column if not exists privacy_version        text not null default '1.0',
  add column if not exists privacy_updated_on     date not null default current_date,
  add column if not exists dpo_name               text,
  add column if not exists dpo_email              text,
  add column if not exists data_hosting_region    text,
  add column if not exists retention_cv_months    int  not null default 24 check (retention_cv_months between 1 and 120),
  add column if not exists retention_leads_months int  not null default 24 check (retention_leads_months between 1 and 120),
  add column if not exists retention_notif_days   int  not null default 365 check (retention_notif_days between 30 and 3650),
  add column if not exists require_staff_mfa      boolean not null default false;

alter table public.profiles add column if not exists privacy_accepted_version text,
                            add column if not exists privacy_accepted_at timestamptz;

-- ---------------------------------------------------------------------
-- 1) Consent log (append-only: every grant and every withdrawal is a row)
-- ---------------------------------------------------------------------
create table if not exists public.consents (
  id              bigint generated always as identity primary key,
  profile_id      uuid references public.profiles (id) on delete set null,
  subject_ref     text,                 -- visitor forms: the lead / application reference
  subject_email   text,
  subject_phone   text,
  purpose         text not null check (purpose in ('privacy_policy', 'terms', 'marketing', 'whatsapp_updates', 'cv_processing', 'service_request')),
  granted         boolean not null,
  policy_version  text not null,
  channel         text not null default 'portal' check (channel in ('web_form', 'portal', 'admin')),
  created_at      timestamptz not null default now()
);
create index if not exists consents_profile_idx on public.consents (profile_id, purpose, created_at desc);
create index if not exists consents_ref_idx on public.consents (subject_ref);
alter table public.consents enable row level security;
revoke all on public.consents from anon;
revoke insert, update, delete on public.consents from authenticated;
drop policy if exists consents_read on public.consents;
create policy consents_read on public.consents for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());

-- current state per user & purpose
create or replace view public.my_consents with (security_invoker = true) as
select distinct on (purpose) purpose, granted, policy_version, created_at
from public.consents where profile_id = auth.uid()
order by purpose, created_at desc;

-- signed-in user accepts the current policy (+ optional purposes)
create or replace function public.accept_privacy(p_marketing boolean default false, p_whatsapp boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare v_ver text;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select privacy_version into v_ver from public.company_settings where id = 1;
  update public.profiles set privacy_accepted_version = v_ver, privacy_accepted_at = now(),
         notify_external = coalesce(p_whatsapp, notify_external) where id = auth.uid();
  insert into public.consents (profile_id, purpose, granted, policy_version, channel) values
    (auth.uid(), 'privacy_policy', true, v_ver, 'portal'),
    (auth.uid(), 'terms', true, v_ver, 'portal'),
    (auth.uid(), 'marketing', coalesce(p_marketing, false), v_ver, 'portal'),
    (auth.uid(), 'whatsapp_updates', coalesce(p_whatsapp, true), v_ver, 'portal');
end $$;

-- grant / withdraw an optional purpose (as easy as granting it)
create or replace function public.set_my_consent(p_purpose text, p_granted boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_ver text;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_purpose not in ('marketing', 'whatsapp_updates') then raise exception 'INVALID_PURPOSE' using errcode = 'P0001'; end if;
  select privacy_version into v_ver from public.company_settings where id = 1;
  insert into public.consents (profile_id, purpose, granted, policy_version, channel) values (auth.uid(), p_purpose, p_granted, v_ver, 'portal');
  if p_purpose = 'whatsapp_updates' then update public.profiles set notify_external = p_granted where id = auth.uid(); end if;
end $$;

-- visitor forms: consent recorded against the reference the form just created (only within 15 minutes)
create or replace function public.log_form_consent(p_ref text, p_purposes text[])
returns void language plpgsql security definer set search_path = public as $$
declare v_ver text; v_email text; v_phone text; p text;
begin
  select email, phone into v_email, v_phone from public.leads where ref_no = p_ref and created_at > now() - interval '15 minutes';
  if v_phone is null then
    select email, phone into v_email, v_phone from public.job_applications where ref_no = p_ref and created_at > now() - interval '15 minutes';
  end if;
  if v_phone is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if exists (select 1 from public.consents where subject_ref = p_ref) then return; end if;
  select privacy_version into v_ver from public.company_settings where id = 1;
  foreach p in array p_purposes loop
    if p in ('privacy_policy', 'marketing', 'cv_processing', 'service_request') then
      insert into public.consents (subject_ref, subject_email, subject_phone, purpose, granted, policy_version, channel)
      values (p_ref, v_email, v_phone, p, true, v_ver, 'web_form');
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2) Data-subject requests (PDPL rights) — answer within 30 days
-- ---------------------------------------------------------------------
create sequence if not exists public.data_request_seq start 1001;
create table if not exists public.data_requests (
  id           uuid primary key default gen_random_uuid(),
  ref_no       text not null unique default ('DR-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.data_request_seq')::text, 5, '0')),
  profile_id   uuid references public.profiles (id) on delete set null,
  type         text not null check (type in ('access', 'correction', 'deletion', 'objection', 'other')),
  details      text,
  status       text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'rejected')),
  due_at       timestamptz not null default (now() + interval '30 days'),
  response     text,
  handled_by   uuid references public.profiles (id) on delete set null,
  handled_at   timestamptz,
  created_at   timestamptz not null default now()
);
alter table public.data_requests enable row level security;
revoke all on public.data_requests from anon;
revoke insert, update, delete on public.data_requests from authenticated;
drop policy if exists data_requests_read on public.data_requests;
create policy data_requests_read on public.data_requests for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());

create or replace function public.notify_admins(p_type text, p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  for v in select id from public.profiles where role = 'admin' and is_active loop
    perform public.notify_user(v, p_type, null, p_payload);
  end loop;
end $$;

create or replace function public.submit_data_request(p_type text, p_details text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_ref text;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_type not in ('access', 'correction', 'deletion', 'objection', 'other') then raise exception 'INVALID_TYPE' using errcode = 'P0001'; end if;
  if p_type in ('correction', 'deletion', 'objection', 'other') and coalesce(btrim(p_details), '') = '' then
    raise exception 'NOTE_REQUIRED' using errcode = 'P0001';
  end if;
  if (select count(*) from public.data_requests where profile_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;
  -- an access request is answered at once by the export; it is still recorded
  insert into public.data_requests (profile_id, type, details, status, handled_at, response)
  values (auth.uid(), p_type, left(btrim(p_details), 2000),
          case when p_type = 'access' then 'completed' else 'open' end,
          case when p_type = 'access' then now() end,
          case when p_type = 'access' then 'تم تنزيل نسخة البيانات إلكترونيًا' end)
  returning ref_no into v_ref;
  if p_type <> 'access' then
    perform public.notify_admins('data_request_new', jsonb_build_object('ref_no', v_ref, 'link', '/admin/privacy'));
  end if;
  return v_ref;
end $$;

create or replace function public.handle_data_request(p_id uuid, p_status text, p_response text)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_status not in ('in_progress', 'completed', 'rejected') then raise exception 'INVALID_STATUS' using errcode = 'P0001'; end if;
  if p_status in ('completed', 'rejected') and coalesce(btrim(p_response), '') = '' then raise exception 'NOTE_REQUIRED' using errcode = 'P0001'; end if;
  update public.data_requests set status = p_status, response = nullif(btrim(p_response), ''), handled_by = auth.uid(),
         handled_at = case when p_status in ('completed', 'rejected') then now() else handled_at end
  where id = p_id returning * into r;
  if r.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if p_status in ('completed', 'rejected') then
    perform public.notify_user(r.profile_id, 'data_request_done', null, jsonb_build_object('ref_no', r.ref_no, 'link', '/account/data'));
  end if;
end $$;

-- visitors (no account) who ask to be erased: delete their leads / applications, return CV paths to remove
create or replace function public.erase_public_subject(p_email text, p_phone text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_phone text := public.normalize_phone(p_phone); v_email text := lower(nullif(btrim(p_email), ''));
        v_cvs text[]; n_leads int; n_apps int;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if v_email is null and coalesce(v_phone, '') = '' then raise exception 'REQUIRED' using errcode = 'P0001'; end if;
  select array_agg(cv_path) filter (where cv_path is not null) into v_cvs from public.job_applications
   where (v_email is not null and lower(email) = v_email) or (v_phone <> '' and phone = v_phone);
  with d as (delete from public.job_applications where (v_email is not null and lower(email) = v_email) or (v_phone <> '' and phone = v_phone) returning 1)
  select count(*) into n_apps from d;
  with d as (delete from public.leads where (v_email is not null and lower(email) = v_email) or (v_phone <> '' and phone = v_phone) returning 1)
  select count(*) into n_leads from d;
  update public.consents set subject_email = null, subject_phone = null
   where profile_id is null and ((v_email is not null and lower(subject_email) = v_email) or (v_phone <> '' and subject_phone = v_phone));
  insert into public.audit_log (actor, actor_role, table_name, row_id, action, changed)
  values (auth.uid(), 'admin', 'public_subject', coalesce(v_email, v_phone), 'ERASE', array['leads:' || n_leads, 'applications:' || n_apps]);
  return jsonb_build_object('leads', n_leads, 'applications', n_apps, 'cv_paths', coalesce(to_jsonb(v_cvs), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------
-- 3) Audit log for sensitive tables (who changed what, when)
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor       uuid,
  actor_role  text,
  table_name  text not null,
  row_id      text,
  action      text not null,
  changed     text[],
  old_values  jsonb,
  new_values  jsonb
);
create index if not exists audit_log_at_idx on public.audit_log (at desc);
create index if not exists audit_log_table_idx on public.audit_log (table_name, at desc);
alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon;
revoke insert, update, delete on public.audit_log from authenticated;
drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select to authenticated using (public.is_admin());

create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
        n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
        keys text[]; k text; masked boolean := tg_table_name = 'employee_private';
begin
  if tg_op = 'UPDATE' then
    select array_agg(key) into keys from jsonb_each(n) e
    where key not in ('updated_at') and (o -> key) is distinct from (n -> key);
    if keys is null then return new; end if;
    -- keep only the changed fields
    o := (select jsonb_object_agg(key, o -> key) from unnest(keys) key);
    n := (select jsonb_object_agg(key, n -> key) from unnest(keys) key);
  end if;
  if masked then  -- ID / bank numbers: record that they changed, never their values
    o := null; n := null;
  end if;
  insert into public.audit_log (actor, actor_role, table_name, row_id, action, changed, old_values, new_values)
  values (auth.uid(), (select role::text from public.profiles where id = auth.uid()), tg_table_name,
          coalesce(n ->> 'id', o ->> 'id', to_jsonb(coalesce(new, old)) ->> 'id', to_jsonb(coalesce(new, old)) ->> 'employee_id'),
          tg_op, keys, o, n);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'company_settings', 'owners', 'units', 'warranties', 'unit_documents',
                           'employees', 'employee_salaries', 'employee_private', 'leave_types', 'departments', 'work_locations', 'technicians']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_audit on public.%I', t);
      execute format('create trigger trg_audit after insert or update or delete on public.%I for each row execute function public.audit_trigger()', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4) Retention: delete what is no longer needed
-- ---------------------------------------------------------------------
create or replace function public.purge_expired_data()
returns jsonb language plpgsql security definer set search_path = public as $$
declare s record; v_cvs text[]; n_apps int; n_leads int; n_notif int; n_out int; n_audit int;
begin
  select * into s from public.company_settings where id = 1;
  select array_agg(cv_path) filter (where cv_path is not null) into v_cvs from public.job_applications
   where created_at < now() - make_interval(months => s.retention_cv_months) and status not in ('hired', 'accepted');
  with d as (delete from public.job_applications where created_at < now() - make_interval(months => s.retention_cv_months)
             and status not in ('hired', 'accepted') returning 1) select count(*) into n_apps from d;
  with d as (delete from public.leads where created_at < now() - make_interval(months => s.retention_leads_months)
             and status in ('lost', 'cancelled', 'new', 'contacted') returning 1) select count(*) into n_leads from d;
  with d as (delete from public.notifications where created_at < now() - make_interval(days => s.retention_notif_days) returning 1)
  select count(*) into n_notif from d;
  with d as (delete from public.notification_outbox where status in ('sent', 'skipped', 'failed') and created_at < now() - interval '90 days' returning 1)
  select count(*) into n_out from d;
  with d as (delete from public.audit_log where at < now() - interval '5 years' returning 1) select count(*) into n_audit from d;
  return jsonb_build_object('applications', n_apps, 'leads', n_leads, 'notifications', n_notif, 'outbox', n_out, 'audit', n_audit,
                            'cv_paths', coalesce(to_jsonb(v_cvs), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------
-- 5) Privacy settings (admin)
-- ---------------------------------------------------------------------
create or replace function public.update_privacy_settings(
  p_dpo_name text, p_dpo_email text, p_region text,
  p_cv_months int, p_leads_months int, p_notif_days int, p_require_mfa boolean, p_bump_version boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  update public.company_settings set
    dpo_name = nullif(btrim(p_dpo_name), ''), dpo_email = nullif(btrim(p_dpo_email), ''),
    data_hosting_region = nullif(btrim(p_region), ''),
    retention_cv_months = greatest(1, least(coalesce(p_cv_months, retention_cv_months), 120)),
    retention_leads_months = greatest(1, least(coalesce(p_leads_months, retention_leads_months), 120)),
    retention_notif_days = greatest(30, least(coalesce(p_notif_days, retention_notif_days), 3650)),
    require_staff_mfa = coalesce(p_require_mfa, require_staff_mfa),
    -- a new policy version asks every user to accept it again
    privacy_version = case when p_bump_version then (split_part(privacy_version, '.', 1)::int + 1)::text || '.0' else privacy_version end,
    privacy_updated_on = case when p_bump_version then current_date else privacy_updated_on end
  where id = 1;
end $$;

-- ---------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------
revoke execute on function public.audit_trigger(), public.notify_admins(text, jsonb), public.purge_expired_data() from public, anon, authenticated;
grant execute on function public.purge_expired_data() to service_role;
revoke execute on function public.log_form_consent(text, text[]) from public;
grant execute on function public.log_form_consent(text, text[]) to anon, authenticated;
revoke execute on function
  public.accept_privacy(boolean, boolean), public.set_my_consent(text, boolean),
  public.submit_data_request(text, text), public.handle_data_request(uuid, text, text),
  public.erase_public_subject(text, text),
  public.update_privacy_settings(text, text, text, int, int, int, boolean, boolean)
from public, anon;
grant execute on function
  public.accept_privacy(boolean, boolean), public.set_my_consent(text, boolean),
  public.submit_data_request(text, text), public.handle_data_request(uuid, text, text),
  public.erase_public_subject(text, text),
  public.update_privacy_settings(text, text, text, int, int, int, boolean, boolean)
to authenticated;

-- daily retention with pg_cron when available (the website's daily job runs it too)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'privacy-retention';
    perform cron.schedule('privacy-retention', '30 3 * * *', 'select public.purge_expired_data()');
  end if;
exception when others then
  raise notice 'pg_cron not available — the website runs the retention job instead';
end $$;
