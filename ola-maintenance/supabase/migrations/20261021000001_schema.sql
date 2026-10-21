-- =====================================================================
--  نظام إدارة الصيانة العقارية — المخطط الأساسي
--  Single-company after-sales maintenance system (NOT multi-tenant)
-- =====================================================================


-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.app_role as enum ('admin', 'supervisor', 'technician', 'owner');

create type public.request_status as enum (
  'new',               -- طلب جديد
  'under_review',      -- قيد المراجعة
  'approved',          -- تمت الموافقة
  'assigned',          -- تم تعيين الفني
  'scheduled',         -- تمت جدولة الزيارة
  'in_progress',       -- جاري التنفيذ
  'pending_approval',  -- بانتظار اعتماد الإنجاز
  'completed',         -- مكتمل
  'awaiting_parts',    -- بانتظار قطع غيار
  'postponed',         -- مؤجل
  'rejected',          -- مرفوض
  'reopened'           -- أعيد فتح الطلب
);

create type public.request_priority as enum ('low', 'medium', 'high', 'urgent');

create type public.maintenance_category as enum (
  'electrical', 'plumbing', 'hvac', 'elevators', 'tiles',
  'painting', 'doors_windows', 'insulation', 'appliances', 'other'
);

create type public.warranty_state as enum ('in_warranty', 'out_of_warranty', 'unknown');

create type public.work_order_status as enum (
  'assigned', 'in_progress', 'awaiting_parts', 'submitted', 'approved', 'returned', 'cancelled'
);

create type public.quote_status as enum ('pending', 'approved', 'declined', 'cancelled');

create type public.attachment_kind as enum ('request', 'before', 'after', 'quote', 'other');

-- ---------------------------------------------------------------------
-- Roles & users
-- ---------------------------------------------------------------------
create table public.roles (
  code        public.app_role primary key,
  name_ar     text not null,
  name_en     text not null,
  description text
);

insert into public.roles (code, name_ar, name_en, description) values
  ('admin',      'إدارة الشركة',  'Company Admin',      'إدارة كاملة للنظام والإعدادات'),
  ('supervisor', 'موظف الصيانة',  'Maintenance Officer', 'استقبال البلاغات وتوزيعها واعتمادها'),
  ('technician', 'فني / مقاول',   'Technician',          'تنفيذ أعمال الصيانة وتوثيقها'),
  ('owner',      'مالك الوحدة',   'Unit Owner',          'تقديم طلبات الصيانة ومتابعتها');

-- Users (profile for every auth user)
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        public.app_role not null default 'owner' references public.roles (code),
  full_name   text not null default '',
  email       text,
  phone       text,
  locale      text not null default 'ar' check (locale in ('ar', 'en')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Company settings (singleton row — one company only)
-- ---------------------------------------------------------------------
create table public.company_settings (
  id                    int primary key default 1 check (id = 1),
  name_ar               text not null default 'علا التميز للتطوير العقاري',
  name_en               text not null default 'Ola Al-Tamayuz Real Estate Development',
  logo_url              text,
  primary_color         text not null default '#3C2E52' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color          text not null default '#B08D57' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  support_phone         text,
  support_email         text,
  response_sla_hours    int  not null default 24  check (response_sla_hours > 0),
  resolution_sla_hours  int  not null default 120 check (resolution_sla_hours > 0),
  reopen_window_days    int  not null default 30  check (reopen_window_days >= 0),
  -- external channels to enqueue in notification_outbox (future: whatsapp, sms, email)
  notify_channels       text[] not null default '{}',
  updated_at            timestamptz not null default now()
);
insert into public.company_settings (id) values (1);

-- ---------------------------------------------------------------------
-- Real estate structure
-- ---------------------------------------------------------------------
create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  name_ar       text not null,
  name_en       text,
  city          text not null default 'جدة',
  district      text,
  description   text,
  image_url     text,
  delivery_year int,
  created_at    timestamptz not null default now()
);

create table public.buildings (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  name         text not null,
  floors_count int not null default 1 check (floors_count > 0),
  created_at   timestamptz not null default now(),
  unique (project_id, name)
);

create table public.owners (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid unique references public.profiles (id) on delete set null,
  full_name      text not null,
  phone          text not null,
  email          text,
  account_status text not null default 'pending' check (account_status in ('pending', 'active', 'disabled')),
  notes          text,
  created_at     timestamptz not null default now()
);

