import Link from 'next/link';
import { Settings2, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { sar } from '@/lib/hr';
import { Card, CardHeader, EmptyState, PageHeader, StatCard, buttonClass } from '@/components/ui';
import { CustodyCards, type CustodyRow } from '@/components/custody-view';
import { ApprovalChainEditor } from '@/components/custody-client';

export default async function HrCustody({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const [{ d, locale }, supabase, sp] = await Promise.all([getI18n(), createClient(), searchParams]);
  const t = d.custody;
  let q = supabase.from('custody_summary').select('*').order('issued_at', { ascending: false }).limit(200);
  if (sp.s !== 'all') q = q.neq('status', 'closed');
  const [{ data }, { data: chain }, { data: people }] = await Promise.all([
    q,
    supabase.from('approval_chains').select('steps, max_amount').eq('type', 'custody').maybeSingle(),
    supabase.from('employees').select('id, full_name, job_title').eq('status', 'active').order('full_name'),
  ]);
  const rows = (data ?? []) as CustodyRow[];
  const open = rows.filter((c) => c.status !== 'closed');
  return (
    <div className="space-y-6">
      <PageHeader title={t.hrTitle} subtitle={t.hrSub}
        actions={<div className="flex gap-2">
          <Link href="/hr/custody" className={buttonClass(sp.s !== 'all' ? 'primary' : 'outline', 'sm')}>{t.open}</Link>
          <Link href="/hr/custody?s=all" className={buttonClass(sp.s === 'all' ? 'primary' : 'outline', 'sm')}>{t.all}</Link>
        </div>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t.open} value={open.length} icon={<Wallet className="h-5 w-5" />} tone="brand" />
        <StatCard label={t.amount} value={sar(open.reduce((a, c) => a + Number(c.amount), 0))} />
        <StatCard label={t.remaining} value={sar(open.reduce((a, c) => a + Number(c.remaining), 0))} />
        <StatCard label={t.reviewQueue} value={open.reduce((a, c) => a + Number(c.pending_count), 0)} tone="warn" />
      </div>
      {rows.length ? <CustodyCards rows={rows} d={d} locale={locale} base="/hr/custody" /> : <Card><EmptyState icon={<Wallet className="h-5 w-5" />} title={t.noCustody} /></Card>}
      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-brand" />{t.chainTitle}</span>} subtitle={t.chainSub} />
        <div className="p-5">
          <ApprovalChainEditor initial={(chain?.steps ?? []) as { kind: string; employee_id?: string; min_amount?: number | null }[]}
            max={Number(chain?.max_amount ?? 50000)} people={people ?? []} />
        </div>
      </Card>
    </div>
  );
}
