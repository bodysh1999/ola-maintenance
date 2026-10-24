-- =====================================================================
--  حذف البيانات التجريبية فقط (@demo.example.com) — المشاريع الحقيقية والبيانات الفعلية تبقى
--  يشمل: الملاك التجريبيين ووحداتهم وبلاغاتهم، الموظفين (الحضور، الطلبات، العهد، الرواتب)،
--  العملاء المحتملين التجريبيين، والحسابات. شغّله قبل التشغيل الفعلي.
-- =====================================================================
do $$
declare
  demo_owners uuid[]; demo_profiles uuid[];
begin
  select coalesce(array_agg(id), '{}') into demo_owners from public.owners where email like '%@demo.example.com';
  select coalesce(array_agg(id), '{}') into demo_profiles from public.profiles where email like '%@demo.example.com';

  -- requests on demo-owned units (attachments, notes, work orders… cascade)
  delete from public.maintenance_requests where owner_id = any(demo_owners);
  -- demo units become available again (and lose their demo warranties)
  delete from public.warranties w using public.units u where w.unit_id = u.id and u.owner_id = any(demo_owners);
  update public.units set owner_id = null, sale_status = 'available', handover_date = null where owner_id = any(demo_owners);
  delete from public.units u
  where u.owner_id is null and u.building_id in (select id from public.buildings where name in ('المبنى الرئيسي', 'مبنى العرض'))
    and not exists (select 1 from public.maintenance_requests r where r.unit_id = u.id);
  delete from public.buildings b where b.name in ('المبنى الرئيسي', 'مبنى العرض') and not exists (select 1 from public.units u where u.building_id = b.id);

  -- demo HR: requests (custodies + expenses cascade), payroll lines, attendance, salaries cascade with the employee
  if to_regclass('public.employees') is not null then
    execute $q$delete from public.hr_requests where employee_id in (select id from public.employees where email like '%@demo.example.com')$q$;
    if to_regclass('public.payroll_adjustments') is not null then
      execute $q$delete from public.payroll_adjustments where employee_id in (select id from public.employees where email like '%@demo.example.com')$q$;
    end if;
    if to_regclass('public.approval_delegations') is not null then
      execute $q$delete from public.approval_delegations where delegator_id in (select id from public.employees where email like '%@demo.example.com')
                 or delegate_id in (select id from public.employees where email like '%@demo.example.com')$q$;
    end if;
    execute $q$update public.departments set manager_employee_id = null where manager_employee_id in (select id from public.employees where email like '%@demo.example.com')$q$;
    execute $q$update public.employees set manager_id = null where manager_id in (select id from public.employees where email like '%@demo.example.com')$q$;
    execute $q$delete from public.employees where email like '%@demo.example.com'$q$;
    if to_regclass('public.payroll_runs') is not null then
      execute $q$delete from public.payroll_runs r where not exists (select 1 from public.payroll_lines l where l.run_id = r.id)$q$;
    end if;
    execute $q$delete from public.departments d where not exists (select 1 from public.employees e where e.department_id = d.id)
               and not exists (select 1 from public.departments c where c.parent_id = d.id)
               and name in ('الإدارة العليا','خدمات ما بعد البيع','الصيانة وخدمات ما بعد البيع','المبيعات','المبيعات والتسويق','الموارد البشرية',
                            'الموارد البشرية والمالية','الموارد البشرية والشؤون الإدارية','المالية والمشتريات','تقنية المعلومات','المشاريع والتطوير العقاري')$q$;
    execute $q$delete from public.departments d where not exists (select 1 from public.employees e where e.department_id = d.id)
               and not exists (select 1 from public.departments c where c.parent_id = d.id) and name = 'الإدارة العليا'$q$;
    execute $q$delete from public.work_locations w where (name like '%(مثال)%' or name = 'المكتب الرئيسي — جدة')
               and not exists (select 1 from public.employees e where e.work_location_id = w.id)$q$;
  end if;
  if to_regclass('public.approval_chains') is not null then
    execute $q$update public.approval_chains set steps = '[{"kind":"manager"},{"kind":"hr"}]'::jsonb, max_amount = 50000$q$;
  end if;

  -- demo leads / job applications
  if to_regclass('public.leads') is not null then
    execute $q$delete from public.leads where email like '%@demo.example.com' or email like '%@example.com'
               or (email is null and assigned_to = any($1))$q$ using demo_profiles;
    execute $q$delete from public.job_applications where email like '%@demo.example.com'$q$;
  end if;

  delete from public.owners where id = any(demo_owners);
  delete from public.contractors where email like '%@demo.example.com';
  delete from auth.users where email like '%@demo.example.com';   -- cascades profiles, technicians, notifications
  raise notice 'تم حذف البيانات التجريبية';
end $$;
