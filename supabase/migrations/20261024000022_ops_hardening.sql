-- =====================================================================
-- 22) Hardening for 16–21 (Supabase security advisor): signed-out visitors can't call staff/employee functions,
--     trigger functions aren't callable at all, fixed search_path on the helper.
--     log_error stays callable by visitors on purpose (errors on public pages).
-- =====================================================================
revoke execute on function public.can_decide_hr_request(uuid), public.holidays_between(date, date), public.leave_calendar(date, date),
  public.resolve_error(text), public.report_project_costs(date, date), public.similar_requests(uuid, public.maintenance_category, uuid),
  public.system_health(), public.delegation_candidates(), public.my_acting_for(), public.set_delegation(uuid, date, date, text, uuid),
  public.cancel_delegation(uuid), public.tech_share_location(uuid, double precision, double precision, int) from anon, public;
revoke execute on function public.lead_assigned_notify() from anon, authenticated, public;
revoke execute on function public.escalate_requests(), public.escalate_hr_approvals(), public.attendance_alerts_run(),
  public.lead_followup_reminders() from anon, authenticated, public;
alter function public.request_waiting_on(public.request_status, public.work_order_status, boolean) set search_path = public;
