-- =====================================================================
--  المبيعات (طلب زيارة / حجز وحدة / طلب خدمة) + التوظيف والتدريب
--  شغّله بعد ملف 20261021000006_roles_sales_hr.sql
-- =====================================================================

insert into public.roles (code, name_ar, name_en, description) values
  ('sales', 'موظف مبيعات', 'Sales Officer', 'متابعة طلبات الزيارة والحجز والخدمات'),
  ('hr',    'الموارد البشرية', 'HR Officer', 'متابعة طلبات التوظيف والتدريب')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- Projects: location for visits
-- ---------------------------------------------------------------------
alter table public.projects
  add column if not exists address_text  text,
  add column if not exists location_url  text,   -- رابط Google Maps للمشاركة
  add column if not exists map_query     text,   -- إحداثيات "21.54,39.17" أو عنوان — للخريطة المضمّنة
  add column if not exists visit_hours   text;   -- مثل: يوميًا 4م – 10م

-- ---------------------------------------------------------------------
-- Units: sale price & availability (same table as after-sales units)
-- ---------------------------------------------------------------------
alter table public.units
  add column if not exists price        numeric(14,2) check (price is null or price >= 0),
  add column if not exists sale_status  text not null default 'not_for_sale'
    check (sale_status in ('available', 'reserved', 'sold', 'not_for_sale')),
  add column if not exists bathrooms    int,
  add column if not exists features     text;

update public.units set sale_status = 'sold' where owner_id is not null and sale_status = 'not_for_sale';

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.is_sales()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role()::text in ('admin', 'sales'), false)
$$;

create or replace function public.is_hr()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role()::text in ('admin', 'hr'), false)
$$;

create or replace function public.notify_role(p_roles text[], p_type text, p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  for v_user in select id from public.profiles where role::text = any(p_roles) and is_active loop
    perform public.notify_user(v_user, p_type, null, p_payload);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Leads → sales team
-- ---------------------------------------------------------------------
create sequence if not exists public.lead_ref_seq start 1001;

create table if not exists public.leads (
  id              uuid primary key default gen_random_uuid(),
  ref_no          text not null unique default ('LD-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.lead_ref_seq')::text, 5, '0')),
  kind            text not null check (kind in ('visit', 'booking', 'service', 'inquiry')),
  project_id      uuid references public.projects (id) on delete set null,
  unit_id         uuid references public.units (id) on delete set null,
  service         text,
  full_name       text not null,
  phone           text not null,
  email           text,
  city            text,
  preferred_date  date,
  preferred_time  text,
  message         text,
  status          text not null default 'new'
                  check (status in ('new', 'contacted', 'scheduled', 'visited', 'negotiating', 'booked', 'won', 'lost', 'cancelled')),
  assigned_to     uuid references public.profiles (id) on delete set null,
  internal_notes  text,
  follow_up_at    date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists leads_status_idx on public.leads (status, created_at desc);

drop trigger if exists trg_leads_touch on public.leads;
create trigger trg_leads_touch before update on public.leads for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Careers → HR
-- ---------------------------------------------------------------------
create table if not exists public.job_openings (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  department   text,
  location     text not null default 'جدة',
  employment   text not null default 'full_time' check (employment in ('full_time', 'part_time', 'contract', 'training')),
  description  text,
  requirements text,
  is_open      boolean not null default true,
  created_at   timestamptz not null default now()
);

create sequence if not exists public.application_ref_seq start 1001;

create table if not exists public.job_applications (
  id               uuid primary key default gen_random_uuid(),
  ref_no           text not null unique default ('HR-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.application_ref_seq')::text, 5, '0')),
  kind             text not null check (kind in ('job', 'training')),
  opening_id       uuid references public.job_openings (id) on delete set null,
  full_name        text not null,
  phone            text not null,
  email            text not null,
  city             text,
  education        text,
  major            text,
  university       text,
  experience_years int check (experience_years is null or experience_years between 0 and 60),
  linkedin_url     text,
  cv_path          text,
  cover_note       text,
  training_from    date,
  training_to      date,
  status           text not null default 'new'
                   check (status in ('new', 'screening', 'interview', 'offer', 'hired', 'accepted', 'rejected', 'archived')),
  internal_notes   text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists job_applications_status_idx on public.job_applications (status, created_at desc);

drop trigger if exists trg_applications_touch on public.job_applications;
create trigger trg_applications_touch before update on public.job_applications for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Public submission (visitors are not signed in) — validated server-side
-- ---------------------------------------------------------------------
create or replace function public.normalize_phone(p text)
returns text language sql immutable as $$
  select regexp_replace(coalesce(p, ''), '[^0-9+]', '', 'g')
$$;

