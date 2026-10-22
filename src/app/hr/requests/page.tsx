import { ClipboardList } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { HR_REQUEST_TYPES } from '@/lib/hr';
import { Card, EmptyState, PageHeader, Select, buttonClass } from '@/components/ui';
import { RequestList, type HrRequestRow } from '@/components/hr-parts';

export default async function HrRequests({ searchParams }: { searchParams: Promise<{ type?: string; status?: string; emp?: string }> }) {
  const [{ d, locale }, supabase, sp] = await Promise.all([getI18n(), createClient(), searchParams]);
  let q = supabase.from('hr_requests')
    .select('id, ref_no, type, status, leave_type, start_date, end_date, days, work_date, hours, amount, created_at, leave_types(name_ar, name_en), employee:employees!hr_requests_employee_id_fkey(full_name)')
    .order('created_at', { ascending: false }).limit(300);
  if (sp.type && (HR_REQUEST_TYPES as readonly string[]).includes(sp.type)) q = q.eq('type', sp.type);
  if (sp.status && ['pending', 'approved', 'rejected', 'cancelled'].includes(sp.status)) q = q.eq('status', sp.status);
  if (sp.emp) q = q.eq('employee_id', sp.emp);
  const [{ data }, { data: emps }] = await Promise.all([q, supabase.from('employees').select('id, full_name').order('full_name')]);
  const rows = ((data ?? []) as unknown as (HrRequestRow & { employee: { full_name: string } | null })[]).map((r) => ({ ...r, employee_name: r.employee?.full_name }));
  const h = d.hrm;
  return (
    <div>
      <PageHeader title={h.requests} subtitle={`${rows.length}`} />
      <Card className="mb-4 p-4">
        <form className="grid gap-3 sm:grid-cols-4">
          <Select name="type" defaultValue={sp.type ?? ''}><option value="">{h.filters.all}</option>{HR_REQUEST_TYPES.map((t) => <option key={t} value={t}>{d.me.types[t]}</option>)}</Select>
          <Select name="status" defaultValue={sp.status ?? ''}><option value="">{h.filters.allStatuses}</option>{(['pending', 'approved', 'rejected', 'cancelled'] as const).map((s) => <option key={s} value={s}>{d.me.status[s]}</option>)}</Select>
          <Select name="emp" defaultValue={sp.emp ?? ''}><option value="">{h.filters.employee}: {d.common.all}</option>{(emps ?? []).map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}</Select>
          <button className={buttonClass('primary')}>{d.common.apply}</button>
        </form>
      </Card>
      <Card>{rows.length ? <RequestList rows={rows} d={d} locale={locale} showEmployee /> : <EmptyState icon={<ClipboardList className="h-5 w-5" />} title={d.me.noRequests} />}</Card>
    </div>
  );
}
