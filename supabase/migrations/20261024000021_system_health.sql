-- =====================================================================
-- 21) System health: error log (grouped), admin alert, health summary for the admin page
-- =====================================================================
create table if not exists public.error_events (
  fingerprint text primary key,
  source      text not null check (source in ('client', 'server')),
  message     text not null,
  path        text,
  digest      text,
  stack       text,
  user_agent  text,
  last_user   uuid,
  last_role   text,
  count       int not null default 1,
  first_at    timestamptz not null default now(),
  last_at     timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists error_events_last_idx on public.error_events (last_at desc);
alter table public.error_events enable row level security;
drop policy if exists errors_admin on public.error_events;
create policy errors_admin on public.error_events for select to authenticated using (public.is_admin());
grant select on public.error_events to authenticated;

-- anyone (even signed-out visitors) can report an error; grouped by fingerprint, capped per hour, kept 90 days
create or replace function public.log_error(p_source text, p_message text, p_path text default null, p_digest text default null,
  p_stack text default null, p_user_agent text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_fp text; v_new boolean; v_uid uuid := auth.uid(); v_admin uuid;
begin
  if p_source not in ('client', 'server') or coalesce(btrim(p_message), '') = '' then return; end if;
  -- global cap: 300 distinct updates per hour is plenty; beyond that drop silently
  if (select count(*) from public.error_events where last_at > now() - interval '1 hour') > 300 then return; end if;
  v_fp := md5(p_source || '|' || left(p_message, 300) || '|' || coalesce(regexp_replace(p_path, '[0-9a-f-]{36}', ':id', 'g'), ''));
  insert into public.error_events (fingerprint, source, message, path, digest, stack, user_agent, last_user, last_role)
  values (v_fp, p_source, left(p_message, 500), left(p_path, 300), left(p_digest, 100), left(p_stack, 2000), left(p_user_agent, 300),
          v_uid, (select role::text from public.profiles where id = v_uid))
  on conflict (fingerprint) do update set count = error_events.count + 1, last_at = now(), resolved_at = null,
    digest = coalesce(excluded.digest, error_events.digest), last_user = excluded.last_user, last_role = excluded.last_role
  returning (xmax = 0) into v_new;
  -- tell admins about NEW kinds of errors, at most once per hour
  if v_new and not exists (select 1 from public.notifications where type = 'system_error' and created_at > now() - interval '1 hour') then
    for v_admin in select id from public.profiles where role = 'admin' and is_active loop
      perform public.notify_user(v_admin, 'system_error', null, jsonb_build_object('title', left(p_message, 120), 'link', '/admin/system'));
    end loop;
  end if;
  delete from public.error_events where last_at < now() - interval '90 days';
end $$;
revoke all on function public.log_error(text, text, text, text, text, text) from public;
grant execute on function public.log_error(text, text, text, text, text, text) to anon, authenticated, service_role;

create or replace function public.resolve_error(p_fp text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  update public.error_events set resolved_at = now() where fingerprint = p_fp;
end $$;
grant execute on function public.resolve_error(text) to authenticated;

-- admin page summary: scheduled jobs and their last run, message queue, errors, database size
create or replace function public.system_health()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_jobs jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object('name', j.jobname, 'schedule', j.schedule, 'active', j.active,
        'last_at', r.start_time, 'status', r.status, 'message', left(r.return_message, 200)) order by j.jobname), '[]'::jsonb)
      from cron.job j
      left join lateral (select d.start_time, d.status, d.return_message from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1) r on true
    $q$ into v_jobs;
  end if;
  return jsonb_build_object(
    'jobs', v_jobs,
    'outbox_pending', (select count(*) from public.notification_outbox where status in ('pending', 'sending')),
    'outbox_failed_24h', (select count(*) from public.notification_outbox where status = 'failed' and created_at > now() - interval '24 hours'),
    'errors_24h', (select coalesce(sum(count), 0) from public.error_events where last_at > now() - interval '24 hours' and resolved_at is null),
    'db_size', pg_size_pretty(pg_database_size(current_database())),
    'checked_at', now());
end $$;
revoke all on function public.system_health() from public, anon;
grant execute on function public.system_health() to authenticated;