create table public.units (
  id             uuid primary key default gen_random_uuid(),
  building_id    uuid not null references public.buildings (id) on delete cascade,
  unit_number    text not null,
  floor          int  not null default 0,
  unit_type      text not null default 'apartment' check (unit_type in ('apartment', 'villa', 'townhouse', 'penthouse', 'duplex', 'commercial')),
  area_sqm       numeric(8,2),
  bedrooms       int,
  image_url      text,
  owner_id       uuid references public.owners (id) on delete set null,
  handover_date  date,
  created_at     timestamptz not null default now(),
  unique (building_id, unit_number)
);
create index on public.units (owner_id);

create table public.contractors (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  cr_number     text,
  contact_name  text,
  phone         text,
  email         text,
  specialties   public.maintenance_category[] not null default '{}',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table public.technicians (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null unique references public.profiles (id) on delete cascade,
  contractor_id  uuid references public.contractors (id) on delete set null,
  full_name      text not null,
  phone          text,
  specialties    public.maintenance_category[] not null default '{}',
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

-- Independent warranty record per unit (one row per warranty item)
create table public.warranties (
  id              uuid primary key default gen_random_uuid(),
  unit_id         uuid not null references public.units (id) on delete cascade,
  category        public.maintenance_category,          -- null = applies to all categories
  title           text not null,
  start_date      date not null,
  end_date        date not null,
  covered_items   text,
  excluded_items  text,
  contractor_id   uuid references public.contractors (id) on delete set null,
  responsible_party text,
  created_at      timestamptz not null default now(),
  check (end_date >= start_date)
);
create index on public.warranties (unit_id);

-- ---------------------------------------------------------------------
-- Maintenance
-- ---------------------------------------------------------------------
create sequence public.request_ref_seq start 1001;

create table public.maintenance_requests (
  id                 uuid primary key default gen_random_uuid(),
  ref_no             text not null unique
                      default ('MR-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.request_ref_seq')::text, 5, '0')),
  unit_id            uuid not null references public.units (id) on delete restrict,
  owner_id           uuid not null references public.owners (id) on delete restrict,
  category           public.maintenance_category not null,
  location_in_unit   text not null,
  description        text not null check (length(description) >= 5),
  preferred_date     date,
  preferred_slot     text check (preferred_slot in ('morning', 'afternoon', 'evening')),
  priority           public.request_priority not null default 'medium',
  status             public.request_status   not null default 'new',
  warranty_state     public.warranty_state   not null default 'unknown',
  warranty_id        uuid references public.warranties (id) on delete set null,
  warranty_note      text,
  reject_reason      text,
  is_paid            boolean not null default false,
  reopen_count       int not null default 0,
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  first_response_at  timestamptz,
  completed_at       timestamptz,
  due_at             timestamptz
);
create index on public.maintenance_requests (owner_id);
create index on public.maintenance_requests (unit_id);
create index on public.maintenance_requests (status);
create index on public.maintenance_requests (created_at desc);

create table public.work_orders (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null references public.maintenance_requests (id) on delete cascade,
  technician_id  uuid not null references public.technicians (id) on delete restrict,
  contractor_id  uuid references public.contractors (id) on delete set null,
  assigned_by    uuid references public.profiles (id) on delete set null,
  status         public.work_order_status not null default 'assigned',
  instructions   text,
  tech_notes     text,
  review_note    text,
  started_at     timestamptz,
  submitted_at   timestamptz,
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now()
);
-- only one live work order per request
create unique index work_orders_one_active
  on public.work_orders (request_id)
  where status in ('assigned', 'in_progress', 'awaiting_parts', 'submitted', 'returned');
create index on public.work_orders (technician_id);

