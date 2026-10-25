import Link from 'next/link';
import { Search, SlidersHorizontal } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { ALL_STATUSES, CATEGORIES, OPEN_STATUSES, PRIORITIES } from '@/lib/constants';
import type { RequestOverview } from '@/lib/types';
import { Card, Input, PageHeader, Select, buttonClass, cx } from '@/components/ui';
import { RequestsTable, requestsToSheet } from '@/components/requests-table';
import { ExportExcelButton } from '@/components/export-button';

type SP = { view?: string; q?: string; status?: string; category?: string; priority?: string; project?: string; overdue?: string; tech?: string; waiting?: string; esc?: string; from?: string; to?: string; page?: string };
const PAGE = 50;
const VIEWS = ['all', 'open', 'new', 'overdue', 'escalated', 'completed'] as const;
type View = (typeof VIEWS)[number];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyView<Q extends { in: any; eq: any; gt: any }>(q: Q, v: View): Q {
  if (v === 'open') return q.in('status', OPEN_STATUSES);
  if (v === 'new') return q.in('status', ['new', 'reopened']);
  if (v === 'overdue') return q.eq('is_overdue', true);
  if (v === 'escalated') return q.gt('escalation_level', 0);
  if (v === 'completed') return q.eq('status', 'completed');
  return q;
}

