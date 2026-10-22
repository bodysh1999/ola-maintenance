-- =====================================================================
--  إصلاح: بلاغ يعلق في "بانتظار اعتماد الإنجاز"
--  السبب: كان مسموح للإدارة تحويل البلاغ يدويًا من "جاري التنفيذ" إلى "بانتظار اعتماد الإنجاز"
--         بدون تقرير من الفني، فما يطلع زر الاعتماد ولا فيه انتقال يطلّعه من الحالة.
--  الحل: • "بانتظار اعتماد الإنجاز" تصير فقط لما الفني يرسل تقريره
--        • البلاغ العالق يقدر المشرف: يغلقه "مكتمل" أو يرجّعه "جاري التنفيذ"
--  شغّله بعد ملف 12. آمن لإعادة التشغيل.
-- =====================================================================

create or replace function public.status_transition_allowed(p_from public.request_status, p_to public.request_status)
returns boolean language sql immutable set search_path = public as $$
  select (p_from::text || '>' || p_to::text) = any (array[
    'new>under_review', 'new>approved', 'new>rejected', 'new>postponed',
    'under_review>approved', 'under_review>rejected', 'under_review>postponed',
    'approved>postponed', 'approved>rejected',
    'assigned>postponed', 'assigned>awaiting_parts',
    'scheduled>in_progress', 'scheduled>postponed', 'scheduled>awaiting_parts',
    'in_progress>awaiting_parts', 'in_progress>postponed',
    'pending_approval>completed', 'pending_approval>in_progress',
    'awaiting_parts>in_progress', 'awaiting_parts>postponed',
    'postponed>under_review', 'postponed>approved',
    'rejected>reopened', 'completed>reopened',
    'reopened>under_review', 'reopened>approved', 'reopened>rejected'
  ])
$$;

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
  -- a technician's report waiting for review goes through review_work (approve / return)
  if v_from = 'pending_approval' and exists (select 1 from public.work_orders where request_id = p_id and status = 'submitted') then
    raise exception 'USE_REVIEW' using errcode = 'P0001';
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
  -- closing a stuck request: the live work order is closed with it
  if p_to = 'completed' then
    update public.work_orders set status = 'approved', reviewed_at = now(), review_note = coalesce(nullif(btrim(p_note), ''), review_note)
    where request_id = p_id and status in ('assigned', 'in_progress', 'awaiting_parts', 'returned');
    update public.appointments set status = 'done' where request_id = p_id and status in ('scheduled', 'rescheduled');
  end if;

  perform public._set_request_status(p_id, p_to, p_note);
end $$;

-- requests already stuck: show what is left (nothing to change automatically)
select ref_no, status from public.maintenance_requests m
where status = 'pending_approval'
  and not exists (select 1 from public.work_orders w where w.request_id = m.id and w.status = 'submitted');