create or replace function public.submit_lead(
  p_kind text, p_name text, p_phone text,
  p_project uuid default null, p_unit uuid default null, p_service text default null,
  p_email text default null, p_city text default null,
  p_date date default null, p_time text default null, p_message text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_phone text := public.normalize_phone(p_phone); v_ref text; v_project uuid := p_project; v_unit record;
begin
  if p_kind not in ('visit', 'booking', 'service', 'inquiry') then raise exception 'INVALID_KIND' using errcode = 'P0001'; end if;
  if length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'NAME_REQUIRED' using errcode = 'P0001'; end if;
  if v_phone !~ '^(\+?966|0)?5[0-9]{8}$' then raise exception 'INVALID_PHONE' using errcode = 'P0001'; end if;
  if p_email is not null and p_email <> '' and p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'INVALID_EMAIL' using errcode = 'P0001'; end if;
  if (select count(*) from public.leads where phone = v_phone and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'TOO_MANY_REQUESTS' using errcode = 'P0001';
  end if;

  if p_kind = 'booking' then
    select u.id, u.sale_status, b.project_id into v_unit
    from public.units u join public.buildings b on b.id = u.building_id where u.id = p_unit;
    if v_unit.id is null then raise exception 'UNIT_REQUIRED' using errcode = 'P0001'; end if;
    if v_unit.sale_status <> 'available' then raise exception 'UNIT_NOT_AVAILABLE' using errcode = 'P0001'; end if;
    v_project := v_unit.project_id;
  end if;
  if p_kind = 'service' and coalesce(btrim(p_service), '') = '' then raise exception 'SERVICE_REQUIRED' using errcode = 'P0001'; end if;
  if p_date is not null and p_date < current_date then raise exception 'DATE_IN_PAST' using errcode = 'P0001'; end if;

  insert into public.leads (kind, project_id, unit_id, service, full_name, phone, email, city, preferred_date, preferred_time, message)
  values (p_kind, v_project, case when p_kind = 'booking' then p_unit else null end, nullif(btrim(p_service), ''),
          left(btrim(p_name), 120), v_phone, nullif(lower(btrim(p_email)), ''), left(nullif(btrim(p_city), ''), 60),
          p_date, left(nullif(btrim(p_time), ''), 40), left(nullif(btrim(p_message), ''), 2000))
  returning ref_no into v_ref;

  perform public.notify_role(array['admin', 'sales'], 'lead_new',
    jsonb_build_object('ref_no', v_ref, 'kind', p_kind, 'name', left(btrim(p_name), 60), 'link', '/sales'));
  return v_ref;
end $$;

create or replace function public.submit_application(
  p_kind text, p_name text, p_phone text, p_email text,
  p_opening uuid default null, p_city text default null, p_education text default null, p_major text default null,
  p_university text default null, p_experience int default null, p_linkedin text default null, p_cv_path text default null,
  p_note text default null, p_training_from date default null, p_training_to date default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_phone text := public.normalize_phone(p_phone); v_ref text;
begin
  if p_kind not in ('job', 'training') then raise exception 'INVALID_KIND' using errcode = 'P0001'; end if;
  if length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'NAME_REQUIRED' using errcode = 'P0001'; end if;
  if v_phone !~ '^(\+?966|0)?5[0-9]{8}$' then raise exception 'INVALID_PHONE' using errcode = 'P0001'; end if;
  if coalesce(p_email, '') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'INVALID_EMAIL' using errcode = 'P0001'; end if;
  if p_cv_path is not null and p_cv_path !~ '^applications/[0-9a-f-]{36}\.(pdf|doc|docx)$' then raise exception 'INVALID_FILE' using errcode = 'P0001'; end if;
  if p_opening is not null and not exists (select 1 from public.job_openings where id = p_opening and is_open) then
    raise exception 'OPENING_CLOSED' using errcode = 'P0001';
  end if;
  if (select count(*) from public.job_applications where lower(email) = lower(btrim(p_email)) and created_at > now() - interval '1 day') >= 3 then
    raise exception 'TOO_MANY_REQUESTS' using errcode = 'P0001';
  end if;

  insert into public.job_applications (kind, opening_id, full_name, phone, email, city, education, major, university,
    experience_years, linkedin_url, cv_path, cover_note, training_from, training_to)
  values (p_kind, p_opening, left(btrim(p_name), 120), v_phone, lower(btrim(p_email)), left(nullif(btrim(p_city), ''), 60),
    left(nullif(btrim(p_education), ''), 60), left(nullif(btrim(p_major), ''), 120), left(nullif(btrim(p_university), ''), 120),
    p_experience, left(nullif(btrim(p_linkedin), ''), 300), p_cv_path, left(nullif(btrim(p_note), ''), 2000),
    case when p_kind = 'training' then p_training_from end, case when p_kind = 'training' then p_training_to end)
  returning ref_no into v_ref;

  perform public.notify_role(array['admin', 'hr'], 'application_new',
    jsonb_build_object('ref_no', v_ref, 'kind', p_kind, 'name', left(btrim(p_name), 60), 'link', '/hr'));
  return v_ref;
end $$;

revoke execute on function public.notify_role(text[], text, jsonb) from public, anon, authenticated;
grant execute on function public.submit_lead(text, text, text, uuid, uuid, text, text, text, date, text, text) to anon, authenticated;
grant execute on function public.submit_application(text, text, text, text, uuid, text, text, text, text, int, text, text, text, date, date) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Security
-- ---------------------------------------------------------------------
alter table public.leads            enable row level security;
alter table public.job_openings     enable row level security;
alter table public.job_applications enable row level security;

revoke all on public.leads, public.job_applications from anon;
revoke insert, delete, update on public.leads, public.job_applications from authenticated;
grant update (status, assigned_to, internal_notes, follow_up_at) on public.leads to authenticated;
grant update (status, internal_notes) on public.job_applications to authenticated;

drop policy if exists leads_read on public.leads;
drop policy if exists leads_update on public.leads;
create policy leads_read   on public.leads for select to authenticated using (public.is_sales());
create policy leads_update on public.leads for update to authenticated using (public.is_sales()) with check (public.is_sales());

drop policy if exists applications_read on public.job_applications;
drop policy if exists applications_update on public.job_applications;
create policy applications_read   on public.job_applications for select to authenticated using (public.is_hr());
create policy applications_update on public.job_applications for update to authenticated using (public.is_hr()) with check (public.is_hr());

revoke all on public.job_openings from anon;
grant select on public.job_openings to anon;
drop policy if exists openings_public on public.job_openings;
drop policy if exists openings_staff on public.job_openings;
drop policy if exists openings_write on public.job_openings;
create policy openings_public on public.job_openings for select to anon using (is_open);
create policy openings_staff  on public.job_openings for select to authenticated using (is_open or public.is_hr());
create policy openings_write  on public.job_openings for all to authenticated using (public.is_hr()) with check (public.is_hr());

-- public website: projects (+location), buildings, and units that are for sale — owner data never exposed
grant select (id, name_ar, name_en, city, district, image_url, delivery_year, sales_status, description,
              address_text, location_url, map_query, visit_hours) on public.projects to anon;
grant select (id, project_id, name, floors_count) on public.buildings to anon;
grant select (id, building_id, unit_number, floor, unit_type, area_sqm, bedrooms, bathrooms, image_url, price, sale_status, features)
  on public.units to anon;
drop policy if exists buildings_public_read on public.buildings;
drop policy if exists units_public_read on public.units;
create policy buildings_public_read on public.buildings for select to anon using (true);
create policy units_public_read on public.units for select to anon using (sale_status in ('available', 'reserved'));

-- staff: sales can read projects/units to answer leads
drop policy if exists projects_sales_read on public.projects;
drop policy if exists buildings_sales_read on public.buildings;
drop policy if exists units_sales_read on public.units;
create policy projects_sales_read  on public.projects  for select to authenticated using (public.is_sales());
create policy buildings_sales_read on public.buildings for select to authenticated using (public.is_sales());
create policy units_sales_read     on public.units     for select to authenticated using (public.is_sales());
-- sales can change price / availability (admin already can do everything)
drop policy if exists units_sales_update on public.units;
create policy units_sales_update on public.units for update to authenticated using (public.auth_role()::text = 'sales') with check (public.auth_role()::text = 'sales');

-- CVs: anyone can upload (write-only), only HR/admin can read
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cvs', 'cvs', false, 5242880,
        array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

drop policy if exists "cvs upload" on storage.objects;
drop policy if exists "cvs read" on storage.objects;
create policy "cvs upload" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'cvs' and name ~ '^applications/[0-9a-f-]{36}\.(pdf|doc|docx)$');
create policy "cvs read" on storage.objects for select to authenticated
  using (bucket_id = 'cvs' and public.is_hr());

-- demo opening so the careers page isn't empty (edit/close it from the HR screen)
insert into public.job_openings (title, department, location, employment, description, requirements)
select 'مهندس موقع', 'المشاريع', 'جدة', 'full_time',
       'متابعة تنفيذ أعمال المشاريع السكنية في الموقع والتنسيق مع المقاولين والاستشاريين.',
       'بكالوريوس هندسة مدنية · خبرة 3 سنوات فأكثر · عضوية الهيئة السعودية للمهندسين'
where not exists (select 1 from public.job_openings);

-- sales may only change the selling fields of a unit (never ownership / handover data)
create or replace function public.guard_sales_unit_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.auth_role()::text = 'sales' and (
       new.owner_id is distinct from old.owner_id or new.building_id is distinct from old.building_id
    or new.unit_number is distinct from old.unit_number or new.handover_date is distinct from old.handover_date
    or new.floor is distinct from old.floor or new.unit_type is distinct from old.unit_type
    or new.area_sqm is distinct from old.area_sqm or new.bedrooms is distinct from old.bedrooms) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_sales_unit on public.units;
create trigger trg_guard_sales_unit before update on public.units for each row execute function public.guard_sales_unit_update();

-- sales / HR see the names of their own team (for assignment lists)
drop policy if exists profiles_team_read on public.profiles;
create policy profiles_team_read on public.profiles for select to authenticated
  using ((public.is_sales() or public.is_hr()) and role::text in ('admin', 'sales', 'hr'));
