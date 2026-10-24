-- =====================================================================
-- 17) Realtime + live technician location
--   * tables added to the supabase_realtime publication (RLS still applies to every subscriber)
--   * tech_locations: the technician's position while "on the way" only — cleared when work starts
-- =====================================================================

create table if not exists public.tech_locations (
  work_order_id uuid primary key references public.work_orders(id) on delete cascade,
  request_id    uuid not null references public.maintenance_requests(id) on delete cascade,
  lat           double precision not null check (lat between -90 and 90),
  lng           double precision not null check (lng between -180 and 180),
  accuracy_m    int,
  updated_at    timestamptz not null default now()
);
create index if not exists tech_locations_request_idx on public.tech_locations (request_id);
alter table public.tech_locations enable row level security;
drop policy if exists tech_loc_read on public.tech_locations;
create policy tech_loc_read on public.tech_locations for select to authenticated using (public.can_view_request(request_id));
grant select on public.tech_locations to authenticated;

-- technician shares position (only for their own work order, only while "on the way")
create or replace function public.tech_share_location(p_wo uuid, p_lat double precision, p_lng double precision, p_accuracy int default null)
returns void language plpgsql security definer set search_path = public as $$
declare v public.work_orders;
begin
  v := public._my_work_order(p_wo);
  if v.on_the_way_at is null then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
  if p_lat is null or p_lng is null or abs(p_lat) > 90 or abs(p_lng) > 180 then raise exception 'LOCATION_REQUIRED' using errcode = 'P0001'; end if;
  insert into public.tech_locations (work_order_id, request_id, lat, lng, accuracy_m, updated_at)
  values (p_wo, v.request_id, p_lat, p_lng, p_accuracy, now())
  on conflict (work_order_id) do update set lat = excluded.lat, lng = excluded.lng, accuracy_m = excluded.accuracy_m, updated_at = now();
  -- housekeeping: never keep stale positions
  delete from public.tech_locations where updated_at < now() - interval '6 hours';
end $$;
revoke all on function public.tech_share_location(uuid, double precision, double precision, int) from public, anon;
grant execute on function public.tech_share_location(uuid, double precision, double precision, int) to authenticated;

-- position is removed as soon as the technician starts / the order ends
create or replace function public.clear_on_the_way()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status <> old.status and new.status in ('in_progress', 'submitted', 'approved', 'cancelled') then
    new.on_the_way_at := null; new.eta_minutes := null;
    delete from public.tech_locations where work_order_id = new.id;
  end if;
  return new;
end $$;

-- realtime publication
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['maintenance_requests', 'request_notes', 'notifications', 'tech_locations', 'appointments', 'work_orders'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
