-- =====================================================================
--  الصلاحيات على مستوى قاعدة البيانات (Row Level Security + column grants)
--  القاعدة: لا يرى المالك إلا وحداته وبلاغاته، ولا يرى الفني إلا مهامه.
-- =====================================================================

-- Nothing is readable anonymously except the company branding for the login page
revoke all on all tables in schema public from anon;
grant select on public.company_settings to anon;

-- Enable RLS everywhere
alter table public.roles                enable row level security;
alter table public.profiles             enable row level security;
alter table public.company_settings     enable row level security;
alter table public.projects             enable row level security;
alter table public.buildings            enable row level security;
alter table public.owners               enable row level security;
alter table public.units                enable row level security;
alter table public.contractors          enable row level security;
alter table public.technicians          enable row level security;
alter table public.warranties           enable row level security;
alter table public.maintenance_requests enable row level security;
alter table public.work_orders          enable row level security;
alter table public.work_order_parts     enable row level security;
alter table public.appointments         enable row level security;
alter table public.attachments          enable row level security;
alter table public.request_notes        enable row level security;
alter table public.quotes               enable row level security;
alter table public.ratings              enable row level security;
alter table public.notifications        enable row level security;
alter table public.notification_outbox  enable row level security;
alter table public.activity_logs        enable row level security;

-- Column-level write restrictions (status & workflow fields change only via RPC)
revoke update on public.maintenance_requests from authenticated;
grant  update (priority, warranty_state, warranty_note, category, location_in_unit,
               description, preferred_date, preferred_slot) on public.maintenance_requests to authenticated;
revoke update on public.notifications from authenticated;
grant  update (read_at) on public.notifications to authenticated;
revoke update on public.profiles from authenticated;
grant  update (full_name, phone, locale) on public.profiles to authenticated;
revoke insert, update, delete on public.work_orders, public.appointments, public.quotes,
                                 public.ratings, public.activity_logs, public.notification_outbox,
                                 public.roles
  from authenticated;
revoke insert, delete on public.notifications, public.profiles from authenticated;
grant usage on sequence public.request_ref_seq to authenticated;
revoke select on public.notification_outbox from authenticated;
revoke insert, delete on public.company_settings from authenticated;
revoke update, delete on public.attachments, public.request_notes, public.work_order_parts from authenticated;
grant  delete on public.attachments, public.work_order_parts to authenticated;

-- ---------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------
create policy roles_read on public.roles for select to authenticated using (true);

create policy settings_read  on public.company_settings for select to anon, authenticated using (true);
create policy settings_admin on public.company_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Projects / buildings / units
create policy projects_read on public.projects for select to authenticated
  using (public.is_staff() or exists (
    select 1 from public.buildings b join public.units u on u.building_id = b.id
    where b.project_id = projects.id and public.can_view_unit(u.id)));
create policy projects_admin on public.projects for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy buildings_read on public.buildings for select to authenticated
  using (public.is_staff() or exists (
    select 1 from public.units u where u.building_id = buildings.id and public.can_view_unit(u.id)));
create policy buildings_admin on public.buildings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy units_read on public.units for select to authenticated using (public.can_view_unit(id));
create policy units_admin on public.units for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Owners
create policy owners_read on public.owners for select to authenticated
  using (public.is_staff()
         or id = public.my_owner_id()
         or exists (select 1 from public.maintenance_requests r
                    join public.work_orders w on w.request_id = r.id
                    where r.owner_id = owners.id
                      and w.technician_id = public.my_technician_id()
                      and w.status in ('assigned', 'in_progress', 'awaiting_parts', 'returned', 'submitted')));
create policy owners_admin on public.owners for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Contractors & technicians
create policy contractors_read on public.contractors for select to authenticated
  using (public.is_staff()
         or id = (select contractor_id from public.technicians where id = public.my_technician_id()));
create policy contractors_admin on public.contractors for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy technicians_read on public.technicians for select to authenticated
  using (public.is_staff()
         or id = public.my_technician_id()
         or exists (select 1 from public.work_orders w join public.maintenance_requests r on r.id = w.request_id
                    where w.technician_id = technicians.id and w.status <> 'cancelled'
                      and r.owner_id = public.my_owner_id()));
create policy technicians_admin on public.technicians for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Warranties
create policy warranties_read on public.warranties for select to authenticated
  using (public.can_view_unit(unit_id));
