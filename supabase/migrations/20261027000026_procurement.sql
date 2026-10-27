-- =====================================================================
-- 26) Procurement (المشتريات)
--   purchase request → assigned buyer (مندوب) collects N quotes (default 3) → submits for approval
--   → procurement approver or owner/admin picks the winning quote (above a threshold: admin only)
--   → buyer is told which supplier to buy from → buyer confirms the purchase with the invoice.
--   Every quote feeds a supplier database (quotes, wins, purchased totals).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Who does what
-- ---------------------------------------------------------------------
create table if not exists public.procurement_members (
  profile_id  uuid primary key references public.profiles(id) on delete cascade,
  role        text not null check (role in ('rep', 'approver')),
  added_by    uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.procurement_settings (
  id               int primary key default 1 check (id = 1),
  quotes_required  int not null default 3 check (quotes_required between 1 and 6),
  admin_threshold  numeric(12,2),             -- chosen quote at/above this amount: only admin (owner) may approve
  updated_by       uuid references public.profiles(id) on delete set null,
  updated_at       timestamptz not null default now()
);
insert into public.procurement_settings (id) values (1) on conflict do nothing;

-- 'admin' | 'approver' | 'rep' | null
create or replace function public.proc_role()
returns text language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then 'admin'
              else (select m.role from public.procurement_members m join public.profiles p on p.id = m.profile_id
                    where m.profile_id = auth.uid() and p.is_active) end
$$;

-- ---------------------------------------------------------------------
-- 2) Suppliers
-- ---------------------------------------------------------------------
create table if not exists public.suppliers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(btrim(name)) between 2 and 160),
  category      text,
  contact_name  text,
  phone         text,
  email         text,
  cr_no         text,
  vat_no        text,
  notes         text,
  is_active     boolean not null default true,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create unique index if not exists suppliers_name_uq on public.suppliers (lower(btrim(name)));

-- ---------------------------------------------------------------------
-- 3) Purchase requests, items, quotes
-- ---------------------------------------------------------------------
create sequence if not exists public.purchase_ref_seq start 1001;
create table if not exists public.purchase_requests (
  id                uuid primary key default gen_random_uuid(),
  ref_no            text not null unique default ('PR-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.purchase_ref_seq')::text, 5, '0')),
  title             text not null check (length(btrim(title)) between 2 and 200),
  description       text,
  needed_by         date,
  project_id        uuid references public.projects(id) on delete set null,
  requested_by      uuid references public.profiles(id) on delete set null,
  rep_id            uuid references public.profiles(id) on delete set null,
  quotes_required   int not null default 3 check (quotes_required between 1 and 6),
  status            text not null default 'quoting'
                    check (status in ('quoting', 'pending_approval', 'approved', 'purchased', 'rejected', 'cancelled')),
  submit_note       text,
  submitted_at      timestamptz,
  chosen_quote_id   uuid,
  decided_by        uuid references public.profiles(id) on delete set null,
  decided_at        timestamptz,
  decision_note     text,
  purchased_amount  numeric(12,2),
  invoice_path      text,
  purchase_note     text,
  purchased_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists purchase_requests_status_idx on public.purchase_requests (status, created_at desc);
create index if not exists purchase_requests_rep_idx on public.purchase_requests (rep_id, status);

create table if not exists public.purchase_items (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.purchase_requests(id) on delete cascade,
  position    int not null default 1,
  name        text not null check (length(btrim(name)) between 1 and 200),
  qty         numeric(12,2) not null default 1 check (qty > 0),
  unit        text,
  notes       text
);
create index if not exists purchase_items_req_idx on public.purchase_items (request_id, position);

create table if not exists public.purchase_quotes (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null references public.purchase_requests(id) on delete cascade,
  quote_no       int not null,
  supplier_id    uuid not null references public.suppliers(id) on delete restrict,
  amount         numeric(12,2) not null check (amount > 0),
  vat_included   boolean not null default true,
  delivery_days  int check (delivery_days is null or delivery_days between 0 and 365),
  valid_until    date,
  file_path      text,
  notes          text,
  uploaded_by    uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (request_id, quote_no),
  unique (request_id, supplier_id)
);
create index if not exists purchase_quotes_supplier_idx on public.purchase_quotes (supplier_id);

