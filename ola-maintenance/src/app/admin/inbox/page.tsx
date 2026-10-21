import Link from 'next/link';
import { CalendarClock, Inbox, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { fmtRelative, fmtVisit } from '@/lib/format';
import type { RequestOverview } from '@/lib/types';
import { Card, EmptyState, PageHeader, cx } from '@/components/ui';
import { OverdueBadge, PriorityBadge, StatusBadge, WarrantyBadge } from '@/components/badges';
import { CategoryIcon } from '@/components/category-icon';

const TABS = ['new', 'approval', 'unassigned', 'parts', 'overdue'] as const;
type Tab = (typeof TABS)[number];

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ d, locale }, supabase, sp] = await Promise.all([getI18n(), createClient(), searchParams]);
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? '') ? (sp.tab as Tab) : 'new';

  const base = () => supabase.from('request_overview').select('*', { count: 'exact' });
  const q = {
    new: () => base().in('status', ['new', 'under_review', 'reopened']),
    approval: () => base().eq('status', 'pending_approval'),
    unassigned: () => base().eq('status', 'approved'),
    parts: () => base().eq('status', 'awaiting_parts'),
    overdue: () => base().eq('is_overdue', true),
  };
  const counts = await Promise.all(TABS.map((t) => q[t]().limit(1).then((r) => r.count ?? 0)));
  const { data } = await q[tab]().order('priority', { ascending: false }).order('created_at', { ascending: true }).limit(100);
  const rows = (data ?? []) as RequestOverview[];
  const labels: Record<Tab, string> = {
    new: d.admin.inbox.newTab, approval: d.admin.inbox.approvalTab, unassigned: d.admin.inbox.unassignedTab,
    parts: d.admin.inbox.partsTab, overdue: d.admin.inbox.overdueTab,
  };

  return (
    <div>
      <PageHeader title={d.admin.inbox.title} />
      <div className="scrollbar-none -mx-4 mb-5 flex gap-2 overflow-x-auto px-4">
        {TABS.map((t, i) => (
          <Link key={t} href={`/admin/inbox?tab=${t}`}
            className={cx('inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition',
              tab === t ? 'border-brand bg-brand text-white' : 'border-sand-200 bg-white text-ink/70 hover:border-sand-300')}>
            {labels[t]}
            <span className={cx('rounded-full px-2 text-xs font-semibold', tab === t ? 'bg-white/15' : t === 'overdue' && counts[i] ? 'bg-rose-100 text-rose-700' : 'bg-sand-100')}>{counts[i]}</span>
          </Link>
        ))}
      </div>

      {!rows.length ? (
        <Card><EmptyState icon={<Inbox className="h-5 w-5" />} title={d.common.noData} /></Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((r) => (
            <Link key={r.id} href={`/admin/requests/${r.id}`} className="group rounded-2xl border border-sand-200 bg-white p-4 shadow-card transition hover:border-brand/30 hover:shadow-lift">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/[.07] text-brand"><CategoryIcon category={r.category} className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-brand" dir="ltr">{r.ref_no}</span>
                    <span className="font-semibold">{d.category[r.category]}</span>
                    <span className="text-xs text-stone-450">· {fmtRelative(r.created_at, locale)}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-ink/70">{r.location_in_unit} — {r.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-450">
                    <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{r.owner_name}</span>
                    <span>{r.project_name_ar} · {r.building_name} · {r.unit_number}</span>
                    {r.visit_at && <span className="inline-flex items-center gap-1 text-brand"><CalendarClock className="h-3.5 w-3.5" />{fmtVisit(r.visit_at, locale)}</span>}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-sand-100 pt-3">
                <StatusBadge status={r.status} d={d} />
                <PriorityBadge priority={r.priority} d={d} />
                <WarrantyBadge state={r.warranty_state} d={d} />
                {r.is_overdue && <OverdueBadge d={d} />}
                {r.technician_name && <span className="ms-auto text-xs text-stone-450">{r.technician_name}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
