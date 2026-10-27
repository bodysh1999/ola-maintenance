import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Trophy } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { fmtDate } from '@/lib/format';
import { fmt } from '@/lib/i18n';
import { PURCHASE_TONE, money, type PurchaseStatus } from '@/lib/procurement';
import { Badge, Card, CardHeader, PageHeader, StatCard } from '@/components/ui';
import { SupplierForm, type SupplierInit } from '@/components/procurement-client';

type Hist = { id: string; quote_no: number; amount: number; created_at: string;
  purchase_requests: { id: string; ref_no: string; title: string; status: PurchaseStatus; chosen_quote_id: string | null } | null };

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ d, locale }, supabase, { id }] = await Promise.all([getI18n(), createClient(), params]);
  const p = d.proc;
  const { data: role } = await supabase.rpc('proc_role');
  if (!role) redirect('/procurement');
  const [{ data: s }, { data: hist }] = await Promise.all([
    supabase.from('supplier_stats').select('*').eq('id', id).maybeSingle(),
    supabase.from('purchase_quotes').select('id, quote_no, amount, created_at, purchase_requests(id, ref_no, title, status, chosen_quote_id)').eq('supplier_id', id).order('created_at', { ascending: false }).limit(100),
  ]);
  if (!s) notFound();
  const rows = (hist ?? []) as unknown as Hist[];
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow={<Link href="/procurement/suppliers" className="hover:underline">{p.suppliers}</Link>} title={s.name} subtitle={s.category ?? undefined} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={p.quotesCount} value={s.quotes_count} />
        <StatCard tone="good" label={p.wins} value={s.wins} icon={<Trophy className="h-4 w-4" />} />
        <StatCard label={p.winRate} value={s.quotes_count ? `${Math.round((s.wins / s.quotes_count) * 100)}%` : '—'} />
        <StatCard tone="brand" label={p.purchasedTotal} value={money(s.purchased_total)} hint={d.common.sar} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader title={p.history} />
          {rows.length ? (
            <ul className="divide-y divide-sand-100 px-5 pb-3">
              {rows.map((h) => {
                const won = h.purchase_requests?.chosen_quote_id === h.id;
                return (
                  <li key={h.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0">
                      <Link href={`/procurement/${h.purchase_requests?.id}`} className="font-medium text-brand hover:underline">{h.purchase_requests?.title}</Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-stone-450">
                        <span className="font-mono" dir="ltr">{h.purchase_requests?.ref_no}</span>
                        <span>{fmt(p.quoteNo, { n: h.quote_no })}</span>
                        <span>{fmtDate(h.created_at, locale)}</span>
                        {h.purchase_requests && <Badge className={PURCHASE_TONE[h.purchase_requests.status]}>{p.statuses[h.purchase_requests.status]}</Badge>}
                      </div>
                    </div>
                    <div className="shrink-0 text-end">
                      <div className="font-semibold tabular-nums" dir="ltr">{money(h.amount)}</div>
                      {won && <div className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><Trophy className="h-3 w-3" />{p.chosen}</div>}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : <p className="px-5 pb-6 text-sm text-stone-450">{p.noHistory}</p>}
        </Card>
        <Card className="p-5"><SupplierForm init={s as SupplierInit} /></Card>
      </div>
    </div>
  );
}