export default async function RequestsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const [{ d, locale }, supabase, sp] = await Promise.all([getI18n(), createClient(), searchParams]);
  const page = Math.max(1, Number(sp.page) || 1);

  const view: View = (VIEWS as readonly string[]).includes(sp.view ?? '') ? (sp.view as View) : 'all';
  let query = applyView(supabase.from('request_overview').select('*', { count: 'exact' }), view);
  if (sp.q) {
    const term = sp.q.replace(/[%,()*]/g, ' ').trim();
    if (term) query = query.or(`ref_no.ilike.%${term}%,owner_name.ilike.%${term}%,owner_phone.ilike.%${term}%,technician_name.ilike.%${term}%,description.ilike.%${term}%,unit_number.ilike.%${term}%`);
  }
  if (sp.status && (ALL_STATUSES as string[]).includes(sp.status)) query = query.eq('status', sp.status);
  if (sp.category && (CATEGORIES as string[]).includes(sp.category)) query = query.eq('category', sp.category);
  if (sp.priority && (PRIORITIES as string[]).includes(sp.priority)) query = query.eq('priority', sp.priority);
  if (sp.project) query = query.eq('project_id', sp.project);
  if (sp.overdue === '1') query = query.eq('is_overdue', true);
  if (sp.tech) query = query.eq('technician_id', sp.tech);
  if (sp.waiting && ['owner', 'staff', 'tech'].includes(sp.waiting)) query = query.like('waiting_on', `${sp.waiting}%`);
  if (sp.esc === '1') query = query.gt('escalation_level', 0);
  if (sp.from) query = query.gte('created_at', `${sp.from}T00:00:00+03:00`);
  if (sp.to) query = query.lte('created_at', `${sp.to}T23:59:59+03:00`);

  const [{ data, count }, { data: projects }, { data: techs }, ...viewCounts] = await Promise.all([
    query.order('created_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1),
    supabase.from('projects').select('id, name_ar, name_en').order('name_ar'),
    supabase.from('technicians').select('id, full_name').eq('is_active', true).order('full_name'),
    ...VIEWS.map((v) => applyView(supabase.from('request_overview').select('id', { count: 'exact', head: true }), v)),
  ]);
  const counts = Object.fromEntries(VIEWS.map((v, i) => [v, viewCounts[i]?.count ?? 0])) as Record<View, number>;
  const advancedKeys = ['status', 'category', 'priority', 'project', 'tech', 'waiting', 'from', 'to', 'overdue', 'esc'] as const;
  const advancedActive = advancedKeys.filter((k) => sp[k]).length;
  const viewHref = (v: View) => {
    const u = new URLSearchParams(Object.entries(sp).filter(([k, val]) => val && k !== 'page' && k !== 'view') as [string, string][]);
    if (v !== 'all') u.set('view', v);
    const str = u.toString();
    return str ? `?${str}` : '/admin/requests';
  };
  const rows = (data ?? []) as RequestOverview[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const qs = (p: number) => {
    const u = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== 'page') as [string, string][]);
    u.set('page', String(p));
    return `?${u.toString()}`;
  };

  return (
    <div>
      <PageHeader
        title={d.nav.requests}
        subtitle={`${total} ${d.admin.filters.results}`}
        actions={<ExportExcelButton filename={`maintenance-requests-${new Date().toISOString().slice(0, 10)}`} sheets={[{ name: d.nav.requests, rows: requestsToSheet(rows, d, locale) }]} />}
      />

      <nav aria-label={d.common.status} className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {VIEWS.map((v) => {
          const active = v === view;
          return (
            <Link key={v} href={viewHref(v)} aria-current={active ? 'page' : undefined}
              className={cx('inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-4 text-sm transition',
                active ? 'border-brand bg-brand text-white' : 'border-sand-200 bg-white text-ink/75 hover:border-sand-300 hover:text-ink',
                !active && (v === 'overdue' || v === 'escalated') && counts[v] > 0 && 'text-rose-700')}>
              {d.ops.views[v]}
              <span className={cx('rounded-full px-1.5 text-[11px] font-semibold tabular-nums', active ? 'bg-white/20 text-white' : 'bg-sand-100 text-ink/70')}>{counts[v]}</span>
            </Link>
          );
        })}
      </nav>

      <Card className="mb-4 p-4">
        <form>
          {view !== 'all' && <input type="hidden" name="view" value={view} />}
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
              <Input name="q" type="search" defaultValue={sp.q} placeholder={d.ops.searchPh} aria-label={d.ops.searchPh} className="ps-9" />
            </div>
            <button className={buttonClass('primary')}>{d.common.apply}</button>
          </div>
          <details open={advancedActive > 0} className="group mt-3">
            <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg px-1 py-1 text-sm font-medium text-brand hover:text-brand/80 [&::-webkit-details-marker]:hidden">
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              {d.ops.advanced}
              {advancedActive > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">{advancedActive} {d.ops.activeFilters}</span>}
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Select name="status" defaultValue={sp.status ?? ''} aria-label={d.common.status}>
                <option value="">{d.common.status}: {d.common.all}</option>
                {ALL_STATUSES.map((s) => <option key={s} value={s}>{d.status[s]}</option>)}
              </Select>
              <Select name="category" defaultValue={sp.category ?? ''} aria-label={d.common.category}>
                <option value="">{d.common.category}: {d.common.all}</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{d.category[c]}</option>)}
              </Select>
              <Select name="priority" defaultValue={sp.priority ?? ''} aria-label={d.common.priority}>
                <option value="">{d.common.priority}: {d.common.all}</option>
                {PRIORITIES.map((p) => <option key={p} value={p}>{d.priority[p]}</option>)}
              </Select>
              <Select name="project" defaultValue={sp.project ?? ''} aria-label={d.admin.table.project}>
                <option value="">{d.admin.table.project}: {d.common.all}</option>
                {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{locale === 'en' && p.name_en ? p.name_en : p.name_ar}</option>)}
              </Select>
              <Select name="tech" defaultValue={sp.tech ?? ''} aria-label={d.ops.technician}>
                <option value="">{d.ops.technician}</option>
                {(techs ?? []).map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </Select>
              <Select name="waiting" defaultValue={sp.waiting ?? ''} aria-label={d.ops.waitingFilter}>
                <option value="">{d.ops.waitingFilter}</option>
                {(['staff', 'tech', 'owner'] as const).map((w) => <option key={w} value={w}>{d.ops.who[w]}</option>)}
              </Select>
              <label className="flex flex-col gap-1 text-xs text-stone-450">
                {d.ops.dateFrom}
                <Input type="date" name="from" defaultValue={sp.from} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-stone-450">
                {d.ops.dateTo}
                <Input type="date" name="to" defaultValue={sp.to} />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="overdue" value="1" defaultChecked={sp.overdue === '1'} className="h-4 w-4 rounded border-sand-300 text-brand focus:ring-brand" />
                {d.admin.filters.onlyOverdue}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="esc" value="1" defaultChecked={sp.esc === '1'} className="h-4 w-4 rounded border-sand-300 text-brand focus:ring-brand" />
                {d.ops.onlyEscalated}
              </label>
              <div className="flex gap-2 sm:col-span-2 sm:justify-end">
                <Link href="/admin/requests" className={buttonClass('ghost')}>{d.common.reset}</Link>
                <button className={buttonClass('primary')}>{d.common.apply}</button>
              </div>
            </div>
          </details>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <RequestsTable rows={rows} d={d} locale={locale} />
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-sand-100 px-4 py-3 text-sm">
            <span className="text-stone-450">{page} / {pages}</span>
            <div className="flex gap-2">
              {page > 1 && <Link href={qs(page - 1)} className={buttonClass('outline', 'sm')}>{d.newReq.prev}</Link>}
              {page < pages && <Link href={qs(page + 1)} className={buttonClass('outline', 'sm')}>{d.newReq.next}</Link>}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
