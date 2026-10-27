import Link from 'next/link';
import { CalendarClock, FileText, Plus, ShoppingCart, Store } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n, requireRole } from '@/lib/session';
import { STAFF_ROLES } from '@/lib/hr';
import { fmtDate } from '@/lib/format';
import { fmt } from '@/lib/i18n';
import { PURCHASE_TONE, money, type ProcRole, type PurchaseRow } from '@/lib/procurement';
import { Badge, Card, EmptyState, PageHeader, buttonClass, cx } from '@/components/ui';

const TABS = ['todo', 'active', 'pending_approval', 'approved', 'purchased', 'all'] as const;
type Tab = (typeof TABS)[number];

export default async function ProcurementPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const [{ d, locale }, supabase, sp, me] = await Promise.all([getI18n(), createClient(), searchParams, requireRole([...STAFF_ROLES])]);
  const p = d.proc;
  const role = ((await supabase.rpc('proc_role')).data ?? null) as ProcRole;
  const tabs: Tab[] = role ? [...TABS] : ['active', 'purchased', 'all'];
  const tab: Tab = (tabs as string[]).includes(sp.t ?? '') ? (sp.t as Tab) : tabs[0];

  const base = () => supabase.from('purchase_overview').select('*', { count: 'exact' });
  const filter = (q: ReturnType<typeof base>, t: Tab) => {
    if (t === 'todo') {
      return role === 'admin' || role === 'approver'
        ? q.or(`status.eq.pending_approval,and(rep_id.eq.${me.id},status.in.(quoting,approved))`)
        : q.eq('rep_id', me.id).in('status', ['quoting', 'approved']);
    }
    if (t === 'active') return q.in('status', ['quoting', 'pending_approval', 'approved']);
    if (t === 'all') return q;
    return q.eq('status', t);
  };
  const [{ data }, ...counts] = await Promise.all([
    filter(base(), tab).order('created_at', { ascending: false }).limit(200),
    ...tabs.map((t) => filter(supabase.from('purchase_overview').select('id', { count: 'exact', head: true }) as ReturnType<typeof base>, t)),
  ]);
  const rows = (data ?? []) as PurchaseRow[];
  const count = Object.fromEntries(tabs.map((t, i) => [t, counts[i]?.count ?? 0])) as Record<Tab, number>;

  return (
    <div>
      <PageHeader
        title={p.title}
        subtitle={p.subtitle}
        actions={
          <div className="flex flex-wrap gap-2">
            {role && <Link href="/procurement/suppliers" className={buttonClass('outline')}><Store className="h-4 w-4" /> {p.suppliers}</Link>}
            <Link href="/procurement/new" className={buttonClass('primary')}><Plus className="h-4 w-4" /> {p.newCta}</Link>
          </div>
        }
      />

      <nav aria-label={p.status} className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {tabs.map((t) => {
          const active = t === tab;
          return (
            <Link key={t} href={t === tabs[0] ? '/procurement' : `/procurement?t=${t}`} aria-current={active ? 'page' : undefined}
              className={cx('inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-4 text-sm transition',
                active ? 'border-brand bg-brand text-white' : 'border-sand-200 bg-white text-ink/75 hover:border-sand-300 hover:text-ink')}>
              {p.tabs[t]}
              <span className={cx('rounded-full px-1.5 text-[11px] font-semibold tabular-nums', active ? 'bg-white/20 text-white' : 'bg-sand-100 text-ink/70')}>{count[t]}</span>
            </Link>
          );
        })}
      </nav>

      {!rows.length ? (
        <Card><EmptyState icon={<ShoppingCart className="h-6 w-6" />} title={p.empty}>{p.emptyHint}</EmptyState></Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => {
            const enough = r.quotes_count >= r.quotes_required;
            return (
              <Link key={r.id} href={`/procurement/${r.id}`}
                className="group grid gap-3 rounded-2xl border border-sand-200 bg-white p-4 transition hover:border-brand/30 hover:shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[13px] font-medium text-brand" dir="ltr">{r.ref_no}</span>
                    <Badge className={PURCHASE_TONE[r.status]}>{p.statuses[r.status]}</Badge>
                  </div>
                  <div className="mt-1 truncate font-medium text-ink group-hover:text-brand">{r.title}</div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-450">
                    <span>{p.requester}: {r.requester_name ?? '—'}</span>
                    <span>{p.rep}: {r.rep_name ?? '—'}</span>
                    {r.project_name && <span>{r.project_name}</span>}
                    {r.needed_by && <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{p.neededBy} {fmtDate(r.needed_by, locale)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:justify-end">
                  <div className="text-center">
                    <div className={cx('inline-flex items-center gap-1 text-sm font-semibold tabular-nums', enough ? 'text-emerald-700' : 'text-ink/80')}>
                      <FileText className="h-4 w-4" />{fmt(p.quotesOf, { n: r.quotes_count, m: r.quotes_required })}
                    </div>
                    <div className="text-[11px] text-stone-450">{p.quotes}</div>
                  </div>
                  <div className="min-w-[110px] text-end">
                    {r.chosen_amount != null ? (
                      <>
                        <div className="text-sm font-semibold tabular-nums" dir="ltr">{money(r.purchased_amount ?? r.chosen_amount)} <span className="text-xs font-normal text-stone-450">{d.common.sar}</span></div>
                        <div className="truncate text-[11px] text-emerald-700">{r.chosen_supplier}</div>
                      </>
                    ) : r.min_amount != null ? (
                      <>
                        <div className="text-sm font-semibold tabular-nums" dir="ltr">{money(r.min_amount)} <span className="text-xs font-normal text-stone-450">{d.common.sar}</span></div>
                        <div className="text-[11px] text-stone-450">{p.lowest}</div>
                      </>
                    ) : <span className="text-sm text-stone-400">—</span>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
