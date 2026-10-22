-- =====================================================================
--  دورة طلب الصيانة: التحقق من الضمان، الانتقالات، السجل الزمني، الإشعارات
-- =====================================================================

-- Denormalised actor info on audit rows (keeps the name as it was at the time)
alter table public.activity_logs  add column actor_name text, add column actor_role public.app_role;
alter table public.request_notes  add column author_name text, add column author_role public.app_role;

create or replace function public.stamp_actor()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text; v_role public.app_role;
begin
  select full_name, role into v_name, v_role from public.profiles where id = auth.uid();
  if tg_table_name = 'activity_logs' then
    new.actor_id   := coalesce(new.actor_id, auth.uid());
    new.actor_name := coalesce(new.actor_name, v_name);
    new.actor_role := coalesce(new.actor_role, v_role);
  else
    new.author_id   := auth.uid();
    new.author_name := v_name;
    new.author_role := v_role;
  end if;
  return new;
end $$;

create trigger trg_logs_actor  before insert on public.activity_logs  for each row execute function public.stamp_actor();
create trigger trg_notes_actor before insert on public.request_notes  for each row execute function public.stamp_actor();

-- ---------------------------------------------------------------------
-- Notifications (internal — not callable by clients)
-- ---------------------------------------------------------------------
create or replace function public.notify_user(p_user uuid, p_type text, p_request uuid, p_payload jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_channel text;
begin
  if p_user is null then return; end if;
  insert into public.notifications (user_id, type, request_id, payload)
  values (p_user, p_type, p_request, coalesce(p_payload, '{}'))
  returning id into v_id;

  -- future channels: queue a delivery per enabled channel
  for v_channel in select unnest(notify_channels) from public.company_settings where id = 1 loop
    insert into public.notification_outbox (notification_id, channel) values (v_id, v_channel);
  end loop;
end $$;

create or replace function public.notify_staff(p_type text, p_request uuid, p_payload jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  for v_user in
    select id from public.profiles
    where role in ('admin', 'supervisor') and is_active and id is distinct from auth.uid()
  loop
    perform public.notify_user(v_user, p_type, p_request, p_payload);
  end loop;
end $$;

create or replace function public.request_owner_profile(p_request uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select o.profile_id from public.maintenance_requests r
  join public.owners o on o.id = r.owner_id where r.id = p_request
$$;

create or replace function public.request_technician_profile(p_request uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select t.profile_id from public.work_orders w
  join public.technicians t on t.id = w.technician_id
  where w.request_id = p_request and w.status <> 'cancelled'
  order by w.created_at desc limit 1
$$;

-- ---------------------------------------------------------------------
-- Warranty evaluation
-- ---------------------------------------------------------------------
create or replace function public.evaluate_warranty(
  p_unit uuid, p_category public.maintenance_category, p_on date default current_date,
  out state public.warranty_state, out warranty_id uuid, out note text)
language plpgsql stable security definer set search_path = public as $$
declare v_any_for_cat boolean; v_any boolean; v_end date;
begin
  select w.id, w.title || ' — حتى ' || to_char(w.end_date, 'YYYY-MM-DD')
    into warranty_id, note
  from public.warranties w
  where w.unit_id = p_unit
    and (w.category is null or w.category = p_category)
    and p_on between w.start_date and w.end_date
  order by (w.category is null), w.end_date desc
  limit 1;

  if warranty_id is not null then
    state := 'in_warranty';
    return;
  end if;

  select max(end_date) into v_end from public.warranties
  where unit_id = p_unit and (category is null or category = p_category);
  select exists (select 1 from public.warranties where unit_id = p_unit) into v_any;

  if v_end is not null then
    state := 'out_of_warranty';
    note  := 'انتهى الضمان بتاريخ ' || to_char(v_end, 'YYYY-MM-DD');
  elsif v_any then
    state := 'out_of_warranty';
    note  := 'نوع العطل غير مشمول في ضمانات الوحدة';
  else
    state := 'unknown';
    note  := 'لا توجد ضمانات مسجلة لهذه الوحدة';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Request insert: fill owner, warranty, SLA; force safe defaults for owners
-- ---------------------------------------------------------------------
create or replace function public.before_request_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_unit_owner uuid; v_w record; v_sla int;
begin
  select owner_id into v_unit_owner from public.units where id = new.unit_id;
  if v_unit_owner is null then
    raise exception 'UNIT_HAS_NO_OWNER' using errcode = 'P0001';
  end if;
  new.owner_id := v_unit_owner;
  new.created_by := auth.uid();

  if not public.is_staff() then
    new.status := 'new';
    new.priority := 'medium';
    new.is_paid := false;
    new.reject_reason := null;
  end if;
  new.first_response_at := null;
  new.completed_at := null;
  new.reopen_count := 0;

  select * into v_w from public.evaluate_warranty(new.unit_id, new.category, current_date);
  new.warranty_state := v_w.state;
  new.warranty_id    := v_w.warranty_id;
  new.warranty_note  := v_w.note;

  select resolution_sla_hours into v_sla from public.company_settings where id = 1;
  new.due_at := now() + make_interval(hours => coalesce(v_sla, 120));
  return new;
end $$;

create trigger trg_request_before_insert before insert on public.maintenance_requests
  for each row execute function public.before_request_insert();

create or replace function public.after_request_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.activity_logs (request_id, action, to_status, meta)
  values (new.id, 'created', new.status,
          jsonb_build_object('category', new.category, 'warranty_state', new.warranty_state));
  perform public.notify_staff('request_created', new.id, jsonb_build_object('ref_no', new.ref_no));
  perform public.notify_user(public.request_owner_profile(new.id), 'request_received', new.id,
                             jsonb_build_object('ref_no', new.ref_no));
  return new;
end $$;

create trigger trg_request_after_insert after insert on public.maintenance_requests
  for each row execute function public.after_request_insert();

-- ---------------------------------------------------------------------
-- Status change → timeline + notifications
-- ---------------------------------------------------------------------
create or replace function public.after_request_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_note text := nullif(current_setting('app.note', true), '');
        v_payload jsonb;
        v_type text;
begin
  insert into public.activity_logs (request_id, action, from_status, to_status, note)
  values (new.id, 'status_changed', old.status, new.status, v_note);

  v_payload := jsonb_build_object('ref_no', new.ref_no, 'from', old.status, 'to', new.status, 'note', v_note);

  v_type := case new.status
    when 'assigned'  then 'technician_assigned'
    when 'scheduled' then 'visit_confirmed'
    when 'completed' then 'completed'
    else 'status_changed' end;
  perform public.notify_user(public.request_owner_profile(new.id), v_type, new.id, v_payload);

  if new.status = 'completed' then
    perform public.notify_user(public.request_owner_profile(new.id), 'rating_requested', new.id, v_payload);
  end if;

  if new.status in ('pending_approval', 'reopened', 'awaiting_parts') then
    perform public.notify_staff('status_changed', new.id, v_payload);
  end if;

  if new.status in ('postponed', 'rejected') then
    perform public.notify_user(public.request_technician_profile(new.id), 'status_changed', new.id, v_payload);
  end if;
  return new;
end $$;

create trigger trg_request_status after update of status on public.maintenance_requests
  for each row when (old.status is distinct from new.status)
  execute function public.after_request_status_change();

-- Field edits by staff (priority / warranty override) are logged too
create or replace function public.after_request_field_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.priority is distinct from new.priority then
    insert into public.activity_logs (request_id, action, meta)
    values (new.id, 'priority_changed', jsonb_build_object('from', old.priority, 'to', new.priority));
  end if;
  if old.warranty_state is distinct from new.warranty_state then
    insert into public.activity_logs (request_id, action, note, meta)
    values (new.id, 'warranty_changed', new.warranty_note,
            jsonb_build_object('from', old.warranty_state, 'to', new.warranty_state));
  end if;
  return new;
end $$;

create trigger trg_request_fields after update of priority, warranty_state on public.maintenance_requests
  for each row execute function public.after_request_field_change();

-- Notes → notify the other side
create or replace function public.after_note_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_ref text;
begin
  select ref_no into v_ref from public.maintenance_requests where id = new.request_id;
  insert into public.activity_logs (request_id, action, note, meta)
  values (new.request_id, 'note_added', case when new.is_internal then null else left(new.body, 280) end,
          jsonb_build_object('internal', new.is_internal));
  if new.author_role = 'owner' then
    perform public.notify_staff('note_added', new.request_id, jsonb_build_object('ref_no', v_ref));
    perform public.notify_user(public.request_technician_profile(new.request_id), 'note_added', new.request_id, jsonb_build_object('ref_no', v_ref));
  elsif not new.is_internal then
    perform public.notify_user(public.request_owner_profile(new.request_id), 'note_added', new.request_id, jsonb_build_object('ref_no', v_ref));
  end if;
  return new;
end $$;

create trigger trg_note_after_insert after insert on public.request_notes
  for each row execute function public.after_note_insert();

-- ---------------------------------------------------------------------
-- Transition rules
-- ---------------------------------------------------------------------
create or replace function public.status_transition_allowed(p_from public.request_status, p_to public.request_status)
returns boolean language sql immutable as $$
  select (p_from::text || '>' || p_to::text) = any (array[
    'new>under_review', 'new>approved', 'new>rejected', 'new>postponed',
    'under_review>approved', 'under_review>rejected', 'under_review>postponed',
    'approved>postponed', 'approved>rejected',
    'assigned>postponed', 'assigned>awaiting_parts',
    'scheduled>in_progress', 'scheduled>postponed', 'scheduled>awaiting_parts',
    'in_progress>awaiting_parts', 'in_progress>postponed', 'in_progress>pending_approval',
    'awaiting_parts>in_progress', 'awaiting_parts>postponed',
    'postponed>under_review', 'postponed>approved',
    'rejected>reopened', 'completed>reopened',
    'reopened>under_review', 'reopened>approved', 'reopened>rejected'
  ])
$$;

-- internal: change status + timestamps (no permission check — callers check)
create or replace function public._set_request_status(p_id uuid, p_to public.request_status, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.note', coalesce(p_note, ''), true);
  update public.maintenance_requests r set
    status            = p_to,
    first_response_at = case when r.first_response_at is null and p_to <> 'new' then now() else r.first_response_at end,
    completed_at      = case when p_to = 'completed' then now()
                             when p_to = 'reopened'  then null else r.completed_at end,
    reject_reason     = case when p_to = 'rejected' then p_note else r.reject_reason end,
    reopen_count      = r.reopen_count + case when p_to = 'reopened' then 1 else 0 end
  where r.id = p_id;
  perform set_config('app.note', '', true);
end $$;

-- Staff: generic transition
create or replace function public.transition_request(p_id uuid, p_to public.request_status, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_from public.request_status;
begin
  if not public.is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select status into v_from from public.maintenance_requests where id = p_id for update;
  if v_from is null then raise exception 'NOT_FOUND'; end if;
  if not public.status_transition_allowed(v_from, p_to) then
    raise exception 'INVALID_TRANSITION: % -> %', v_from, p_to using errcode = 'P0001';
  end if;
  if p_to in ('rejected', 'postponed') and coalesce(btrim(p_note), '') = '' then
    raise exception 'NOTE_REQUIRED' using errcode = 'P0001';
  end if;

  -- leaving the technician pipeline cancels the live work order
  if p_to in ('rejected') then
    update public.work_orders set status = 'cancelled'
    where request_id = p_id and status in ('assigned', 'in_progress', 'awaiting_parts', 'submitted', 'returned');
    update public.appointments set status = 'cancelled' where request_id = p_id and status = 'scheduled';
  end if;
  if p_to in ('awaiting_parts') then
    update public.work_orders set status = 'awaiting_parts'
    where request_id = p_id and status in ('assigned', 'in_progress', 'returned');
  end if;

  perform public._set_request_status(p_id, p_to, p_note);
end $$;

-- Staff: assign technician (and optionally schedule)
create or replace function public.assign_request(
  p_id uuid, p_technician uuid, p_instructions text default null,
  p_priority public.request_priority default null,
  p_starts timestamptz default null, p_ends timestamptz default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_status public.request_status; v_tech record; v_wo uuid; v_ref text;
begin
  if not public.is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  select status, ref_no into v_status, v_ref from public.maintenance_requests where id = p_id for update;
  if v_status is null then raise exception 'NOT_FOUND'; end if;
  if v_status in ('completed', 'rejected', 'pending_approval', 'in_progress') then
    raise exception 'CANNOT_ASSIGN_IN_STATUS: %', v_status using errcode = 'P0001';
  end if;
  if exists (select 1 from public.quotes where request_id = p_id and status = 'pending') then
    raise exception 'QUOTE_PENDING' using errcode = 'P0001';
  end if;

  select * into v_tech from public.technicians where id = p_technician and is_active;
  if v_tech.id is null then raise exception 'TECHNICIAN_NOT_FOUND'; end if;

  update public.work_orders set status = 'cancelled'
  where request_id = p_id and status in ('assigned', 'in_progress', 'awaiting_parts', 'submitted', 'returned');
  update public.appointments set status = 'cancelled' where request_id = p_id and status = 'scheduled';

  insert into public.work_orders (request_id, technician_id, contractor_id, assigned_by, instructions)
  values (p_id, v_tech.id, v_tech.contractor_id, auth.uid(), p_instructions)
  returning id into v_wo;

  if p_priority is not null then
    update public.maintenance_requests set priority = p_priority where id = p_id;
  end if;

  insert into public.activity_logs (request_id, action, note, meta)
  values (p_id, 'technician_assigned', p_instructions,
          jsonb_build_object('technician', v_tech.full_name, 'work_order_id', v_wo));

  perform public._set_request_status(p_id, 'assigned', null);
  perform public.notify_user(v_tech.profile_id, 'task_assigned', p_id, jsonb_build_object('ref_no', v_ref));

  if p_starts is not null then
    perform public.schedule_visit(p_id, p_starts, p_ends, null);
  end if;
  return v_wo;
end $$;

-- Staff: schedule / reschedule a visit
create or replace function public.schedule_visit(p_id uuid, p_starts timestamptz, p_ends timestamptz default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_status public.request_status; v_wo uuid; v_appt uuid; v_had boolean; v_ref text; v_payload jsonb;
begin
  if not public.is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_starts is null then raise exception 'START_REQUIRED'; end if;
  if p_ends is not null and p_ends <= p_starts then raise exception 'INVALID_RANGE'; end if;

  select status, ref_no into v_status, v_ref from public.maintenance_requests where id = p_id for update;
  select id into v_wo from public.work_orders
   where request_id = p_id and status in ('assigned', 'in_progress', 'awaiting_parts', 'returned') limit 1;
  if v_wo is null then raise exception 'NO_ACTIVE_WORK_ORDER' using errcode = 'P0001'; end if;

  update public.appointments set status = 'rescheduled' where request_id = p_id and status = 'scheduled';
  v_had := found;

  insert into public.appointments (request_id, work_order_id, starts_at, ends_at, note, created_by)
  values (p_id, v_wo, p_starts, coalesce(p_ends, p_starts + interval '2 hours'), p_note, auth.uid())
  returning id into v_appt;

  v_payload := jsonb_build_object('ref_no', v_ref, 'starts_at', p_starts);
  insert into public.activity_logs (request_id, action, note, meta)
  values (p_id, case when v_had then 'visit_rescheduled' else 'visit_scheduled' end, p_note, v_payload);

  if v_status in ('assigned', 'awaiting_parts', 'postponed') then
    perform public._set_request_status(p_id, 'scheduled', p_note);      -- owner gets visit_confirmed
  else
    perform public.notify_user(public.request_owner_profile(p_id),
      case when v_had then 'visit_rescheduled' else 'visit_confirmed' end, p_id, v_payload);
  end if;
  perform public.notify_user(public.request_technician_profile(p_id),
      case when v_had then 'visit_rescheduled' else 'visit_confirmed' end, p_id, v_payload);
  return v_appt;
end $$;

-- ---------------------------------------------------------------------
-- Technician actions
-- ---------------------------------------------------------------------
create or replace function public._my_work_order(p_wo uuid)
returns public.work_orders language plpgsql stable security definer set search_path = public as $$
declare v public.work_orders;
begin
  select * into v from public.work_orders where id = p_wo;
  if v.id is null or v.technician_id is distinct from public.my_technician_id() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return v;
end $$;

create or replace function public.tech_start_work(p_wo uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v public.work_orders; v_status public.request_status;
begin
  v := public._my_work_order(p_wo);
  if v.status not in ('assigned', 'returned', 'awaiting_parts') then
    raise exception 'CANNOT_START_IN_STATUS: %', v.status using errcode = 'P0001';
  end if;
  select status into v_status from public.maintenance_requests where id = v.request_id;
  if v_status in ('postponed', 'rejected', 'completed') then
    raise exception 'REQUEST_NOT_ACTIVE' using errcode = 'P0001';
  end if;
  update public.work_orders set status = 'in_progress', started_at = coalesce(started_at, now()) where id = p_wo;
  if v_status <> 'in_progress' then
    perform public._set_request_status(v.request_id, 'in_progress', null);
  end if;
end $$;

create or replace function public.tech_awaiting_parts(p_wo uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v public.work_orders;
begin
  v := public._my_work_order(p_wo);
  if v.status not in ('assigned', 'in_progress', 'returned') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if coalesce(btrim(p_note), '') = '' then raise exception 'NOTE_REQUIRED' using errcode = 'P0001'; end if;
  update public.work_orders set status = 'awaiting_parts' where id = p_wo;
  perform public._set_request_status(v.request_id, 'awaiting_parts', p_note);
end $$;

create or replace function public.tech_submit_work(p_wo uuid, p_notes text)
returns void language plpgsql security definer set search_path = public as $$
declare v public.work_orders;
begin
  v := public._my_work_order(p_wo);
  if v.status <> 'in_progress' then
    raise exception 'CANNOT_SUBMIT_IN_STATUS: %', v.status using errcode = 'P0001';
  end if;
  if coalesce(btrim(p_notes), '') = '' then raise exception 'NOTE_REQUIRED' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.attachments where work_order_id = p_wo and kind = 'after') then
    raise exception 'AFTER_PHOTO_REQUIRED' using errcode = 'P0001';
  end if;
  update public.work_orders set status = 'submitted', tech_notes = p_notes, submitted_at = now() where id = p_wo;
  perform public._set_request_status(v.request_id, 'pending_approval', p_notes);
end $$;

-- Staff: approve or return technician report
create or replace function public.review_work(p_wo uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v public.work_orders; v_ref text; v_tech_profile uuid;
begin
  if not public.is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into v from public.work_orders where id = p_wo for update;
  if v.status <> 'submitted' then raise exception 'NOT_SUBMITTED' using errcode = 'P0001'; end if;
  select ref_no into v_ref from public.maintenance_requests where id = v.request_id;
  select profile_id into v_tech_profile from public.technicians where id = v.technician_id;

  if p_approve then
    update public.work_orders set status = 'approved', reviewed_at = now(), review_note = p_note where id = p_wo;
    update public.appointments set status = 'done' where request_id = v.request_id and status = 'scheduled';
    perform public._set_request_status(v.request_id, 'completed', p_note);
    perform public.notify_user(v_tech_profile, 'work_approved', v.request_id, jsonb_build_object('ref_no', v_ref));
  else
    if coalesce(btrim(p_note), '') = '' then raise exception 'NOTE_REQUIRED' using errcode = 'P0001'; end if;
    update public.work_orders set status = 'returned', reviewed_at = now(), review_note = p_note where id = p_wo;
    perform public._set_request_status(v.request_id, 'in_progress', p_note);
    perform public.notify_user(v_tech_profile, 'work_returned', v.request_id,
                               jsonb_build_object('ref_no', v_ref, 'note', p_note));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Owner actions
-- ---------------------------------------------------------------------
create or replace function public.owner_rate_request(p_id uuid, p_score int, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v record;
begin
  select id, owner_id, status, ref_no into v from public.maintenance_requests where id = p_id;
  if v.id is null or v.owner_id is distinct from public.my_owner_id() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v.status <> 'completed' then raise exception 'NOT_COMPLETED' using errcode = 'P0001'; end if;
  if p_score not between 1 and 5 then raise exception 'INVALID_SCORE'; end if;

  insert into public.ratings (request_id, owner_id, score, comment)
  values (p_id, v.owner_id, p_score, nullif(btrim(p_comment), ''));
  insert into public.activity_logs (request_id, action, note, meta)
  values (p_id, 'rated', nullif(btrim(p_comment), ''), jsonb_build_object('score', p_score));
  perform public.notify_staff('rating_received', p_id, jsonb_build_object('ref_no', v.ref_no, 'score', p_score));
end $$;

create or replace function public.owner_reopen_request(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v record; v_window int;
begin
  select id, owner_id, status, completed_at into v from public.maintenance_requests where id = p_id for update;
  if v.id is null or v.owner_id is distinct from public.my_owner_id() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v.status <> 'completed' then raise exception 'NOT_COMPLETED' using errcode = 'P0001'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'NOTE_REQUIRED' using errcode = 'P0001'; end if;
  select reopen_window_days into v_window from public.company_settings where id = 1;
  if v.completed_at < now() - make_interval(days => v_window) then
    raise exception 'REOPEN_WINDOW_EXPIRED' using errcode = 'P0001';
  end if;
  perform public._set_request_status(p_id, 'reopened', p_reason);
end $$;

-- ---------------------------------------------------------------------
-- Quotes for out-of-warranty work
-- ---------------------------------------------------------------------
create or replace function public.create_quote(p_id uuid, p_amount numeric, p_description text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_q uuid; v_ref text;
begin
  if not public.is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select ref_no into v_ref from public.maintenance_requests where id = p_id;
  if v_ref is null then raise exception 'NOT_FOUND'; end if;
  update public.quotes set status = 'cancelled' where request_id = p_id and status = 'pending';
  insert into public.quotes (request_id, amount, description, created_by)
  values (p_id, p_amount, p_description, auth.uid()) returning id into v_q;
  insert into public.activity_logs (request_id, action, note, meta)
  values (p_id, 'quote_issued', p_description, jsonb_build_object('amount', p_amount));
  perform public.notify_user(public.request_owner_profile(p_id), 'quote_issued', p_id,
                             jsonb_build_object('ref_no', v_ref, 'amount', p_amount));
  return v_q;
end $$;

create or replace function public.respond_quote(p_quote uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_q public.quotes; v_r record;
begin
  select * into v_q from public.quotes where id = p_quote for update;
  select id, owner_id, status, ref_no into v_r from public.maintenance_requests where id = v_q.request_id;
  if v_r.id is null or v_r.owner_id is distinct from public.my_owner_id() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_q.status <> 'pending' then raise exception 'QUOTE_NOT_PENDING' using errcode = 'P0001'; end if;

  update public.quotes set status = case when p_approve then 'approved' else 'declined' end::public.quote_status,
                           responded_at = now()
  where id = p_quote;
  insert into public.activity_logs (request_id, action, meta)
  values (v_r.id, case when p_approve then 'quote_approved' else 'quote_declined' end,
          jsonb_build_object('amount', v_q.amount));

  if p_approve then
    update public.maintenance_requests set is_paid = true where id = v_r.id;
    if v_r.status in ('new', 'under_review', 'postponed') then
      perform public._set_request_status(v_r.id, 'approved', 'موافقة العميل على عرض السعر');
    end if;
  end if;
  perform public.notify_staff(case when p_approve then 'quote_approved' else 'quote_declined' end, v_r.id,
                              jsonb_build_object('ref_no', v_r.ref_no, 'amount', v_q.amount));
end $$;

-- ---------------------------------------------------------------------
-- Read model for tables / lists (RLS of the caller applies)
-- ---------------------------------------------------------------------
create or replace view public.request_overview with (security_invoker = true) as
select
  r.*,
  u.unit_number, u.floor, u.unit_type, u.image_url as unit_image_url,
  b.id as building_id, b.name as building_name,
  p.id as project_id, p.name_ar as project_name_ar, p.name_en as project_name_en,
  o.full_name as owner_name, o.phone as owner_phone,
  w.id as work_order_id, w.status as work_order_status, w.technician_id,
  t.full_name as technician_name, t.phone as technician_phone,
  a.starts_at as visit_at, a.ends_at as visit_ends_at,
  (r.due_at < now() and r.status not in ('completed', 'rejected')) as is_overdue,
  rt.score as rating_score
from public.maintenance_requests r
join public.units u           on u.id = r.unit_id
left join public.buildings b  on b.id = u.building_id
left join public.projects p   on p.id = b.project_id
left join public.owners o     on o.id = r.owner_id
left join lateral (
  select * from public.work_orders w
  where w.request_id = r.id and w.status <> 'cancelled'
  order by w.created_at desc limit 1) w on true
left join public.technicians t on t.id = w.technician_id
left join lateral (
  select * from public.appointments a
  where a.request_id = r.id and a.status in ('scheduled', 'done')
  order by a.created_at desc limit 1) a on true
left join public.ratings rt on rt.request_id = r.id;

-- ---------------------------------------------------------------------
-- Reports (staff only)
-- ---------------------------------------------------------------------
create or replace function public.report_summary(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb; v_to timestamptz := (p_to + 1)::timestamptz; v_from timestamptz := p_from::timestamptz;
begin
  if not public.is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  with r as (
    select * from public.maintenance_requests where created_at >= v_from and created_at < v_to
  ),
  open_r as (select * from r where status not in ('completed', 'rejected'))
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'kpis', jsonb_build_object(
      'units',            (select count(*) from public.units),
      'owners',           (select count(*) from public.owners),
      'total',            (select count(*) from r),
      'new',              (select count(*) from r where status = 'new'),
      'in_progress',      (select count(*) from open_r where status <> 'new'),
      'completed',        (select count(*) from r where status = 'completed'),
      'rejected',         (select count(*) from r where status = 'rejected'),
      'overdue',          (select count(*) from open_r where due_at < now()),
      'completion_rate',  (select round(100.0 * count(*) filter (where status = 'completed')
                                   / nullif(count(*) filter (where status <> 'rejected'), 0), 1) from r),
      'avg_response_hours',   (select round(avg(extract(epoch from first_response_at - created_at) / 3600)::numeric, 1) from r where first_response_at is not null),
      'avg_resolution_hours', (select round(avg(extract(epoch from completed_at - created_at) / 3600)::numeric, 1) from r where completed_at is not null),
      'avg_rating',       (select round(avg(score)::numeric, 2) from public.ratings x join r on r.id = x.request_id),
      'satisfaction_rate',(select round(100.0 * count(*) filter (where score >= 4) / nullif(count(*), 0), 1)
                             from public.ratings x join r on r.id = x.request_id),
      'parts_cost',       (select coalesce(sum(pt.quantity * pt.unit_cost), 0)
                             from public.work_order_parts pt join public.work_orders w on w.id = pt.work_order_id
                             join r on r.id = w.request_id),
      'quotes_approved',  (select coalesce(sum(q.amount), 0) from public.quotes q join r on r.id = q.request_id where q.status = 'approved')
    ),
    'by_status',   (select coalesce(jsonb_agg(jsonb_build_object('key', status, 'count', c) order by c desc), '[]')
                      from (select status, count(*) c from r group by status) s),
    'by_category', (select coalesce(jsonb_agg(jsonb_build_object('key', category, 'count', c) order by c desc), '[]')
                      from (select category, count(*) c from r group by category) s),
    'by_project',  (select coalesce(jsonb_agg(jsonb_build_object('key', name, 'count', c) order by c desc), '[]')
                      from (select p.name_ar as name, count(*) c from r
                            join public.units u on u.id = r.unit_id
                            join public.buildings b on b.id = u.building_id
                            join public.projects p on p.id = b.project_id
                            group by p.name_ar order by c desc limit 10) s),
    'by_priority', (select coalesce(jsonb_agg(jsonb_build_object('key', priority, 'count', c)), '[]')
                      from (select priority, count(*) c from r group by priority) s),
    'daily',       (select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'created', cr, 'completed', cp) order by d), '[]')
                      from (select d,
                                   (select count(*) from r where r.created_at::date = d::date) cr,
                                   (select count(*) from public.maintenance_requests m where m.completed_at::date = d::date) cp
                            from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') d) s),
    'technicians', (select coalesce(jsonb_agg(row_to_json(s) order by s.completed desc), '[]')
                      from (select t.id, t.full_name as name,
                                   count(w.id) as assigned,
                                   count(w.id) filter (where w.status = 'approved') as completed,
                                   count(w.id) filter (where w.status in ('assigned','in_progress','awaiting_parts','returned','submitted')) as open,
                                   round(avg(extract(epoch from w.submitted_at - w.created_at) / 3600)::numeric, 1) as avg_hours,
                                   round(avg(x.score)::numeric, 2) as avg_rating,
                                   coalesce(sum((select sum(pt.quantity * pt.unit_cost) from public.work_order_parts pt where pt.work_order_id = w.id)), 0) as parts_cost
                            from public.technicians t
                            left join public.work_orders w on w.technician_id = t.id and w.status <> 'cancelled'
                                 and w.request_id in (select id from r)
                            left join public.ratings x on x.request_id = w.request_id and w.status = 'approved'
                            group by t.id, t.full_name) s)
  ) into v;
  return v;
end $$;

-- ---------------------------------------------------------------------
-- Execute permissions: only the public API is callable by signed-in users
-- ---------------------------------------------------------------------
revoke execute on function
  public.notify_user(uuid, text, uuid, jsonb),
  public.notify_staff(text, uuid, jsonb),
  public._set_request_status(uuid, public.request_status, text),
  public._my_work_order(uuid),
  public.stamp_actor(),
  public.before_request_insert(), public.after_request_insert(),
  public.after_request_status_change(), public.after_request_field_change(),
  public.after_note_insert(), public.handle_new_auth_user()
from public, anon, authenticated;

revoke execute on function
  public.transition_request(uuid, public.request_status, text),
  public.assign_request(uuid, uuid, text, public.request_priority, timestamptz, timestamptz),
  public.schedule_visit(uuid, timestamptz, timestamptz, text),
  public.tech_start_work(uuid), public.tech_awaiting_parts(uuid, text), public.tech_submit_work(uuid, text),
  public.review_work(uuid, boolean, text),
  public.owner_rate_request(uuid, int, text), public.owner_reopen_request(uuid, text),
  public.create_quote(uuid, numeric, text), public.respond_quote(uuid, boolean),
  public.report_summary(date, date), public.evaluate_warranty(uuid, public.maintenance_category, date)
from public, anon;

grant execute on function
  public.transition_request(uuid, public.request_status, text),
  public.assign_request(uuid, uuid, text, public.request_priority, timestamptz, timestamptz),
  public.schedule_visit(uuid, timestamptz, timestamptz, text),
  public.tech_start_work(uuid), public.tech_awaiting_parts(uuid, text), public.tech_submit_work(uuid, text),
  public.review_work(uuid, boolean, text),
  public.owner_rate_request(uuid, int, text), public.owner_reopen_request(uuid, text),
  public.create_quote(uuid, numeric, text), public.respond_quote(uuid, boolean),
  public.report_summary(date, date), public.evaluate_warranty(uuid, public.maintenance_category, date)
to authenticated;