alter table public.purchase_requests drop constraint if exists purchase_requests_chosen_fk;
alter table public.purchase_requests add constraint purchase_requests_chosen_fk
  foreign key (chosen_quote_id) references public.purchase_quotes(id) on delete set null;

-- who may see a purchase request
create or replace function public.can_view_purchase(p_req uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.purchase_requests r
    where r.id = p_req and (
      public.proc_role() in ('admin', 'approver')
      or r.rep_id = auth.uid()
      or r.requested_by = auth.uid()))
$$;

-- ---------------------------------------------------------------------
-- 4) RLS — reads only; every write goes through the functions below
-- ---------------------------------------------------------------------
alter table public.procurement_members enable row level security;
alter table public.procurement_settings enable row level security;
alter table public.suppliers enable row level security;
alter table public.purchase_requests enable row level security;
alter table public.purchase_items enable row level security;
alter table public.purchase_quotes enable row level security;

drop policy if exists proc_members_read on public.procurement_members;
create policy proc_members_read on public.procurement_members for select to authenticated using (true);
drop policy if exists proc_settings_read on public.procurement_settings;
create policy proc_settings_read on public.procurement_settings for select to authenticated using (true);
drop policy if exists suppliers_read on public.suppliers;
create policy suppliers_read on public.suppliers for select to authenticated using (public.proc_role() is not null);
drop policy if exists purchase_requests_read on public.purchase_requests;
create policy purchase_requests_read on public.purchase_requests for select to authenticated using (public.can_view_purchase(id));
drop policy if exists purchase_items_read on public.purchase_items;
create policy purchase_items_read on public.purchase_items for select to authenticated using (public.can_view_purchase(request_id));
drop policy if exists purchase_quotes_read on public.purchase_quotes;
create policy purchase_quotes_read on public.purchase_quotes for select to authenticated using (public.can_view_purchase(request_id));

grant select on public.procurement_members, public.procurement_settings, public.suppliers,
  public.purchase_requests, public.purchase_items, public.purchase_quotes to authenticated;

-- ---------------------------------------------------------------------
-- 5) Views
-- ---------------------------------------------------------------------
-- runs with the view owner's rights so names of requester / buyer / approver show to everyone allowed to see the request;
-- the WHERE clause applies the same visibility rule as the table policy
drop view if exists public.purchase_overview;
create view public.purchase_overview as
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
revoke all on public.purchase_overview from anon;
grant select on public.purchase_overview to authenticated;

-- complete figures for the procurement team (a buyer's own RLS view would only count their requests)
drop view if exists public.supplier_stats;
create view public.supplier_stats as
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
revoke all on public.supplier_stats from anon;
grant select on public.supplier_stats to authenticated;

-- buyers anyone may pick when raising a request
create or replace function public.procurement_reps()
returns table (id uuid, full_name text) language sql stable security definer set search_path = public as $$
  select p.id, p.full_name from public.procurement_members m join public.profiles p on p.id = m.profile_id
  where m.role = 'rep' and p.is_active and auth.uid() is not null
  order by p.full_name
$$;
revoke all on function public.procurement_reps() from public, anon;
grant execute on function public.procurement_reps() to authenticated;

-- ---------------------------------------------------------------------
-- 6) Actions
-- ---------------------------------------------------------------------
create or replace function public._notify_proc_approvers(p_req uuid, p_amount numeric)
returns void language plpgsql security definer set search_path = public as $$
declare r record; v_thr numeric; v_user uuid;
begin
  select * into r from public.purchase_requests where id = p_req;
  select admin_threshold into v_thr from public.procurement_settings where id = 1;
  for v_user in
    select p.id from public.profiles p where p.role::text = 'admin' and p.is_active
    union
    select m.profile_id from public.procurement_members m join public.profiles p on p.id = m.profile_id
    where m.role = 'approver' and p.is_active and (v_thr is null or coalesce(p_amount, 0) < v_thr)
  loop
    continue when v_user = r.rep_id;
    perform public.notify_user(v_user, 'purchase_submitted', null,
      jsonb_build_object('ref_no', r.ref_no, 'title', r.title, 'link', '/procurement/' || r.id));
  end loop;
end $$;
revoke all on function public._notify_proc_approvers(uuid, numeric) from public, anon, authenticated;

