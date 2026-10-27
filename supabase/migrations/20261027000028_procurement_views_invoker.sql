-- =====================================================================
-- 28) Procurement views without SECURITY DEFINER in the exposed schema
--   The owner-rights queries (needed to show requester / buyer names and full supplier figures)
--   move to an internal schema the API does not expose; the public views run with the caller's rights.
--   Visibility is unchanged: the internal views still filter with can_view_purchase() / proc_role().
-- =====================================================================
create schema if not exists internal;
revoke all on schema internal from public, anon;
grant usage on schema internal to authenticated;

drop view if exists public.purchase_overview;
drop view if exists internal.purchase_overview;
create view internal.purchase_overview as
select r.*,
  rq.full_name as requester_name, rp.full_name as rep_name, dp.full_name as decider_name,
  coalesce(pj.name_ar, '') as project_name,
  (select count(*) from public.purchase_quotes q where q.request_id = r.id) as quotes_count,
  (select min(q.amount) from public.purchase_quotes q where q.request_id = r.id) as min_amount,
  cq.amount as chosen_amount, cq.quote_no as chosen_no, cs.name as chosen_supplier, cs.phone as chosen_supplier_phone
from public.purchase_requests r
left join public.profiles rq on rq.id = r.requested_by
left join public.profiles rp on rp.id = r.rep_id
left join public.profiles dp on dp.id = r.decided_by
left join public.projects pj on pj.id = r.project_id
left join public.purchase_quotes cq on cq.id = r.chosen_quote_id
left join public.suppliers cs on cs.id = cq.supplier_id
where public.can_view_purchase(r.id);
revoke all on internal.purchase_overview from public, anon;
grant select on internal.purchase_overview to authenticated;

create view public.purchase_overview with (security_invoker = true) as select * from internal.purchase_overview;
revoke all on public.purchase_overview from anon;
grant select on public.purchase_overview to authenticated;

drop view if exists public.supplier_stats;
drop view if exists internal.supplier_stats;
create view internal.supplier_stats as
select s.*,
  count(q.id) as quotes_count,
  count(r.id) filter (where r.chosen_quote_id = q.id) as wins,
  coalesce(sum(coalesce(r.purchased_amount, q.amount)) filter (where r.chosen_quote_id = q.id and r.status = 'purchased'), 0) as purchased_total,
  max(q.created_at) as last_quote_at
from public.suppliers s
left join public.purchase_quotes q on q.supplier_id = s.id
left join public.purchase_requests r on r.id = q.request_id
where public.proc_role() is not null
group by s.id;
revoke all on internal.supplier_stats from public, anon;
grant select on internal.supplier_stats to authenticated;

create view public.supplier_stats with (security_invoker = true) as select * from internal.supplier_stats;
revoke all on public.supplier_stats from anon;
grant select on public.supplier_stats to authenticated;
