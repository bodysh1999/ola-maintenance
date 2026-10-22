-- =====================================================================
--  بوابة الملاك — المرحلة الأولى
--  1) ملف الوحدة الرقمي (مستندات لكل وحدة)
--  2) مركز الضمان: رمز تحقق لكل ضمان + تنبيه قبل الانتهاء بـ 30 يوم
--  3) تتبع البلاغ: صورة الفني، "الفني في الطريق"، تأكيد/طلب تغيير الموعد من العميل
--  4) إشعارات واتساب / SMS / بريد: طابور إرسال يسحبه الموقع
--  شغّله بعد ملف 13. آمن لإعادة التشغيل.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Unit documents
-- ---------------------------------------------------------------------
create table if not exists public.unit_documents (
  id            uuid primary key default gen_random_uuid(),
  unit_id       uuid not null references public.units (id) on delete cascade,
  kind          text not null default 'other'
                check (kind in ('sale_contract', 'title_deed', 'handover_report', 'drawings', 'manual', 'warranty_cert', 'other')),
  title         text not null check (length(btrim(title)) between 1 and 160),
  storage_path  text not null unique,
  file_name     text not null,
  mime_type     text,
  size_bytes    bigint,
  uploaded_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now()
);
create index if not exists unit_documents_unit_idx on public.unit_documents (unit_id);

-- documents are private to the unit's owner and company staff (technicians don't see contracts/deeds)
create or replace function public.can_view_unit_docs(p_unit uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff()
      or exists (select 1 from public.units u where u.id = p_unit and u.owner_id = public.my_owner_id())
$$;

create or replace function public.unit_id_from_path(p_name text)
returns uuid language plpgsql immutable set search_path = public as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when others then
  return null;
end $$;

alter table public.unit_documents enable row level security;
revoke all on public.unit_documents from anon;
revoke update on public.unit_documents from authenticated;
drop policy if exists unit_docs_read on public.unit_documents;
drop policy if exists unit_docs_insert on public.unit_documents;
drop policy if exists unit_docs_delete on public.unit_documents;
create policy unit_docs_read   on public.unit_documents for select to authenticated using (public.can_view_unit_docs(unit_id));
create policy unit_docs_insert on public.unit_documents for insert to authenticated
  with check (public.is_staff() and public.unit_id_from_path(storage_path) = unit_id);
create policy unit_docs_delete on public.unit_documents for delete to authenticated using (public.is_staff());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('unit-docs', 'unit-docs', false, 26214400,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "unit docs read"   on storage.objects;
drop policy if exists "unit docs upload" on storage.objects;
drop policy if exists "unit docs delete" on storage.objects;
create policy "unit docs read"   on storage.objects for select to authenticated
  using (bucket_id = 'unit-docs' and public.can_view_unit_docs(public.unit_id_from_path(name)));
create policy "unit docs upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'unit-docs' and public.is_staff() and public.unit_id_from_path(name) is not null);
create policy "unit docs delete" on storage.objects for delete to authenticated
  using (bucket_id = 'unit-docs' and public.is_staff());

-- ---------------------------------------------------------------------
-- 2) Warranty center
-- ---------------------------------------------------------------------
alter table public.warranties add column if not exists verify_code text;
update public.warranties set verify_code = replace(gen_random_uuid()::text, '-', '') where verify_code is null;
alter table public.warranties alter column verify_code set default replace(gen_random_uuid()::text, '-', '');
alter table public.warranties alter column verify_code set not null;
create unique index if not exists warranties_verify_code_idx on public.warranties (verify_code);

-- public verification of a warranty certificate (QR). Owner name is shortened.
create or replace function public.verify_warranty(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'title', w.title, 'category', w.category, 'start_date', w.start_date, 'end_date', w.end_date,
    'covered_items', w.covered_items, 'excluded_items', w.excluded_items,
    'responsible', coalesce(c.name, w.responsible_party),
    'unit_number', u.unit_number, 'building', b.name, 'project_ar', p.name_ar, 'project_en', p.name_en,
    'owner', case when o.full_name is null then null
                  else split_part(btrim(o.full_name), ' ', 1) ||
                       case when position(' ' in btrim(o.full_name)) > 0
                            then ' ' || left(regexp_replace((regexp_split_to_array(btrim(o.full_name), '\s+'))[array_length(regexp_split_to_array(btrim(o.full_name), '\s+'), 1)], '^ال', ''), 1) || '.'
                            else '' end end,
    'active', current_date between w.start_date and w.end_date)
  from public.warranties w
  join public.units u on u.id = w.unit_id
  left join public.buildings b on b.id = u.building_id
  left join public.projects p on p.id = b.project_id
  left join public.owners o on o.id = u.owner_id
  left join public.contractors c on c.id = w.contractor_id
  where length(coalesce(p_code, '')) = 32 and w.verify_code = lower(p_code)
$$;

-- expiry reminders (one per warranty per window)
create table if not exists public.warranty_alerts (
  warranty_id  uuid not null references public.warranties (id) on delete cascade,
  kind         text not null default 'd30',
  created_at   timestamptz not null default now(),
  primary key (warranty_id, kind)
);
alter table public.warranty_alerts enable row level security;
revoke all on public.warranty_alerts from anon, authenticated;

create or replace function public.queue_warranty_alerts()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in
    select w.id, w.title, w.end_date, u.unit_number, o.profile_id, (w.end_date - current_date) as days_left
    from public.warranties w
    join public.units u on u.id = w.unit_id
    join public.owners o on o.id = u.owner_id
    where o.profile_id is not null and o.account_status = 'active'
      and w.end_date between current_date and current_date + 30
      and not exists (select 1 from public.warranty_alerts a where a.warranty_id = w.id and a.kind = 'd30')
  loop
    insert into public.warranty_alerts (warranty_id, kind) values (r.id, 'd30') on conflict do nothing;
    perform public.notify_user(r.profile_id, 'warranty_expiring', null,
      jsonb_build_object('title', r.title, 'end_date', r.end_date, 'unit', r.unit_number, 'days', r.days_left, 'link', '/owner/warranties'));
    n := n + 1;
  end loop;
  return n;
end $$;

-- run it daily at 06:00 Riyadh when pg_cron is available (Supabase → Integrations → Cron)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'warranty-alerts';
    perform cron.schedule('warranty-alerts', '0 3 * * *', 'select public.queue_warranty_alerts()');
  end if;
exception when others then
  raise notice 'pg_cron not available — the website runs the warranty alerts instead';
end $$;

-- ---------------------------------------------------------------------
-- 3) Live tracking
-- ---------------------------------------------------------------------
alter table public.technicians  add column if not exists photo_url text;
alter table public.work_orders  add column if not exists on_the_way_at timestamptz,
                                add column if not exists eta_minutes int check (eta_minutes between 1 and 600);
