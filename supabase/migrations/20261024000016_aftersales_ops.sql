-- =====================================================================
-- 16) After-sales operations
--   * request_overview: waiting_on / waiting_since / pending_quote_amount / escalation_level
--   * automatic escalation (supervisor → admin) for overdue or stuck requests
--   * similar_requests(): duplicate warning (same unit + category within 7 days or still open)
--   * pg_cron (when available): escalation hourly
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Escalations (separate table so request_overview's r.* stays unchanged)
-- ---------------------------------------------------------------------
create table if not exists public.request_escalations (
  request_id   uuid primary key references public.maintenance_requests(id) on delete cascade,
  level        int not null check (level between 1 and 2),
  reason       text not null check (reason in ('overdue', 'tech_stuck', 'staff_stuck')),
  escalated_at timestamptz not null default now(),
  first_at     timestamptz not null default now()
);
alter table public.request_escalations enable row level security;
drop policy if exists esc_staff_read on public.request_escalations;
create policy esc_staff_read on public.request_escalations for select to authenticated
  using (public.is_staff());
grant select on public.request_escalations to authenticated;

-- ---------------------------------------------------------------------
-- 2) Who is the request waiting on?
-- ---------------------------------------------------------------------
create or replace function public.request_waiting_on(p_status public.request_status, p_wo_status public.work_order_status, p_has_quote boolean)
returns text language sql immutable as $$
  select case
    when p_status in ('completed', 'rejected') then null
    when p_has_quote then 'owner_quote'
    when p_status in ('new', 'reopened') then 'staff_review'
    when p_status = 'under_review' then 'staff_approve'
    when p_status = 'approved' then 'staff_assign'
    when p_status in ('assigned', 'scheduled') then 'tech_start'
    when p_status = 'in_progress' and p_wo_status = 'returned' then 'tech_returned'
    when p_status = 'in_progress' and p_wo_status = 'submitted' then 'staff_signoff'
    when p_status = 'in_progress' then 'tech_finish'
    when p_status = 'awaiting_parts' then 'tech_parts'
    when p_status = 'pending_approval' then 'staff_signoff'
    when p_status = 'postponed' then 'staff_reschedule'
  end
$$;

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
  a.owner_confirmed_at, a.owner_reschedule_note, a.owner_reschedule_at,
  -- 16
  public.request_waiting_on(r.status, w.status, q.id is not null) as waiting_on,
  coalesce(lg.last_at, r.created_at) as waiting_since,
  q.amount as pending_quote_amount,
  coalesce(es.level, 0) as escalation_level
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
left join public.ratings rt on rt.request_id = r.id
left join lateral (
  select x.id, x.amount from public.quotes x
  where x.request_id = r.id and x.status = 'pending'
  order by x.created_at desc limit 1) q on true
left join lateral (
  select max(l.created_at) as last_at from public.activity_logs l where l.request_id = r.id) lg on true
left join public.request_escalations es on es.request_id = r.id;

create index if not exists activity_logs_request_created_idx on public.activity_logs (request_id, created_at desc);

-- ---------------------------------------------------------------------
-- 3) Escalation job
--    level 1 → supervisors: overdue (SLA passed), or waiting on the technician > 24h, or on staff > 48h
--    level 2 → admins: still stuck 24h after level 1
--    a request that is no longer stuck drops out of the table
-- ---------------------------------------------------------------------
create or replace function public.escalate_requests()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  rec record; v_l1 int := 0; v_l2 int := 0; v_cleared int := 0; v_uid uuid;
begin
  -- clear requests that recovered
  with stuck as (
    select v.id from public.request_overview v
    where v.waiting_on is not null and (
      v.is_overdue
      or (v.waiting_on like 'tech%' and v.waiting_since < now() - interval '24 hours')
      or (v.waiting_on like 'staff%' and v.waiting_since < now() - interval '48 hours'))
  ), del as (
    delete from public.request_escalations e where not exists (select 1 from stuck s where s.id = e.request_id) returning 1
  ) select count(*) into v_cleared from del;

  for rec in
    select v.id, v.ref_no, v.waiting_on, v.is_overdue, v.technician_name, e.level, e.escalated_at,
      case when v.is_overdue then 'overdue' when v.waiting_on like 'tech%' then 'tech_stuck' else 'staff_stuck' end as reason
    from public.request_overview v
    left join public.request_escalations e on e.request_id = v.id
    where v.waiting_on is not null and (
      v.is_overdue
      or (v.waiting_on like 'tech%' and v.waiting_since < now() - interval '24 hours')
      or (v.waiting_on like 'staff%' and v.waiting_since < now() - interval '48 hours'))
  loop
    if rec.level is null then
      insert into public.request_escalations (request_id, level, reason) values (rec.id, 1, rec.reason);
      for v_uid in select id from public.profiles where role = 'supervisor' and is_active loop
        perform public.notify_user(v_uid, 'escalation', rec.id,
          jsonb_build_object('ref', rec.ref_no, 'level', 1, 'reason', rec.reason, 'tech', coalesce(rec.technician_name, '')));
      end loop;
      -- no active supervisor → go straight to admins
      if not exists (select 1 from public.profiles where role = 'supervisor' and is_active) then
        update public.request_escalations set level = 2 where request_id = rec.id;
        for v_uid in select id from public.profiles where role = 'admin' and is_active loop
          perform public.notify_user(v_uid, 'escalation', rec.id,
            jsonb_build_object('ref', rec.ref_no, 'level', 2, 'reason', rec.reason, 'tech', coalesce(rec.technician_name, '')));
        end loop;
        v_l2 := v_l2 + 1;
      else
        v_l1 := v_l1 + 1;
      end if;
    elsif rec.level = 1 and rec.escalated_at < now() - interval '24 hours' then
      update public.request_escalations set level = 2, escalated_at = now(), reason = rec.reason where request_id = rec.id;
      for v_uid in select id from public.profiles where role = 'admin' and is_active loop
        perform public.notify_user(v_uid, 'escalation', rec.id,
          jsonb_build_object('ref', rec.ref_no, 'level', 2, 'reason', rec.reason, 'tech', coalesce(rec.technician_name, '')));
      end loop;
      v_l2 := v_l2 + 1;
    end if;
  end loop;
  return jsonb_build_object('level1', v_l1, 'level2', v_l2, 'cleared', v_cleared);
end $$;
revoke all on function public.escalate_requests() from public, anon, authenticated;
grant execute on function public.escalate_requests() to service_role;

-- ---------------------------------------------------------------------
-- 4) Duplicate warning
-- ---------------------------------------------------------------------
create or replace function public.similar_requests(p_unit uuid, p_category public.maintenance_category, p_exclude uuid default null)
returns table (id uuid, ref_no text, status public.request_status, created_at timestamptz)
language sql stable security invoker set search_path = public as $$
  select r.id, r.ref_no, r.status, r.created_at
  from public.maintenance_requests r
  where r.unit_id = p_unit and r.category = p_category
    and (p_exclude is null or r.id <> p_exclude)
    and (r.created_at > now() - interval '7 days' or r.status not in ('completed', 'rejected'))
  order by r.created_at desc
  limit 5
$$;
grant execute on function public.similar_requests(uuid, public.maintenance_category, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5) Schedule (pg_cron)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'request-escalation';
    perform cron.schedule('request-escalation', '15 * * * *', 'select public.escalate_requests()');
  else
    raise notice 'pg_cron not available — the website daily job runs escalation instead';
  end if;
end $$;
