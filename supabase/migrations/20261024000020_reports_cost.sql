-- =====================================================================
-- 20) Reports: maintenance cost and volume per project for a period (staff only)
-- =====================================================================
create or replace function public.report_project_costs(p_from date, p_to date)
returns table (project_id uuid, project text, requests bigint, completed bigint, overdue bigint, parts_cost numeric, quotes_approved numeric, avg_resolution_hours numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
  select p.id, p.name_ar,
    count(r.id),
    count(r.id) filter (where r.status = 'completed'),
    count(r.id) filter (where r.due_at < now() and r.status not in ('completed', 'rejected')),
    coalesce(sum(pc.cost), 0)::numeric,
    coalesce(sum(qa.amount), 0)::numeric,
    round(avg(extract(epoch from r.completed_at - r.created_at) / 3600) filter (where r.completed_at is not null)::numeric, 1)
  from public.maintenance_requests r
  join public.units u on u.id = r.unit_id
  join public.buildings b on b.id = u.building_id
  join public.projects p on p.id = b.project_id
  left join lateral (
    select sum(wp.quantity * wp.unit_cost) as cost from public.work_orders w join public.work_order_parts wp on wp.work_order_id = w.id where w.request_id = r.id) pc on true
  left join lateral (
    select sum(q.amount) as amount from public.quotes q where q.request_id = r.id and q.status = 'approved') qa on true
  where (r.created_at at time zone 'Asia/Riyadh')::date between p_from and p_to
  group by p.id, p.name_ar
  order by 6 desc, 3 desc;
end $$;
revoke all on function public.report_project_costs(date, date) from public, anon;
grant execute on function public.report_project_costs(date, date) to authenticated;
