import { ClipboardList } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { getMyEmployee } from '@/lib/me';
import { Card, EmptyState, LinkButton, PageHeader } from '@/components/ui';
import { RequestList, type HrRequestRow } from '@/components/hr-parts';

export default async function MyRequests() {
  const [{ d, locale }, me, supabase] = await Promise.all([getI18n(), getMyEmployee(), createClient()]);
  const { data } = me ? await supabase.from('hr_requests')
    .select('id, ref_no, type, status, leave_type, start_date, end_date, days, work_date, hours, amount, created_at, leave_types(name_ar, name_en)')
    .eq('employee_id', me.id).order('created_at', { ascending: false }).limit(200) : { data: [] };
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={d.me.myRequests} actions={<LinkButton href="/me/requests/new">{d.me.quick}</LinkButton>} />
      <Card>{data?.length ? <RequestList rows={data as unknown as HrRequestRow[]} d={d} locale={locale} /> : <EmptyState icon={<ClipboardList className="h-5 w-5" />} title={d.me.noRequests} />}</Card>
    </div>
  );
}
