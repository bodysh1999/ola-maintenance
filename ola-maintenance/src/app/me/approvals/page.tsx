import { Inbox } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { RequestList, type HrRequestRow } from '@/components/hr-parts';

export default async function Approvals() {
  const [{ d, locale }, supabase] = await Promise.all([getI18n(), createClient()]);
  const { data } = await supabase.rpc('my_approval_queue');
  const rows = ((data ?? []) as (HrRequestRow & { employee_name: string })[]).map((r) => ({ ...r, status: 'pending' }));
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={d.me.approvals} subtitle={`${rows.length}`} />
      <Card>{rows.length ? <RequestList rows={rows} d={d} locale={locale} showEmployee /> : <EmptyState icon={<Inbox className="h-5 w-5" />} title={d.me.noApprovals} />}</Card>
    </div>
  );
}
