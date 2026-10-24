import { Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { getMyEmployee } from '@/lib/me';
import { Card, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { RequestList, type HrRequestRow } from '@/components/hr-parts';
import { CustodyCards, type CustodyRow } from '@/components/custody-view';
import { CustodyRequestForm } from '@/components/custody-client';

export default async function MyCustody() {
  const [{ d, locale }, supabase, me] = await Promise.all([getI18n(), createClient(), getMyEmployee()]);
  const t = d.custody;
  if (!me) return <Card className="mx-auto max-w-xl"><EmptyState icon={<Wallet className="h-5 w-5" />} title={d.me.noFile} /></Card>;
  const [{ data: list }, { data: pending }, { data: chain }] = await Promise.all([
    supabase.from('custody_summary').select('*').eq('employee_id', me.id).order('issued_at', { ascending: false }),
    supabase.from('hr_requests').select('id, ref_no, type, status, leave_type, start_date, end_date, days, work_date, hours, amount, created_at')
      .eq('employee_id', me.id).eq('type', 'custody').in('status', ['pending', 'rejected']).order('created_at', { ascending: false }).limit(10),
    supabase.from('approval_chains').select('max_amount').eq('type', 'custody').maybeSingle(),
  ]);
  const rows = (list ?? []) as CustodyRow[];
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title={t.title} subtitle={t.sub} />
      {rows.length > 0 ? <CustodyCards rows={rows} d={d} locale={locale} base="/me/custody" /> : <Card><EmptyState icon={<Wallet className="h-5 w-5" />} title={t.noCustody} /></Card>}
      {(pending ?? []).length > 0 && (
        <Card><CardHeader title={t.pendingReq} /><RequestList rows={(pending ?? []) as HrRequestRow[]} d={d} locale={locale} /></Card>
      )}
      <Card>
        <CardHeader title={t.request} />
        <div className="p-5"><CustodyRequestForm max={Number(chain?.max_amount ?? 50000)} /></div>
      </Card>
    </div>
  );
}
