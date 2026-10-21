-- =====================================================================
--  حذف البيانات التجريبية فقط (@demo.example.com) — المشاريع الحقيقية والبيانات الفعلية تبقى
-- =====================================================================
do $$
declare
  demo_owners uuid[];
begin
  select coalesce(array_agg(id), '{}') into demo_owners from public.owners where email like '%@demo.example.com';

  -- requests on demo-owned units (attachments, notes, work orders… cascade)
  delete from public.maintenance_requests where owner_id = any(demo_owners);
  -- demo units become available again (and lose their demo warranties)
  delete from public.warranties w using public.units u where w.unit_id = u.id and u.owner_id = any(demo_owners);
  update public.units set owner_id = null where owner_id = any(demo_owners);
  -- remove units/buildings created only for the demo when nothing real is attached to them
  delete from public.units u
  where u.owner_id is null and u.building_id in (select id from public.buildings where name = 'المبنى الرئيسي')
    and not exists (select 1 from public.maintenance_requests r where r.unit_id = u.id);
  delete from public.buildings b where b.name = 'المبنى الرئيسي' and not exists (select 1 from public.units u where u.building_id = b.id);

  -- demo leads / job applications (tables exist after migration 7)
  if to_regclass('public.leads') is not null then
    execute $q$delete from public.leads where email like '%@demo.example.com'$q$;
    execute $q$delete from public.job_applications where email like '%@demo.example.com'$q$;
  end if;

  delete from public.owners where id = any(demo_owners);
  delete from public.contractors where email like '%@demo.example.com';
  delete from auth.users where email like '%@demo.example.com';   -- cascades profiles, technicians, notifications
  raise notice 'تم حذف البيانات التجريبية';
end $$;