create or replace function public.create_purchase_request(p_title text, p_items jsonb, p_description text default null,
  p_needed_by date default null, p_project uuid default null, p_rep uuid default null, p_quotes int default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_ref text; v_rep uuid; it jsonb; v_pos int := 0; v_q int;
begin
  if auth.uid() is null or public.auth_role() is null or public.auth_role()::text = 'owner' then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if coalesce(btrim(p_title), '') = '' then raise exception 'REQUIRED' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'ITEMS_REQUIRED' using errcode = 'P0001';
  end if;
  if p_needed_by is not null and p_needed_by < public.today_riyadh() then raise exception 'INVALID_DATE' using errcode = 'P0001'; end if;
  if p_rep is not null then
    if not exists (select 1 from public.procurement_members m join public.profiles p on p.id = m.profile_id
                   where m.profile_id = p_rep and m.role = 'rep' and p.is_active) then
      raise exception 'INVALID_REP' using errcode = 'P0001';
    end if;
    v_rep := p_rep;
  else
    -- the active buyer with the fewest open requests
    select m.profile_id into v_rep from public.procurement_members m join public.profiles p on p.id = m.profile_id
    where m.role = 'rep' and p.is_active
    order by (select count(*) from public.purchase_requests r where r.rep_id = m.profile_id and r.status in ('quoting', 'approved')), m.created_at
    limit 1;
  end if;
  if v_rep is null then raise exception 'NO_REP' using errcode = 'P0001'; end if;
  select coalesce(p_quotes, quotes_required) into v_q from public.procurement_settings where id = 1;
  if v_q not between 1 and 6 then raise exception 'INVALID_AMOUNT' using errcode = 'P0001'; end if;

  insert into public.purchase_requests (title, description, needed_by, project_id, requested_by, rep_id, quotes_required)
  values (left(btrim(p_title), 200), left(nullif(btrim(p_description), ''), 3000), p_needed_by, p_project, auth.uid(), v_rep, v_q)
  returning id, ref_no into v_id, v_ref;
  for it in select * from jsonb_array_elements(p_items) loop
    continue when coalesce(btrim(it ->> 'name'), '') = '';
    v_pos := v_pos + 1;
    insert into public.purchase_items (request_id, position, name, qty, unit, notes)
    values (v_id, v_pos, left(btrim(it ->> 'name'), 200), greatest(coalesce(nullif(it ->> 'qty', '')::numeric, 1), 0.01),
      left(nullif(btrim(it ->> 'unit'), ''), 30), left(nullif(btrim(it ->> 'notes'), ''), 300));
  end loop;
  if v_pos = 0 then raise exception 'ITEMS_REQUIRED' using errcode = 'P0001'; end if;
  perform public.notify_user(v_rep, 'purchase_assigned', null,
    jsonb_build_object('ref_no', v_ref, 'title', left(btrim(p_title), 200), 'count', v_q, 'link', '/procurement/' || v_id));
  return v_ref;
end $$;

create or replace function public.upsert_supplier(p_id uuid, p_name text, p_category text default null, p_contact text default null,
  p_phone text default null, p_email text default null, p_cr text default null, p_vat text default null, p_notes text default null,
  p_active boolean default true)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if public.proc_role() is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if coalesce(btrim(p_name), '') = '' then raise exception 'REQUIRED' using errcode = 'P0001'; end if;
  if p_id is null then
    select id into v_id from public.suppliers where lower(btrim(name)) = lower(btrim(p_name));
    if v_id is not null then raise exception 'SUPPLIER_EXISTS' using errcode = 'P0001'; end if;
    insert into public.suppliers (name, category, contact_name, phone, email, cr_no, vat_no, notes, created_by)
    values (left(btrim(p_name), 160), left(nullif(btrim(p_category), ''), 80), left(nullif(btrim(p_contact), ''), 120),
      left(nullif(btrim(p_phone), ''), 30), left(nullif(btrim(p_email), ''), 160), left(nullif(btrim(p_cr), ''), 30),
      left(nullif(btrim(p_vat), ''), 30), left(nullif(btrim(p_notes), ''), 1000), auth.uid())
    returning id into v_id;
  else
    update public.suppliers set name = left(btrim(p_name), 160), category = left(nullif(btrim(p_category), ''), 80),
      contact_name = left(nullif(btrim(p_contact), ''), 120), phone = left(nullif(btrim(p_phone), ''), 30),
      email = left(nullif(btrim(p_email), ''), 160), cr_no = left(nullif(btrim(p_cr), ''), 30), vat_no = left(nullif(btrim(p_vat), ''), 30),
      notes = left(nullif(btrim(p_notes), ''), 1000), is_active = coalesce(p_active, true)
    where id = p_id returning id into v_id;
    if v_id is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  end if;
  return v_id;
exception when unique_violation then raise exception 'SUPPLIER_EXISTS' using errcode = 'P0001';
end $$;

create or replace function public.add_purchase_quote(p_req uuid, p_supplier uuid, p_amount numeric, p_vat_included boolean default true,
  p_delivery_days int default null, p_valid_until date default null, p_file text default null, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare r record; v_id uuid; v_no int;
begin
  select * into r from public.purchase_requests where id = p_req for update;
  if r.id is null or (r.rep_id is distinct from auth.uid() and coalesce(public.proc_role(), '') <> 'admin') then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if r.status <> 'quoting' then raise exception 'REQUEST_NOT_ACTIVE' using errcode = 'P0001'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.suppliers where id = p_supplier and is_active) then raise exception 'REQUIRED' using errcode = 'P0001'; end if;
  if exists (select 1 from public.purchase_quotes where request_id = p_req and supplier_id = p_supplier) then
    raise exception 'DUPLICATE_SUPPLIER' using errcode = 'P0001';
  end if;
  if (select count(*) from public.purchase_quotes where request_id = p_req) >= 6 then raise exception 'TOO_MANY_QUOTES' using errcode = 'P0001'; end if;
  if p_file is not null and p_file !~ ('^' || p_req::text || '/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp)$') then
    raise exception 'INVALID_FILE' using errcode = 'P0001';
  end if;
  select coalesce(max(quote_no), 0) + 1 into v_no from public.purchase_quotes where request_id = p_req;
  insert into public.purchase_quotes (request_id, quote_no, supplier_id, amount, vat_included, delivery_days, valid_until, file_path, notes, uploaded_by)
  values (p_req, v_no, p_supplier, round(p_amount, 2), coalesce(p_vat_included, true), p_delivery_days, p_valid_until,
    nullif(p_file, ''), left(nullif(btrim(p_notes), ''), 1000), auth.uid())
  returning id into v_id;
  update public.purchase_requests set updated_at = now() where id = p_req;
  return v_id;
end $$;

create or replace function public.delete_purchase_quote(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_q record;
begin
  select q.*, r.rep_id, r.status into v_q from public.purchase_quotes q join public.purchase_requests r on r.id = q.request_id where q.id = p_id;
  if v_q.id is null or (v_q.rep_id is distinct from auth.uid() and coalesce(public.proc_role(), '') <> 'admin') then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if v_q.status <> 'quoting' then raise exception 'REQUEST_NOT_ACTIVE' using errcode = 'P0001'; end if;
  delete from public.purchase_quotes where id = p_id;
end $$;

create or replace function public.submit_purchase_quotes(p_req uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r record; v_n int; v_min numeric;
begin
  select * into r from public.purchase_requests where id = p_req for update;
  if r.id is null or (r.rep_id is distinct from auth.uid() and coalesce(public.proc_role(), '') <> 'admin') then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if r.status <> 'quoting' then raise exception 'REQUEST_NOT_ACTIVE' using errcode = 'P0001'; end if;
  select count(*), min(amount) into v_n, v_min from public.purchase_quotes where request_id = p_req;
  if v_n = 0 then raise exception 'QUOTES_REQUIRED' using errcode = 'P0001'; end if;
  -- fewer quotes than required only with a written reason (e.g. a single authorised dealer)
  if v_n < r.quotes_required and coalesce(btrim(p_note), '') = '' then raise exception 'QUOTES_REQUIRED' using errcode = 'P0001'; end if;
  update public.purchase_requests set status = 'pending_approval', submit_note = left(nullif(btrim(p_note), ''), 1000),
    submitted_at = now(), updated_at = now() where id = p_req;
  perform public._notify_proc_approvers(p_req, v_min);
end $$;

-- p_action: 'approve' (with p_quote) | 'return' (needs more / better quotes) | 'reject'
create or replace function public.decide_purchase(p_req uuid, p_action text, p_quote uuid default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r record; v_q record; v_role text := coalesce(public.proc_role(), ''); v_thr numeric; v_type text;
begin
  if v_role not in ('admin', 'approver') then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  select * into r from public.purchase_requests where id = p_req for update;
  if r.id is null or r.status <> 'pending_approval' then raise exception 'REQUEST_NOT_ACTIVE' using errcode = 'P0001'; end if;
  if r.rep_id = auth.uid() and v_role <> 'admin' then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if p_action = 'approve' then
    select q.*, s.name as supplier_name into v_q from public.purchase_quotes q join public.suppliers s on s.id = q.supplier_id
    where q.id = p_quote and q.request_id = p_req;
    if v_q.id is null then raise exception 'REQUIRED' using errcode = 'P0001'; end if;
    select admin_threshold into v_thr from public.procurement_settings where id = 1;
    if v_thr is not null and v_q.amount >= v_thr and v_role <> 'admin' then raise exception 'ABOVE_THRESHOLD' using errcode = 'P0001'; end if;
    update public.purchase_requests set status = 'approved', chosen_quote_id = v_q.id, decided_by = auth.uid(), decided_at = now(),
      decision_note = left(nullif(btrim(p_note), ''), 1000), updated_at = now() where id = p_req;
    perform public.notify_user(r.rep_id, 'purchase_approved', null, jsonb_build_object('ref_no', r.ref_no, 'title', r.title,
      'no', v_q.quote_no, 'supplier', v_q.supplier_name, 'amount', v_q.amount, 'link', '/procurement/' || r.id));
    if r.requested_by is distinct from r.rep_id then
      perform public.notify_user(r.requested_by, 'purchase_approved_requester', null, jsonb_build_object('ref_no', r.ref_no,
        'title', r.title, 'supplier', v_q.supplier_name, 'link', '/procurement/' || r.id));
    end if;
  elsif p_action in ('return', 'reject') then
    if coalesce(btrim(p_note), '') = '' then raise exception 'NOTE_REQUIRED' using errcode = 'P0001'; end if;
    update public.purchase_requests set status = case when p_action = 'return' then 'quoting' else 'rejected' end,
      decided_by = auth.uid(), decided_at = now(), decision_note = left(btrim(p_note), 1000), updated_at = now() where id = p_req;
    v_type := case when p_action = 'return' then 'purchase_returned' else 'purchase_rejected' end;
    perform public.notify_user(r.rep_id, v_type, null, jsonb_build_object('ref_no', r.ref_no, 'title', r.title, 'link', '/procurement/' || r.id));
    if p_action = 'reject' and r.requested_by is distinct from r.rep_id then
      perform public.notify_user(r.requested_by, v_type, null, jsonb_build_object('ref_no', r.ref_no, 'title', r.title, 'link', '/procurement/' || r.id));
    end if;
  else
    raise exception 'INVALID_KIND' using errcode = 'P0001';
  end if;
end $$;

create or replace function public.mark_purchased(p_req uuid, p_amount numeric, p_invoice text default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r record; v_user uuid;
begin
  select * into r from public.purchase_requests where id = p_req for update;
  if r.id is null or (r.rep_id is distinct from auth.uid() and coalesce(public.proc_role(), '') <> 'admin') then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if r.status <> 'approved' then raise exception 'REQUEST_NOT_ACTIVE' using errcode = 'P0001'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT' using errcode = 'P0001'; end if;
  if coalesce(p_invoice, '') = '' then raise exception 'ATTACHMENT_REQUIRED' using errcode = 'P0001'; end if;
  if p_invoice !~ ('^' || p_req::text || '/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp)$') then raise exception 'INVALID_FILE' using errcode = 'P0001'; end if;
  update public.purchase_requests set status = 'purchased', purchased_amount = round(p_amount, 2), invoice_path = p_invoice,
    purchase_note = left(nullif(btrim(p_note), ''), 1000), purchased_at = now(), updated_at = now() where id = p_req;
  for v_user in select distinct x from unnest(array[r.requested_by, r.decided_by]) x where x is not null and x <> auth.uid() loop
    perform public.notify_user(v_user, 'purchase_done', null, jsonb_build_object('ref_no', r.ref_no, 'title', r.title, 'link', '/procurement/' || r.id));
  end loop;
end $$;

create or replace function public.cancel_purchase_request(p_req uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from public.purchase_requests where id = p_req for update;
  if r.id is null or (r.requested_by is distinct from auth.uid() and coalesce(public.proc_role(), '') not in ('admin', 'approver')) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if r.status not in ('quoting', 'pending_approval') then raise exception 'REQUEST_NOT_ACTIVE' using errcode = 'P0001'; end if;
  update public.purchase_requests set status = 'cancelled', decision_note = left(nullif(btrim(p_note), ''), 1000),
    decided_by = auth.uid(), decided_at = now(), updated_at = now() where id = p_req;
  if r.rep_id is distinct from auth.uid() then
    perform public.notify_user(r.rep_id, 'purchase_cancelled', null, jsonb_build_object('ref_no', r.ref_no, 'title', r.title, 'link', '/procurement/' || r.id));
  end if;
end $$;

create or replace function public.set_procurement_member(p_profile uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if p_role is null or p_role = '' then
    delete from public.procurement_members where profile_id = p_profile;
    return;
  end if;
  if p_role not in ('rep', 'approver') then raise exception 'INVALID_KIND' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.profiles where id = p_profile and is_active and role::text not in ('owner')) then
    raise exception 'REQUIRED' using errcode = 'P0001';
  end if;
  insert into public.procurement_members (profile_id, role, added_by) values (p_profile, p_role, auth.uid())
  on conflict (profile_id) do update set role = excluded.role, added_by = excluded.added_by;
end $$;

create or replace function public.update_procurement_settings(p_quotes int, p_threshold numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if p_quotes is null or p_quotes not between 1 and 6 or (p_threshold is not null and p_threshold <= 0) then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
  end if;
  update public.procurement_settings set quotes_required = p_quotes, admin_threshold = p_threshold,
    updated_by = auth.uid(), updated_at = now() where id = 1;
end $$;

-- counts for the side menu badge: buyer → requests waiting for quotes / to buy; approver → waiting for a decision
create or replace function public.my_procurement_todo()
returns int language sql stable security definer set search_path = public as $$
  select case
    when public.proc_role() in ('admin', 'approver') then
      (select count(*)::int from public.purchase_requests where status = 'pending_approval' and rep_id is distinct from auth.uid())
      + (select count(*)::int from public.purchase_requests where rep_id = auth.uid() and status in ('quoting', 'approved'))
    else (select count(*)::int from public.purchase_requests where rep_id = auth.uid() and status in ('quoting', 'approved'))
  end
$$;

revoke all on function public.proc_role(), public.can_view_purchase(uuid),
  public.create_purchase_request(text, jsonb, text, date, uuid, uuid, int),
  public.upsert_supplier(uuid, text, text, text, text, text, text, text, text, boolean),
  public.add_purchase_quote(uuid, uuid, numeric, boolean, int, date, text, text), public.delete_purchase_quote(uuid),
  public.submit_purchase_quotes(uuid, text), public.decide_purchase(uuid, text, uuid, text),
  public.mark_purchased(uuid, numeric, text, text), public.cancel_purchase_request(uuid, text),
  public.set_procurement_member(uuid, text), public.update_procurement_settings(int, numeric), public.my_procurement_todo()
  from public, anon;
grant execute on function public.proc_role(), public.can_view_purchase(uuid),
  public.create_purchase_request(text, jsonb, text, date, uuid, uuid, int),
  public.upsert_supplier(uuid, text, text, text, text, text, text, text, text, boolean),
  public.add_purchase_quote(uuid, uuid, numeric, boolean, int, date, text, text), public.delete_purchase_quote(uuid),
  public.submit_purchase_quotes(uuid, text), public.decide_purchase(uuid, text, uuid, text),
  public.mark_purchased(uuid, numeric, text, text), public.cancel_purchase_request(uuid, text),
  public.set_procurement_member(uuid, text), public.update_procurement_settings(int, numeric), public.my_procurement_todo()
  to authenticated;

-- ---------------------------------------------------------------------
-- 7) Files: quotes and invoices live under procurement/<request id>/<uuid>.<ext>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('procurement', 'procurement', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "procurement upload" on storage.objects;
drop policy if exists "procurement read" on storage.objects;
create policy "procurement upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'procurement' and exists (
    select 1 from public.purchase_requests r
    where r.id::text = split_part(name, '/', 1) and (r.rep_id = auth.uid() or public.is_admin())));
create policy "procurement read" on storage.objects for select to authenticated
  using (bucket_id = 'procurement' and exists (
    select 1 from public.purchase_requests r where r.id::text = split_part(name, '/', 1) and public.can_view_purchase(r.id)));