alter table public.appointments add column if not exists owner_confirmed_at timestamptz,
                                add column if not exists owner_reschedule_note text,
                                add column if not exists owner_reschedule_at timestamptz;

create or replace function public.tech_on_the_way(p_wo uuid, p_eta int default null)
returns void language plpgsql security definer set search_path = public as $$
declare v public.work_orders; v_ref text; v_name text;
begin
  v := public._my_work_order(p_wo);
  if v.status not in ('assigned', 'returned', 'awaiting_parts') then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
  if p_eta is not null and (p_eta < 1 or p_eta > 600) then raise exception 'INVALID_ETA' using errcode = 'P0001'; end if;
  update public.work_orders set on_the_way_at = now(), eta_minutes = p_eta where id = p_wo;
  select ref_no into v_ref from public.maintenance_requests where id = v.request_id;
  select full_name into v_name from public.technicians where id = v.technician_id;
  insert into public.activity_logs (request_id, action, meta)
  values (v.request_id, 'on_the_way', jsonb_build_object('eta', p_eta));
  perform public.notify_user(public.request_owner_profile(v.request_id), 'tech_on_the_way', v.request_id,
    jsonb_build_object('ref_no', v_ref, 'tech', v_name, 'eta', p_eta));
end $$;

create or replace function public._my_visit(p_id uuid)
returns public.appointments language plpgsql stable security definer set search_path = public as $$
declare a public.appointments;
begin
  if not exists (select 1 from public.maintenance_requests where id = p_id and owner_id = public.my_owner_id()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into a from public.appointments where request_id = p_id and status = 'scheduled' order by created_at desc limit 1;
  if a.id is null then raise exception 'NO_VISIT' using errcode = 'P0001'; end if;
  return a;
end $$;

create or replace function public.owner_confirm_visit(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a public.appointments; v_ref text;
begin
  a := public._my_visit(p_id);
  update public.appointments set owner_confirmed_at = now(), owner_reschedule_note = null, owner_reschedule_at = null where id = a.id;
  select ref_no into v_ref from public.maintenance_requests where id = p_id;
  insert into public.activity_logs (request_id, action, meta) values (p_id, 'visit_owner_confirmed', jsonb_build_object('starts_at', a.starts_at));
  perform public.notify_staff('visit_owner_confirmed', p_id, jsonb_build_object('ref_no', v_ref));
  perform public.notify_user(public.request_technician_profile(p_id), 'visit_owner_confirmed', p_id, jsonb_build_object('ref_no', v_ref));
end $$;

create or replace function public.owner_request_reschedule(p_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare a public.appointments; v_ref text;
begin
  if coalesce(btrim(p_note), '') = '' then raise exception 'NOTE_REQUIRED' using errcode = 'P0001'; end if;
  a := public._my_visit(p_id);
  update public.appointments set owner_reschedule_note = left(btrim(p_note), 500), owner_reschedule_at = now(), owner_confirmed_at = null where id = a.id;
  select ref_no into v_ref from public.maintenance_requests where id = p_id;
  insert into public.activity_logs (request_id, action, note) values (p_id, 'reschedule_requested', left(btrim(p_note), 280));
  perform public.notify_staff('reschedule_requested', p_id, jsonb_build_object('ref_no', v_ref, 'note', left(btrim(p_note), 280)));
end $$;

-- a visit the technician has started no longer needs the "on the way" banner
create or replace function public.clear_on_the_way()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status <> old.status and new.status in ('in_progress', 'submitted', 'approved', 'cancelled') then
    new.on_the_way_at := null; new.eta_minutes := null;
  end if;
  return new;
end $$;
drop trigger if exists trg_wo_clear_otw on public.work_orders;
create trigger trg_wo_clear_otw before update of status on public.work_orders
  for each row execute function public.clear_on_the_way();

-- request_overview: tracking columns appended at the end (existing columns unchanged)
create or replace view public.request_overview with (security_invoker = true) as
select
  r.*,
  u.unit_number, u.floor, u.unit_type, u.image_url as unit_image_url,
  b.id as building_id, b.name as building_name,
  p.id as project_id, p.name_ar as project_name_ar, p.name_en as project_name_en,
  o.full_name as owner_name, o.phone as owner_phone,
  w.id as work_order_id, w.status as work_order_status, w.technician_id,
  t.full_name as technician_name, t.phone as technician_phone,
  a.starts_at as visit_at, a.ends_at as visit_ends_at,
  (r.due_at < now() and r.status not in ('completed', 'rejected')) as is_overdue,
  rt.score as rating_score,
  t.photo_url as technician_photo,
  w.on_the_way_at, w.eta_minutes,
  a.id as appointment_id, a.status as appointment_status,
  a.owner_confirmed_at, a.owner_reschedule_note, a.owner_reschedule_at
from public.maintenance_requests r
join public.units u           on u.id = r.unit_id
left join public.buildings b  on b.id = u.building_id
left join public.projects p   on p.id = b.project_id
left join public.owners o     on o.id = r.owner_id
left join lateral (
  select * from public.work_orders w
  where w.request_id = r.id and w.status <> 'cancelled'
  order by w.created_at desc limit 1) w on true
left join public.technicians t on t.id = w.technician_id
left join lateral (
  select * from public.appointments a
  where a.request_id = r.id and a.status in ('scheduled', 'done')
  order by a.created_at desc limit 1) a on true
left join public.ratings rt on rt.request_id = r.id;

-- ---------------------------------------------------------------------
-- 4) External notifications (WhatsApp / SMS / email)
-- ---------------------------------------------------------------------
alter table public.company_settings add column if not exists notify_roles text[] not null default '{owner}';
alter table public.profiles add column if not exists notify_external boolean not null default true;
grant update (notify_external) on public.profiles to authenticated;

alter table public.notification_outbox drop constraint if exists notification_outbox_status_check;
alter table public.notification_outbox add constraint notification_outbox_status_check
  check (status in ('pending', 'sending', 'sent', 'failed', 'skipped'));
alter table public.notification_outbox add column if not exists claimed_at timestamptz;
create index if not exists notification_outbox_pending_idx on public.notification_outbox (created_at) where status in ('pending', 'sending');

create or replace function public.notify_user(p_user uuid, p_type text, p_request uuid, p_payload jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_channel text; v_role text; v_ext boolean;
begin
  if p_user is null then return; end if;
  insert into public.notifications (user_id, type, request_id, payload)
  values (p_user, p_type, p_request, coalesce(p_payload, '{}'))
  returning id into v_id;

  -- outside channels: only for the roles chosen in settings (default: owners) who did not opt out
  select role::text, notify_external into v_role, v_ext from public.profiles where id = p_user;
  if coalesce(v_ext, false) and v_role = any (coalesce((select notify_roles from public.company_settings where id = 1), '{}')) then
    for v_channel in select unnest(notify_channels) from public.company_settings where id = 1 loop
      insert into public.notification_outbox (notification_id, channel) values (v_id, v_channel);
    end loop;
  end if;
end $$;

-- the website's sender (service role) claims a batch, sends, then reports back
create or replace function public.claim_outbox(p_limit int default 20)
returns table (outbox_id uuid, channel text, type text, request_id uuid, payload jsonb,
               phone text, email text, full_name text, locale text, role text)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with picked as (
    select x.id from public.notification_outbox x
    where (x.status = 'pending' or (x.status = 'sending' and x.claimed_at < now() - interval '10 minutes'))
      and x.attempts < 5 and x.created_at > now() - interval '3 days'
    order by x.created_at
    limit greatest(1, least(p_limit, 100))
    for update skip locked
  ), upd as (
    update public.notification_outbox x set status = 'sending', claimed_at = now(), attempts = x.attempts + 1
    from picked where x.id = picked.id
    returning x.id, x.channel, x.notification_id
  )
  select upd.id, upd.channel, n.type, n.request_id, n.payload,
         coalesce(nullif(pr.phone, ''), ow.phone, t.phone), coalesce(pr.email, ow.email), pr.full_name, pr.locale, pr.role::text
  from upd
  join public.notifications n on n.id = upd.notification_id
  join public.profiles pr on pr.id = n.user_id
  left join public.owners ow on ow.profile_id = pr.id
  left join public.technicians t on t.profile_id = pr.id;
end $$;

create or replace function public.finish_outbox(p_id uuid, p_status text, p_error text default null)
returns void language sql security definer set search_path = public as $$
  update public.notification_outbox set
    status = case when p_status = 'failed' and attempts < 5 then 'pending' else p_status end,
    last_error = left(p_error, 500),
    sent_at = case when p_status = 'sent' then now() else sent_at end
  where id = p_id
$$;

-- ---------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------
revoke execute on function
  public.claim_outbox(int), public.finish_outbox(uuid, text, text),
  public._my_visit(uuid), public.clear_on_the_way()
from public, anon, authenticated;
grant execute on function public.claim_outbox(int), public.finish_outbox(uuid, text, text), public.queue_warranty_alerts() to service_role;

revoke execute on function
  public.tech_on_the_way(uuid, int), public.owner_confirm_visit(uuid), public.owner_request_reschedule(uuid, text),
  public.queue_warranty_alerts(), public.can_view_unit_docs(uuid), public.unit_id_from_path(text), public.verify_warranty(text)
from public, anon;
grant execute on function
  public.tech_on_the_way(uuid, int), public.owner_confirm_visit(uuid), public.owner_request_reschedule(uuid, text),
  public.queue_warranty_alerts(), public.can_view_unit_docs(uuid), public.unit_id_from_path(text)
to authenticated;
grant execute on function public.verify_warranty(text) to anon, authenticated;
