-- =====================================================================
-- 27) Tighter scope for personal HR records
--   can_view_employee() lets staff see their own managers (name / title in the org chart).
--   Attendance, attendance alerts and custodies must only be visible downwards:
--   HR, the employee themself, and managers above them — never to their subordinates.
-- =====================================================================
create or replace function public.can_supervise_employee(p_emp uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_hr()
      or p_emp = public.my_employee_id()
      or exists (select 1 from public.manager_chain(p_emp) c where c.manager_id = public.my_employee_id())
$$;
revoke all on function public.can_supervise_employee(uuid) from public, anon;
grant execute on function public.can_supervise_employee(uuid) to authenticated;

drop policy if exists attendance_read on public.attendance;
create policy attendance_read on public.attendance for select to authenticated using (public.can_supervise_employee(employee_id));

drop policy if exists att_alerts_read on public.attendance_alerts;
create policy att_alerts_read on public.attendance_alerts for select to authenticated
  using (public.is_hr() or (public.can_supervise_employee(employee_id)
         and employee_id <> coalesce(public.my_employee_id(), '00000000-0000-0000-0000-000000000000'::uuid)));

drop policy if exists custodies_read on public.custodies;
create policy custodies_read on public.custodies for select to authenticated using (public.can_supervise_employee(employee_id));
drop policy if exists custody_expenses_read on public.custody_expenses;
create policy custody_expenses_read on public.custody_expenses for select to authenticated
  using (exists (select 1 from public.custodies c where c.id = custody_id and public.can_supervise_employee(c.employee_id)));

drop policy if exists "hr-docs read" on storage.objects;
create policy "hr-docs read" on storage.objects for select to authenticated
  using (bucket_id = 'hr-docs' and (
    public.is_hr() or split_part(name, '/', 1) = public.my_employee_id()::text
    or exists (select 1 from public.hr_requests r where r.attachment_path = name and public.can_view_hr_request(r.id))
    or exists (select 1 from public.custody_expenses x join public.custodies c on c.id = x.custody_id
               where x.attachment_path = name and public.can_supervise_employee(c.employee_id))));
