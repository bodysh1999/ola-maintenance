-- =====================================================================
-- 23) Custody (العهد)
--   * approval_chains: who approves which request type — configured by HR/admin
--     step kinds: manager (direct manager), manager2 (manager's manager), dept_manager, hr,
--                 employee (a named person, e.g. the accountant); optional min_amount per step
--   * custody request = hr_requests.type 'custody' (reuses the approvals inbox, delegation, escalation)
--   * on approval a custody is opened; the employee records expenses (with invoice / wages without invoice),
--     sees the remaining balance; HR reviews expenses and closes the custody
-- =====================================================================

alter table public.hr_requests drop constraint if exists hr_requests_type_check;
alter table public.hr_requests add constraint hr_requests_type_check check (type in (
  'leave', 'salary_certificate', 'overtime', 'attendance_correction', 'presence', 'business_trip',
  'salary_advance', 'exit_reentry', 'experience_letter', 'custody'));

-- ---------------------------------------------------------------------
-- 1) Configurable approval chain
-- ---------------------------------------------------------------------
create table if not exists public.approval_chains (
  type        text primary key check (type in ('custody')),
  steps       jsonb not null default '[{"kind":"manager"},{"kind":"hr"}]',
  max_amount  numeric(12,2) not null default 50000,
  updated_by  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now()
);
insert into public.approval_chains (type) values ('custody') on conflict do nothing;
alter table public.approval_chains enable row level security;
drop policy if exists chains_read on public.approval_chains;
create policy chains_read on public.approval_chains for select to authenticated using (true);
grant select on public.approval_chains to authenticated;

create or replace function public.set_approval_chain(p_type text, p_steps jsonb, p_max numeric default null)
returns void language plpgsql security definer set search_path = public as $$
declare s jsonb;
begin
  if not public.is_hr() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_steps) <> 'array' or jsonb_array_length(p_steps) = 0 or jsonb_array_length(p_steps) > 6 then
    raise exception 'REQUIRED' using errcode = 'P0001';
  end if;
  for s in select * from jsonb_array_elements(p_steps) loop
    if s ->> 'kind' not in ('manager', 'manager2', 'dept_manager', 'hr', 'employee') then raise exception 'REQUIRED' using errcode = 'P0001'; end if;
    if s ->> 'kind' = 'employee' and not exists (select 1 from public.employees where id = (s ->> 'employee_id')::uuid and status = 'active') then
      raise exception 'REQUIRED' using errcode = 'P0001';
    end if;
  end loop;
  update public.approval_chains set steps = p_steps, max_amount = coalesce(p_max, max_amount), updated_by = auth.uid(), updated_at = now()
  where type = p_type;
  if not found then raise exception 'INVALID_KIND' using errcode = 'P0001'; end if;
end $$;

-- build hr_request_steps for a request from its chain (skips empty / self / duplicate approvers)
create or replace function public._build_chain_steps(p_req uuid, p_emp uuid, p_type text, p_amount numeric)
returns int language plpgsql security definer set search_path = public as $$
declare s jsonb; e record; v_ap uuid; v_kind text; v_step int := 0; v_seen uuid[] := '{}'; v_hr_added boolean := false;
begin
  select * into e from public.employees where id = p_emp;
  for s in select * from jsonb_array_elements((select steps from public.approval_chains where type = p_type)) loop
    continue when (s ->> 'min_amount') is not null and coalesce(p_amount, 0) < (s ->> 'min_amount')::numeric;
    v_ap := null; v_kind := 'manager';
    case s ->> 'kind'
      when 'manager' then v_ap := e.manager_id;
      when 'manager2' then select m.manager_id into v_ap from public.employees m where m.id = e.manager_id;
      when 'dept_manager' then select d.manager_employee_id into v_ap from public.departments d where d.id = e.department_id;
      when 'employee' then v_ap := (s ->> 'employee_id')::uuid;
      when 'hr' then v_kind := 'hr';
      else null;
    end case;
    if v_kind = 'hr' then
      continue when v_hr_added;
      v_step := v_step + 1; v_hr_added := true;
      insert into public.hr_request_steps (request_id, step, approver_kind) values (p_req, v_step, 'hr');
    else
      continue when v_ap is null or v_ap = p_emp or v_ap = any (v_seen)
        or not exists (select 1 from public.employees x where x.id = v_ap and x.status = 'active');
      v_step := v_step + 1; v_seen := v_seen || v_ap;
      insert into public.hr_request_steps (request_id, step, approver_kind, approver_employee_id) values (p_req, v_step, 'manager', v_ap);
    end if;
  end loop;
  if v_step = 0 then
    v_step := 1;
    insert into public.hr_request_steps (request_id, step, approver_kind) values (p_req, 1, 'hr');
  end if;
  return v_step;
