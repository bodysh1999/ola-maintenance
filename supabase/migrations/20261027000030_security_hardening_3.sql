-- =====================================================================
-- 30) Security hardening (round 3) — enforce in the database what the app enforces in the UI
--   1. two-step login (MFA) enforced on the data itself, not only by page redirects:
--      a password-only session (aal1) gets no role when the account has a verified second factor,
--      or when company policy requires MFA for admins / HR
--   2. CV uploads: a global hourly cap on anonymous uploads to the cvs bucket
--   3. job applications: the LinkedIn field must be an https:// link (no javascript: / data: links)
--   4. branding bucket: no SVG (SVG can carry script); png / jpeg / webp only
--   5. "must change password" flag moves to app_metadata (users cannot edit it themselves)
-- =====================================================================

-- 1) MFA ---------------------------------------------------------------
-- has_verified_mfa(): true when the user enrolled a second factor (auth.mfa_factors exists on Supabase)
do $$
begin
  if to_regclass('auth.mfa_factors') is not null then
    execute $f$
      create or replace function public.has_verified_mfa(p_uid uuid)
      returns boolean language sql stable security definer set search_path = public, auth as $b$
        select exists (select 1 from auth.mfa_factors f where f.user_id = p_uid and f.status = 'verified')
      $b$;
    $f$;
  else
    execute $f$
      create or replace function public.has_verified_mfa(p_uid uuid)
      returns boolean language sql stable security definer set search_path = public as $b$ select false $b$;
    $f$;
  end if;
end $$;
revoke all on function public.has_verified_mfa(uuid) from public, anon, authenticated;

-- auth_role(): every RLS policy and RPC goes through it (is_admin / is_staff / is_hr / is_sales …)
create or replace function public.auth_role()
returns public.app_role language plpgsql stable security definer set search_path = public as $$
declare
  v_role public.app_role;
  v_aal  text;
begin
  select role into v_role from public.profiles where id = auth.uid() and is_active;
  if v_role is null then return null; end if;

  -- API requests always carry JWT claims; the aal claim says whether the second factor was passed
  v_aal := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal';
  if v_aal is null or v_aal = 'aal2' then return v_role; end if;

  -- password-only session
  if v_role::text in ('admin', 'hr')
     and coalesce((select s.require_staff_mfa from public.company_settings s where s.id = 1), false) then
    return null;
  end if;
  if public.has_verified_mfa(auth.uid()) then return null; end if;
  return v_role;
end $$;

-- 2) CV uploads: at most 100 anonymous CV files per hour ----------------
create or replace function public.cv_upload_allowed()
returns boolean language sql stable security definer set search_path = public, storage as $$
  select (select count(*) from storage.objects o
          where o.bucket_id = 'cvs' and o.created_at > now() - interval '1 hour') < 100
$$;
revoke all on function public.cv_upload_allowed() from public;
grant execute on function public.cv_upload_allowed() to anon, authenticated;

do $$
begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists "cvs upload" on storage.objects';
    execute $p$create policy "cvs upload" on storage.objects for insert to anon, authenticated
      with check (bucket_id = 'cvs' and name ~ '^applications/[0-9a-f-]{36}\.(pdf|doc|docx)$'
                  and public.cv_upload_allowed())$p$;
  end if;
end $$;

-- 3) LinkedIn link must be https:// --------------------------------------
do $$
declare f text;
begin
  f := pg_get_functiondef('public.submit_application(text, text, text, text, uuid, text, text, text, text, int, text, text, text, date, date)'::regprocedure);
  if position('LINKEDIN_URL' in f) = 0 then
    f := replace(f, '  if (select count(*) from public.job_applications where created_at > now()',
      E'  -- LINKEDIN_URL: only a web link is stored (it is rendered as a link for HR)\n'
      || E'  if nullif(btrim(p_linkedin), '''') is not null and btrim(p_linkedin) !~* ''^https://[^\\s<>"'''']+$'' then\n'
      || E'    raise exception ''INVALID_URL'' using errcode = ''P0001'';\n  end if;\n'
      || '  if (select count(*) from public.job_applications where created_at > now()');
    execute f;
  end if;
end $$;
update public.job_applications set linkedin_url = null
 where linkedin_url is not null and linkedin_url !~* '^https://';

-- 4) branding bucket without SVG -----------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is not null then
    update storage.buckets set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'] where id = 'branding';
  end if;
end $$;

-- 5) must_change_password → app_metadata (kept for accounts that still have the old flag)
do $$
begin
  if to_regclass('auth.users') is not null and exists (
       select 1 from information_schema.columns
        where table_schema = 'auth' and table_name = 'users' and column_name = 'raw_app_meta_data') then
    execute $q$update auth.users
       set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"must_change_password": true}'::jsonb
     where (raw_user_meta_data ->> 'must_change_password') = 'true'
       and coalesce(raw_app_meta_data ->> 'must_change_password', '') <> 'true'$q$;
  end if;
end $$;
