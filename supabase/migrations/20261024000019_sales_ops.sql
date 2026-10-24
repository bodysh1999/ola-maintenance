-- =====================================================================
-- 19) Sales operations
--   * notify a salesperson when a lead is assigned to them
--   * daily follow-up reminders (follow_up_at = today or overdue), once per day per lead
-- =====================================================================
alter table public.leads add column if not exists follow_up_notified_on date;

create or replace function public.lead_assigned_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assigned_to is not null and new.assigned_to is distinct from old.assigned_to and new.assigned_to is distinct from auth.uid() then
    perform public.notify_user(new.assigned_to, 'lead_assigned', null,
      jsonb_build_object('ref_no', new.ref_no, 'name', new.full_name, 'link', '/sales/' || new.id));
  end if;
  return new;
end $$;
drop trigger if exists trg_lead_assigned on public.leads;
create trigger trg_lead_assigned after update of assigned_to on public.leads
  for each row execute function public.lead_assigned_notify();

create or replace function public.lead_followup_reminders()
returns jsonb language plpgsql security definer set search_path = public as $$
declare rec record; v_user uuid; n int := 0; v_today date := public.today_riyadh();
begin
  for rec in
    select l.* from public.leads l
    where l.follow_up_at is not null and l.follow_up_at <= v_today
      and l.status in ('new', 'contacted', 'scheduled', 'visited', 'negotiating', 'booked')
      and l.follow_up_notified_on is distinct from v_today
  loop
    for v_user in
      select rec.assigned_to where rec.assigned_to is not null
      union
      select p.id from public.profiles p where rec.assigned_to is null and p.role::text = 'sales' and p.is_active
    loop
      perform public.notify_user(v_user, 'lead_follow_up', null,
        jsonb_build_object('ref_no', rec.ref_no, 'name', rec.full_name, 'date', rec.follow_up_at, 'link', '/sales/' || rec.id));
    end loop;
    update public.leads set follow_up_notified_on = v_today where id = rec.id;
    n := n + 1;
  end loop;
  return jsonb_build_object('reminded', n);
end $$;
revoke all on function public.lead_followup_reminders() from public, anon, authenticated;
grant execute on function public.lead_followup_reminders() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'lead-followups';
    perform cron.schedule('lead-followups', '0 5 * * *', 'select public.lead_followup_reminders()');
  end if;
end $$;