end $$;
revoke all on function public._build_chain_steps(uuid, uuid, text, numeric) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) Custodies + expenses
-- ---------------------------------------------------------------------
create table if not exists public.custodies (
  id               uuid primary key default gen_random_uuid(),
  request_id       uuid not null unique references public.hr_requests(id) on delete cascade,
  ref_no           text not null,
  employee_id      uuid not null references public.employees(id) on delete cascade,
  amount           numeric(12,2) not null check (amount > 0),
  purpose          text,
  status           text not null default 'active' check (status in ('active', 'settlement_requested', 'closed')),
  issued_at        timestamptz not null default now(),
  settlement_requested_at timestamptz,
  returned_amount  numeric(12,2),
  closed_at        timestamptz,
  closed_by        uuid references public.profiles(id) on delete set null,
  close_note       text
);
create index if not exists custodies_emp_idx on public.custodies (employee_id, issued_at desc);

create table if not exists public.custody_expenses (
  id              uuid primary key default gen_random_uuid(),
  custody_id      uuid not null references public.custodies(id) on delete cascade,
  kind            text not null check (kind in ('invoice', 'no_invoice')),
  category        text not null check (category in ('materials', 'labor', 'cleaning', 'transport', 'fuel', 'maintenance', 'hospitality', 'government', 'other')),
  description     text,
  vendor          text,
  invoice_no      text,
  amount          numeric(12,2) not null check (amount > 0),
  expense_date    date not null,
  attachment_path text,
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note     text,
  reviewed_by     uuid references public.profiles(id) on delete set null,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists custody_expenses_custody_idx on public.custody_expenses (custody_id, expense_date);

alter table public.custodies enable row level security;
alter table public.custody_expenses enable row level security;
drop policy if exists custodies_read on public.custodies;
drop policy if exists custody_expenses_read on public.custody_expenses;
create policy custodies_read on public.custodies for select to authenticated using (public.can_view_employee(employee_id));
create policy custody_expenses_read on public.custody_expenses for select to authenticated
  using (exists (select 1 from public.custodies c where c.id = custody_id and public.can_view_employee(c.employee_id)));
grant select on public.custodies, public.custody_expenses to authenticated;

-- balances
create or replace view public.custody_summary with (security_invoker = true) as
select c.*, e.full_name as employee_name, e.job_title,
  coalesce(sum(x.amount) filter (where x.status = 'approved'), 0) as spent_approved,
  coalesce(sum(x.amount) filter (where x.status = 'pending'), 0) as spent_pending,
  count(x.id) filter (where x.status = 'pending') as pending_count,
  c.amount - coalesce(sum(x.amount) filter (where x.status <> 'rejected'), 0) as remaining
from public.custodies c
join public.employees e on e.id = c.employee_id
left join public.custody_expenses x on x.custody_id = c.id
group by c.id, e.full_name, e.job_title;
grant select on public.custody_summary to authenticated;

-- open the custody when its request is fully approved
create or replace function public.open_custody_on_approval()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'custody' and new.status = 'approved' and old.status is distinct from 'approved' then
    insert into public.custodies (request_id, ref_no, employee_id, amount, purpose)
    values (new.id, new.ref_no, new.employee_id, new.amount, new.reason)
    on conflict (request_id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists trg_open_custody on public.hr_requests;
create trigger trg_open_custody after update of status on public.hr_requests
  for each row execute function public.open_custody_on_approval();
revoke all on function public.open_custody_on_approval() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3) Employee actions
-- ---------------------------------------------------------------------
create or replace function public.submit_custody_request(p_amount numeric, p_purpose text)
returns text language plpgsql security definer set search_path = public as $$
declare v_emp record; v_req uuid; v_ref text; v_max numeric;
begin
  select * into v_emp from public.employees where id = public.my_employee_id();
  if v_emp.id is null or v_emp.status <> 'active' then raise exception 'NO_EMPLOYEE_FILE' using errcode = 'P0001'; end if;
  select max_amount into v_max from public.approval_chains where type = 'custody';
  if p_amount is null or p_amount <= 0 or p_amount > coalesce(v_max, 50000) then raise exception 'INVALID_AMOUNT' using errcode = 'P0001'; end if;
  if coalesce(btrim(p_purpose), '') = '' then raise exception 'NOTE_REQUIRED' using errcode = 'P0001'; end if;
  if exists (select 1 from public.hr_requests where employee_id = v_emp.id and type = 'custody' and status = 'pending') then
    raise exception 'OVERLAPPING_REQUEST' using errcode = 'P0001';
  end if;
  insert into public.hr_requests (employee_id, type, amount, reason)
  values (v_emp.id, 'custody', round(p_amount, 2), left(btrim(p_purpose), 2000))
  returning id, ref_no into v_req, v_ref;
  perform public._build_chain_steps(v_req, v_emp.id, 'custody', p_amount);
  perform public.notify_hr_step(v_req);
  return v_ref;
end $$;

create or replace function public.add_custody_expense(p_custody uuid, p_kind text, p_category text, p_amount numeric, p_date date,
  p_description text default null, p_vendor text default null, p_invoice_no text default null, p_attachment text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare c record; v_rem numeric; v_id uuid;
begin
  select * into c from public.custody_summary where id = p_custody;
  if c.id is null or c.employee_id is distinct from public.my_employee_id() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if c.status <> 'active' then raise exception 'CUSTODY_NOT_ACTIVE' using errcode = 'P0001'; end if;
  if p_kind not in ('invoice', 'no_invoice') then raise exception 'INVALID_KIND' using errcode = 'P0001'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT' using errcode = 'P0001'; end if;
  if p_amount > c.remaining then raise exception 'EXCEEDS_CUSTODY' using errcode = 'P0001', detail = c.remaining::text; end if;
  if p_date is null or p_date > public.today_riyadh() or p_date < (c.issued_at at time zone 'Asia/Riyadh')::date - 7 then
    raise exception 'INVALID_DATE' using errcode = 'P0001';
  end if;
  if p_kind = 'invoice' and coalesce(p_attachment, '') = '' then raise exception 'ATTACHMENT_REQUIRED' using errcode = 'P0001'; end if;
  if p_kind = 'no_invoice' and coalesce(btrim(p_description), '') = '' then raise exception 'NOTE_REQUIRED' using errcode = 'P0001'; end if;
  if p_attachment is not null and p_attachment !~ ('^' || c.employee_id::text || '/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp)$') then
    raise exception 'INVALID_FILE' using errcode = 'P0001';
  end if;
  insert into public.custody_expenses (custody_id, kind, category, description, vendor, invoice_no, amount, expense_date, attachment_path)
  values (p_custody, p_kind, p_category, left(nullif(btrim(p_description), ''), 500), left(nullif(btrim(p_vendor), ''), 160),
    left(nullif(btrim(p_invoice_no), ''), 60), round(p_amount, 2), p_date, nullif(p_attachment, ''))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.delete_custody_expense(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.custody_expenses x using public.custodies c
  where x.id = p_id and c.id = x.custody_id and c.employee_id = public.my_employee_id() and x.status = 'pending' and c.status = 'active';
  if not found then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
end $$;

create or replace function public.request_custody_settlement(p_custody uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c record; v_user uuid;
begin
  select * into c from public.custody_summary where id = p_custody;
  if c.id is null or c.employee_id is distinct from public.my_employee_id() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if c.status <> 'active' then raise exception 'CUSTODY_NOT_ACTIVE' using errcode = 'P0001'; end if;
  update public.custodies set status = 'settlement_requested', settlement_requested_at = now() where id = p_custody;
  for v_user in select id from public.profiles where role::text in ('hr', 'admin') and is_active loop
    perform public.notify_user(v_user, 'custody_settlement', null,
      jsonb_build_object('ref_no', c.ref_no, 'name', c.employee_name, 'link', '/hr/custody/' || c.id));
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4) HR actions
-- ---------------------------------------------------------------------
create or replace function public.review_custody_expense(p_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare x record;
begin
  if not public.is_hr() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  select ce.*, c.employee_id, c.ref_no, c.id as cid, c.status as cstatus into x
  from public.custody_expenses ce join public.custodies c on c.id = ce.custody_id where ce.id = p_id for update of ce;
  if x.id is null or x.status <> 'pending' then raise exception 'REQUEST_NOT_ACTIVE' using errcode = 'P0001'; end if;
  if x.employee_id = public.my_employee_id() and public.auth_role()::text <> 'admin' then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if not p_approve and coalesce(btrim(p_note), '') = '' then raise exception 'NOTE_REQUIRED' using errcode = 'P0001'; end if;
  update public.custody_expenses set status = case when p_approve then 'approved' else 'rejected' end,
    review_note = nullif(btrim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now() where id = p_id;
  if not p_approve then
    perform public.notify_user((select profile_id from public.employees where id = x.employee_id), 'custody_expense_rejected', null,
      jsonb_build_object('ref_no', x.ref_no, 'note', p_note, 'link', '/me/custody/' || x.cid));
  end if;
end $$;

create or replace function public.close_custody(p_custody uuid, p_returned numeric default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare c record;
begin
  if not public.is_hr() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  select * into c from public.custody_summary where id = p_custody;
  if c.id is null or c.status = 'closed' then raise exception 'CUSTODY_NOT_ACTIVE' using errcode = 'P0001'; end if;
  if c.employee_id = public.my_employee_id() and public.auth_role()::text <> 'admin' then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if c.pending_count > 0 then raise exception 'PENDING_EXPENSES' using errcode = 'P0001'; end if;
  if p_returned is not null and (p_returned < 0 or p_returned > c.remaining) then raise exception 'INVALID_AMOUNT' using errcode = 'P0001'; end if;
  update public.custodies set status = 'closed', returned_amount = coalesce(p_returned, c.remaining), closed_at = now(),
    closed_by = auth.uid(), close_note = nullif(btrim(p_note), '') where id = p_custody;
  perform public.notify_user((select profile_id from public.employees where id = c.employee_id), 'custody_closed', null,
    jsonb_build_object('ref_no', c.ref_no, 'link', '/me/custody/' || c.id));
end $$;

revoke all on function public.set_approval_chain(text, jsonb, numeric), public.submit_custody_request(numeric, text),
  public.add_custody_expense(uuid, text, text, numeric, date, text, text, text, text), public.delete_custody_expense(uuid),
  public.request_custody_settlement(uuid), public.review_custody_expense(uuid, boolean, text), public.close_custody(uuid, numeric, text)
  from public, anon;
grant execute on function public.set_approval_chain(text, jsonb, numeric), public.submit_custody_request(numeric, text),
  public.add_custody_expense(uuid, text, text, numeric, date, text, text, text, text), public.delete_custody_expense(uuid),
  public.request_custody_settlement(uuid), public.review_custody_expense(uuid, boolean, text), public.close_custody(uuid, numeric, text)
  to authenticated;

-- invoices of a custody are readable by whoever can see that custody (HR, managers above the employee)
drop policy if exists "hr-docs read" on storage.objects;
create policy "hr-docs read" on storage.objects for select to authenticated
  using (bucket_id = 'hr-docs' and (
    public.is_hr() or split_part(name, '/', 1) = public.my_employee_id()::text
    or exists (select 1 from public.hr_requests r where r.attachment_path = name and public.can_view_hr_request(r.id))
    or exists (select 1 from public.custody_expenses x join public.custodies c on c.id = x.custody_id
               where x.attachment_path = name and public.can_view_employee(c.employee_id))));
