-- =====================================================================
--  خطابات الموارد البشرية: توقيع مدير تنمية رأس المال البشري + رمز QR للتحقق الإلكتروني
--  • كل خطاب معتمد يُحفظ "كما صدر" (لا يتغير لو تغيّر الراتب لاحقًا)
--  • رمز تحقق عشوائي لكل خطاب، وصفحة تحقق عامة على موقع الشركة
--  شغّله بعد ملف 11. آمن لإعادة التشغيل.
-- =====================================================================

-- settings: signatory title + signature image
alter table public.company_settings
  add column if not exists hr_signatory_title text not null default 'مدير تنمية رأس المال البشري',
  add column if not exists hr_signature_url text;

-- every request gets an unguessable verification code (128-bit random)
alter table public.hr_requests
  add column if not exists verify_code text,
  add column if not exists letter_data jsonb;
update public.hr_requests set verify_code = replace(gen_random_uuid()::text, '-', '') where verify_code is null;
alter table public.hr_requests alter column verify_code set default replace(gen_random_uuid()::text, '-', '');
alter table public.hr_requests alter column verify_code set not null;
create unique index if not exists hr_requests_verify_code_idx on public.hr_requests (verify_code);

-- the letter exactly as issued (employee, salary breakdown, signatory, company)
create or replace function public.build_letter_snapshot(p_emp uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e record; p record; s record; c record; v_rate numeric; v_gross numeric; v_gosi numeric; v_ded numeric;
begin
  select * into e from public.employees where id = p_emp;
  select * into p from public.employee_private where employee_id = p_emp;
  select * into s from public.employee_salaries where employee_id = p_emp;
  select * into c from public.company_settings where id = 1;
  v_rate  := coalesce(s.gosi_rate, case when e.nationality_type = 'saudi' then c.gosi_saudi_rate else c.gosi_resident_rate end, 0);
  v_gross := coalesce(s.basic, 0) + coalesce(s.housing, 0) + coalesce(s.transport, 0) + coalesce(s.other_allowances, 0);
  v_gosi  := round(least(coalesce(s.basic, 0) + coalesce(s.housing, 0), 45000) * v_rate / 100, 2);
  v_ded   := v_gosi + coalesce(s.other_deductions, 0);
  return jsonb_build_object(
    'employee', jsonb_build_object('full_name', e.full_name, 'job_title', e.job_title, 'emp_no', e.emp_no, 'nationality', e.nationality,
      'nationality_type', e.nationality_type, 'gender', e.gender, 'hire_date', e.hire_date, 'status', e.status, 'id_number', p.id_number),
    'salary', case when s.employee_id is null then null else jsonb_build_object(
      'basic', coalesce(s.basic, 0), 'housing', coalesce(s.housing, 0), 'transport', coalesce(s.transport, 0),
      'other_allowances', coalesce(s.other_allowances, 0), 'gross', v_gross, 'gosi_rate', v_rate, 'gosi', v_gosi,
      'other_deductions', coalesce(s.other_deductions, 0), 'deductions', v_ded, 'net', v_gross - v_ded) end,
    'signatory', jsonb_build_object('name', c.hr_letter_signatory, 'title', c.hr_signatory_title, 'signature_url', c.hr_signature_url),
    'company', jsonb_build_object('name_ar', c.name_ar, 'name_en', c.name_en, 'logo_url', c.logo_url,
      'phone', c.support_phone, 'email', c.support_email, 'website', c.website_url));
end $$;

create or replace function public.hr_letter_snapshot_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved'
     and new.type in ('salary_certificate', 'experience_letter') then
    new.letter_data := public.build_letter_snapshot(new.employee_id);
  end if;
  return new;
end $$;
drop trigger if exists trg_hr_letter_snapshot on public.hr_requests;
create trigger trg_hr_letter_snapshot before update of status on public.hr_requests
  for each row execute function public.hr_letter_snapshot_trigger();

-- letters approved before this file: snapshot them now
update public.hr_requests set letter_data = public.build_letter_snapshot(employee_id)
where status = 'approved' and type in ('salary_certificate', 'experience_letter') and letter_data is null;

-- public verification (QR): only approved letters, ID number masked
create or replace function public.verify_hr_document(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'ref_no', r.ref_no, 'type', r.type, 'addressed_to', r.addressed_to,
    'issued_at', coalesce(r.decided_at, r.created_at),
    'data', case when r.letter_data #>> '{employee,id_number}' is null then r.letter_data
                 else jsonb_set(r.letter_data, '{employee,id_number}',
                   to_jsonb(repeat('•', greatest(length(r.letter_data #>> '{employee,id_number}') - 4, 0)) || right(r.letter_data #>> '{employee,id_number}', 4))) end)
  from public.hr_requests r
  where length(coalesce(p_code, '')) = 32 and r.verify_code = lower(p_code)
    and r.status = 'approved' and r.type in ('salary_certificate', 'experience_letter')
$$;

revoke execute on function public.build_letter_snapshot(uuid), public.hr_letter_snapshot_trigger() from public, anon, authenticated;
revoke execute on function public.verify_hr_document(text) from public;
grant execute on function public.verify_hr_document(text) to anon, authenticated;

-- HR settings now include the signatory title and signature image
drop function if exists public.update_hr_settings(numeric, numeric, numeric, text);
create or replace function public.update_hr_settings(
  p_gosi_saudi numeric, p_gosi_resident numeric, p_per_diem numeric, p_signatory text,
  p_signatory_title text default null, p_signature_url text default null, p_clear_signature boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_hr() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if p_signature_url is not null and p_signature_url !~ '^https://' then raise exception 'INVALID_FILE' using errcode = 'P0001'; end if;
  update public.company_settings set
    gosi_saudi_rate     = greatest(0, least(coalesce(p_gosi_saudi, gosi_saudi_rate), 30)),
    gosi_resident_rate  = greatest(0, least(coalesce(p_gosi_resident, gosi_resident_rate), 30)),
    trip_per_diem       = greatest(0, coalesce(p_per_diem, trip_per_diem)),
    hr_letter_signatory = nullif(btrim(p_signatory), ''),
    hr_signatory_title  = coalesce(nullif(btrim(p_signatory_title), ''), hr_signatory_title),
    hr_signature_url    = case when p_clear_signature then null else coalesce(p_signature_url, hr_signature_url) end
  where id = 1;
end $$;
revoke execute on function public.update_hr_settings(numeric, numeric, numeric, text, text, text, boolean) from public, anon;
grant execute on function public.update_hr_settings(numeric, numeric, numeric, text, text, text, boolean) to authenticated;
