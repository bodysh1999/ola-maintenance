import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Phone, Plus, Search, Store, Trophy } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { fmtDate } from '@/lib/format';
import { fmt } from '@/lib/i18n';
import { money } from '@/lib/procurement';
import { Card, EmptyState, Input, PageHeader, buttonClass, cx } from '@/components/ui';
import { SupplierForm } from '@/components/procurement-client';

type Row = { id: string; name: string; category: string | null; phone: string | null; is_active: boolean; quotes_count: number; wins: number; purchased_total: number; last_quote_at: string | null };

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ q?: string; add?: string }> }) {
  const [{ d, locale }, supabase, sp] = await Promise.all([getI18n(), createClient(), searchParams]);
  const p = d.proc;
  const { data: role } = await supabase.rpc('proc_role');
  if (!role) redirect('/procurement');
  let q = supabase.from('supplier_stats').select('id, name, category, phone, is_active, quotes_count, wins, purchased_total, last_quote_at');
  const term = (sp.q ?? '').replace(/[%,()*]/g, ' ').trim();
  if (term) q = q.or(`name.ilike.%${term}%,category.ilike.%${term}%,phone.ilike.%${term}%`);
  const { data } = await q.order('wins', { ascending: false }).order('name').limit(300);
  const rows = (data ?? []) as Row[];

  return (
    <div>
      <PageHeader
        eyebrow={<Link href="/procurement" className="hover:underline">{p.title}</Link>}
        title={p.suppliers}
        subtitle={fmt(p.supplierCount, { n: rows.length })}
      />

      <details open={sp.add === '1'} className="group mb-4 rounded-2xl border border-sand-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 font-medium text-brand [&::-webkit-details-marker]:hidden">
          <Plus className="h-4 w-4" />{p.addSupplier}
        </summary>
        <div className="border-t border-sand-100 p-5"><SupplierForm /></div>
      </details>

      <form className="relative mb-4">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
        <Input name="q" type="search" defaultValue={sp.q} placeholder={p.searchPh} aria-label={p.searchPh} className="ps-9" />
      </form>

      {!rows.length ? (
        <Card><EmptyState icon={<Store className="h-6 w-6" />} title={d.common.noData} /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-sand-200 bg-sand-50/70 text-xs text-stone-450">
                  <th className="px-4 py-3 text-start font-medium">{p.supName}</th>
                  <th className="px-4 py-3 text-start font-medium">{p.phone}</th>
                  <th className="px-4 py-3 text-center font-medium">{p.quotesCount}</th>
                  <th className="px-4 py-3 text-center font-medium">{p.wins}</th>
                  <th className="px-4 py-3 text-center font-medium">{p.winRate}</th>
                  <th className="px-4 py-3 text-end font-medium">{p.purchasedTotal}</th>
                  <th className="px-4 py-3 text-start font-medium">{p.lastQuote}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {rows.map((s) => (
                  <tr key={s.id} className={cx('transition hover:bg-sand-50', !s.is_active && 'opacity-60')}>
                    <td className="px-4 py-3">
                      <Link href={`/procurement/suppliers/${s.id}`} className="font-medium text-brand hover:underline">{s.name}</Link>
                      <div className="text-xs text-stone-450">{s.category ?? ''}{!s.is_active && ` · ${p.inactive}`}</div>
                    </td>
                    <td className="px-4 py-3 text-xs" dir="ltr">{s.phone ? <a href={`tel:${s.phone}`} className="inline-flex items-center gap-1 hover:underline"><Phone className="h-3 w-3" />{s.phone}</a> : '—'}</td>
                    <td className="px-4 py-3 text-center tabular-nums">{s.quotes_count}</td>
                    <td className="px-4 py-3 text-center tabular-nums">{s.wins > 0 ? <span className="inline-flex items-center gap-1 font-semibold text-emerald-700"><Trophy className="h-3.5 w-3.5" />{s.wins}</span> : 0}</td>
                    <td className="px-4 py-3 text-center tabular-nums">{s.quotes_count ? `${Math.round((s.wins / s.quotes_count) * 100)}%` : '—'}</td>
                    <td className="px-4 py-3 text-end tabular-nums" dir="ltr">{Number(s.purchased_total) ? `${money(s.purchased_total)}` : '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs">{s.last_quote_at ? fmtDate(s.last_quote_at, locale) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <div className="mt-4"><Link href="/procurement/new" className={buttonClass('ghost', 'sm')}>{p.newCta}</Link></div>
    </div>
  );
}