create table public.work_order_parts (
  id             uuid primary key default gen_random_uuid(),
  work_order_id  uuid not null references public.work_orders (id) on delete cascade,
  name           text not null,
  quantity       numeric(10,2) not null default 1 check (quantity > 0),
  unit_cost      numeric(12,2) not null default 0 check (unit_cost >= 0),
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

create table public.appointments (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null references public.maintenance_requests (id) on delete cascade,
  work_order_id  uuid references public.work_orders (id) on delete set null,
  starts_at      timestamptz not null,
  ends_at        timestamptz,
  status         text not null default 'scheduled' check (status in ('scheduled', 'rescheduled', 'done', 'cancelled')),
  note           text,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index on public.appointments (request_id);

create table public.attachments (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null references public.maintenance_requests (id) on delete cascade,
  work_order_id  uuid references public.work_orders (id) on delete set null,
  kind           public.attachment_kind not null default 'request',
  storage_path   text not null unique,
  file_name      text not null,
  mime_type      text,
  size_bytes     bigint,
  uploaded_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now()
);
create index on public.attachments (request_id);

create table public.request_notes (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.maintenance_requests (id) on delete cascade,
  author_id    uuid references public.profiles (id) on delete set null default auth.uid(),
  body         text not null check (length(body) between 1 and 2000),
  is_internal  boolean not null default false,
  created_at   timestamptz not null default now()
);
create index on public.request_notes (request_id);

create table public.quotes (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references public.maintenance_requests (id) on delete cascade,
  amount        numeric(12,2) not null check (amount >= 0),
  vat_rate      numeric(5,2) not null default 15,
  description   text not null,
  status        public.quote_status not null default 'pending',
  created_by    uuid references public.profiles (id) on delete set null,
  responded_at  timestamptz,
  created_at    timestamptz not null default now()
);

create table public.ratings (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null unique references public.maintenance_requests (id) on delete cascade,
  owner_id    uuid not null references public.owners (id) on delete cascade,
  score       smallint not null check (score between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now()
);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        text not null,           -- request_created, status_changed, technician_assigned, visit_confirmed, visit_rescheduled, completed, rating_requested, ...
  request_id  uuid references public.maintenance_requests (id) on delete cascade,
  payload     jsonb not null default '{}',
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);

-- Extension point for WhatsApp / SMS / Email — a worker drains this table
create table public.notification_outbox (
  id               uuid primary key default gen_random_uuid(),
  notification_id  uuid not null references public.notifications (id) on delete cascade,
  channel          text not null check (channel in ('whatsapp', 'sms', 'email')),
  status           text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts         int not null default 0,
  last_error       text,
  created_at       timestamptz not null default now(),
  sent_at          timestamptz
);

create table public.activity_logs (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid references public.maintenance_requests (id) on delete cascade,
  entity       text not null default 'request',
  entity_id    uuid,
  actor_id     uuid references public.profiles (id) on delete set null,
  action       text not null,
  from_status  public.request_status,
  to_status    public.request_status,
  note         text,
  meta         jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
create index on public.activity_logs (request_id, created_at);

-- ---------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so RLS policies can call them
-- without recursive policy evaluation)
-- ---------------------------------------------------------------------
create or replace function public.auth_role()
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role() in ('admin', 'supervisor'), false)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role() = 'admin', false)
$$;

create or replace function public.my_owner_id()
returns uuid language sql stable security definer set search_path = public as $$
  select o.id from public.owners o
  join public.profiles p on p.id = o.profile_id
  where o.profile_id = auth.uid() and o.account_status = 'active' and p.is_active
$$;

create or replace function public.my_technician_id()
returns uuid language sql stable security definer set search_path = public as $$
  select t.id from public.technicians t
  join public.profiles p on p.id = t.profile_id
  where t.profile_id = auth.uid() and t.is_active and p.is_active
$$;

-- Can the current user see this request?
create or replace function public.can_view_request(p_request uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff()
      or exists (select 1 from public.maintenance_requests r
                 where r.id = p_request and r.owner_id = public.my_owner_id())
      or exists (select 1 from public.work_orders w
                 where w.request_id = p_request
                   and w.technician_id = public.my_technician_id()
                   and w.status <> 'cancelled')
$$;

-- Units the current user may see
create or replace function public.can_view_unit(p_unit uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff()
      or exists (select 1 from public.units u where u.id = p_unit and u.owner_id = public.my_owner_id())
      or exists (select 1 from public.maintenance_requests r
                 join public.work_orders w on w.request_id = r.id
                 where r.unit_id = p_unit and w.technician_id = public.my_technician_id()
                   and w.status <> 'cancelled')
$$;

-- updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger trg_profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger trg_requests_touch before update on public.maintenance_requests
  for each row execute function public.touch_updated_at();
create trigger trg_settings_touch before update on public.company_settings
  for each row execute function public.touch_updated_at();

-- New auth user → profile. Role is read ONLY from app_metadata, which can be
-- set by the service role (server), never by the user signing up.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, full_name, email, phone)
  values (
    new.id,
    coalesce((new.raw_app_meta_data ->> 'role')::public.app_role, 'owner'),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
