import Link from 'next/link';
import { Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { ALL_STATUSES, CATEGORIES, PRIORITIES } from '@/lib/constants';
import type { RequestOverview } from '@/lib/types';
import { Card, Input, PageHeader, Select, buttonClass } from '@/components/ui';
import { RequestsTable, requestsToSheet } from '@/components/requests-table';
import { ExportExcelButton } from '@/components/export-button';

type SP = { q?: string; status?: string; category?: string; priority?: string; project?: string; overdue?: string; from?: string; to?: string; page?: string };
const PAGE = 50;

export default async function RequestsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const [{ d, locale }, supabase, sp] = await Promise.all([getI18n(), createClient(), searchParams]);
  const page = Math.max(1, Number(sp.page) || 1);

  let query = supabase.from('request_overview').select('*', { count: 'exact' });
  if (sp.q) {
    const term = sp.q.replace(/[%,()*]/g, ' ').trim();
    if (term) query = query.or(`ref_no.ilike.%${term}%,owner_name.ilike.%${term}%,description.ilike.%${term}%,unit_number.ilike.%${term}%`);
  }
  if (sp.status && (ALL_STATUSES as string[]).includes(sp.status)) query = query.eq('status', sp.status);
  if (sp.category && (CATEGORIES as string[]).includes(sp.category)) query = query.eq('category', sp.category);
  if (sp.priority && (PRIORITIES as string[]).includes(sp.priority)) query = query.eq('priority', sp.priority);
  if (sp.project) query = query.eq('project_id', sp.project);
  if (sp.overdue === '1') query = query.eq('is_overdue', true);
  if (sp.from) query = query.gte('created_at', `${sp.from}T00:00:00+03:00`);
  if (sp.to) query = query.lte('created_at', `${sp.to}T23:59:59+03:00`);

  const [{ data, count }, { data: projects }] = await Promise.all([
    query.order('created_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1),
    supabase.from('projects').select('id, name_ar, name_en').order('name_ar'),
  ]);
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

      <Card className="mb-4 p-4">
        <form className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          <div className="relative md:col-span-2 xl:col-span-2">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input name="q" defaultValue={sp.q} placeholder={d.admin.filters.search} className="ps-9" />
          </div>
          <Select name="status" defaultValue={sp.status ?? ''}>
            <option value="">{d.common.status}: {d.common.all}</option>
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{d.status[s]}</option>)}
          </Select>
          <Select name="category" defaultValue={sp.category ?? ''}>
            <option value="">{d.common.category}: {d.common.all}</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{d.category[c]}</option>)}
          </Select>
          <Select name="priority" defaultValue={sp.priority ?? ''}>
            <option value="">{d.common.priority}: {d.common.all}</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{d.priority[p]}</option>)}
          </Select>
          <Select name="project" defaultValue={sp.project ?? ''}>
            <option value="">{d.admin.table.project}: {d.common.all}</option>
            {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{locale === 'en' && p.name_en ? p.name_en : p.name_ar}</option>)}
          </Select>
          <Input type="date" name="from" defaultValue={sp.from} aria-label={d.common.from} />
          <Input type="date" name="to" defaultValue={sp.to} aria-label={d.common.to} />
          <label className="flex items-center gap-2 text-sm md:col-span-2 xl:col-span-2">
            <input type="checkbox" name="overdue" value="1" defaultChecked={sp.overdue === '1'} className="h-4 w-4 rounded border-sand-300 text-brand focus:ring-brand" />
            {d.admin.filters.onlyOverdue}
          </label>
          <div className="flex gap-2 md:col-span-2 xl:col-span-6 xl:justify-end">
            <Link href="/admin/requests" className={buttonClass('ghost')}>{d.common.reset}</Link>
            <button className={buttonClass('primary')}>{d.common.apply}</button>
          </div>
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
