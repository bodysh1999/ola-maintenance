-- =====================================================================
-- 29) Security hardening (round 2) — from the Supabase advisor + a function-by-function review
--   1. fixed search_path on the remaining helper functions
--   2. internal helpers not callable anonymously
--   3. warranty-alert queue runs from the scheduler only
--   4. leave balance visible to HR, the employee and managers above (not subordinates)
--   5. global flood caps on the public forms (on top of the per-person limits)
-- =====================================================================

-- 1) search_path
alter function public.normalize_phone(text) set search_path = public;
alter function public.today_riyadh() set search_path = public;
alter function public.distance_m(double precision, double precision, double precision, double precision) set search_path = public;
alter function public._payroll_totals(public.payroll_lines) set search_path = public;

-- 2) RLS helper: needed by signed-in users' policies only
revoke execute on function public._payroll_released(uuid) from public, anon;
grant execute on function public._payroll_released(uuid) to authenticated;

-- 3) warranty reminders: daily pg_cron job + the /api/cron/daily route (service role); not from user sessions
revoke execute on function public.queue_warranty_alerts() from public, anon, authenticated;
grant execute on function public.queue_warranty_alerts() to service_role;

-- 4) leave balance scope
do $$
declare f text;
begin
  f := pg_get_functiondef('public.leave_balance(uuid)'::regprocedure);
  if position('can_view_employee(p_emp)' in f) > 0 then
    execute replace(f, 'public.can_view_employee(p_emp)', 'public.can_supervise_employee(p_emp)');
  end if;
end $$;

-- 5) global caps on unauthenticated submissions (a flood from rotating phones / emails)
do $$
declare f text;
begin
  f := pg_get_functiondef('public.submit_lead(text, text, text, uuid, uuid, text, text, text, date, text, text)'::regprocedure);
  if position('LEADS_FLOOD' in f) = 0 then
    f := replace(f, '  if (select count(*) from public.leads where phone = v_phone',
      E'  -- LEADS_FLOOD: more than 200 web requests in an hour is an attack, not customers\n'
      || E'  if (select count(*) from public.leads where created_at > now() - interval ''1 hour'') >= 200 then\n'
      || E'    raise exception ''RATE_LIMITED'' using errcode = ''P0001'';\n  end if;\n'
      || '  if (select count(*) from public.leads where phone = v_phone');
    execute f;
  end if;

  f := pg_get_functiondef('public.submit_application(text, text, text, text, uuid, text, text, text, text, int, text, text, text, date, date)'::regprocedure);
  if position('APPS_FLOOD' in f) = 0 then
    f := replace(f, '  if (select count(*) from public.job_applications where lower(email)',
      E'  -- APPS_FLOOD: global cap per hour\n'
      || E'  if (select count(*) from public.job_applications where created_at > now() - interval ''1 hour'') >= 100 then\n'
      || E'    raise exception ''RATE_LIMITED'' using errcode = ''P0001'';\n  end if;\n'
      || '  if (select count(*) from public.job_applications where lower(email)');
    execute f;
  end if;
end $$;