create policy warranties_admin on public.warranties for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Maintenance requests
create policy requests_read on public.maintenance_requests for select to authenticated
  using (owner_id = public.my_owner_id() or public.can_view_request(id));
create policy requests_insert on public.maintenance_requests for insert to authenticated
  with check (
    public.is_staff()
    or (owner_id = public.my_owner_id()
        and exists (select 1 from public.units u where u.id = unit_id and u.owner_id = public.my_owner_id())));
create policy requests_staff_update on public.maintenance_requests for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy requests_admin_delete on public.maintenance_requests for delete to authenticated
  using (public.is_admin());

-- Work orders (writes only through RPCs)
create policy work_orders_read on public.work_orders for select to authenticated
  using (public.is_staff()
         or technician_id = public.my_technician_id()
         or exists (select 1 from public.maintenance_requests r
                    where r.id = request_id and r.owner_id = public.my_owner_id()));

create policy parts_read on public.work_order_parts for select to authenticated
  using (exists (select 1 from public.work_orders w
                 where w.id = work_order_id and public.can_view_request(w.request_id)));
create policy parts_write on public.work_order_parts for insert to authenticated
  with check (public.is_staff() or exists (
    select 1 from public.work_orders w where w.id = work_order_id
      and w.technician_id = public.my_technician_id()
      and w.status in ('in_progress', 'awaiting_parts', 'returned')));
create policy parts_delete on public.work_order_parts for delete to authenticated
  using (public.is_staff() or exists (
    select 1 from public.work_orders w where w.id = work_order_id
      and w.technician_id = public.my_technician_id()
      and w.status in ('in_progress', 'awaiting_parts', 'returned')));

create policy appointments_read on public.appointments for select to authenticated
  using (public.can_view_request(request_id));

-- Attachments
create policy attachments_read on public.attachments for select to authenticated
  using (public.can_view_request(request_id));
create policy attachments_insert on public.attachments for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and public.can_view_request(request_id)
    and (
      public.is_staff()
      or (public.auth_role() = 'owner' and kind = 'request' and work_order_id is null)
      or (public.auth_role() = 'technician' and kind in ('before', 'after')
          and exists (select 1 from public.work_orders w
                      where w.id = work_order_id and w.request_id = attachments.request_id
                        and w.technician_id = public.my_technician_id()
                        and w.status in ('assigned', 'in_progress', 'awaiting_parts', 'returned')))
    ));
create policy attachments_delete on public.attachments for delete to authenticated
  using (uploaded_by = auth.uid() or public.is_admin());

-- Notes (internal notes are hidden from owners)
create policy notes_read on public.request_notes for select to authenticated
  using (public.can_view_request(request_id)
         and (not is_internal or public.auth_role() <> 'owner'));
create policy notes_insert on public.request_notes for insert to authenticated
  with check (public.can_view_request(request_id)
              and (not is_internal or public.auth_role() in ('admin', 'supervisor', 'technician')));

create policy quotes_read  on public.quotes  for select to authenticated using (public.can_view_request(request_id));
create policy ratings_read on public.ratings for select to authenticated using (public.can_view_request(request_id));
create policy logs_read    on public.activity_logs for select to authenticated using (public.can_view_request(request_id));

create policy notifications_own_read on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_own_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- notification_outbox: no policies → only the service role (background worker) can access it

-- ---------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('attachments', 'attachments', false, 52428800,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime', 'application/pdf']),
  ('branding', 'branding', true, 5242880,
   array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'])
on conflict (id) do nothing;

-- path convention: attachments/<request_id>/<uuid>-<filename>
create or replace function public.request_id_from_path(p_name text)
returns uuid language plpgsql immutable as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when others then
  return null;
end $$;

create policy "attachments read"   on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and public.can_view_request(public.request_id_from_path(name)));
create policy "attachments upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and public.can_view_request(public.request_id_from_path(name)));
create policy "attachments delete" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (owner_id = auth.uid()::text or public.is_admin()));

create policy "branding read"  on storage.objects for select using (bucket_id = 'branding');
create policy "branding write" on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and public.is_admin());
create policy "branding update" on storage.objects for update to authenticated
  using (bucket_id = 'branding' and public.is_admin());
create policy "branding delete" on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and public.is_admin());
