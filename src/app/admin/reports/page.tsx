import { createClient } from '@/lib/supabase/server';
import { getI18n, getSettings } from '@/lib/session';
import { getReport } from '@/lib/report';
import { fmtMoney, fmtNum, todayRiyadh } from '@/lib/format';
import type { RequestOverview } from '@/lib/types';
import { Alert, Card, CardHeader, Input, PageHeader, StatCard, buttonClass } from '@/components/ui';
import { CategoryBars, DailyArea, SimpleBars, StatusDonut } from '@/components/charts';
import { ExportExcelButton, PrintPdfButton } from '@/components/export-button';
import { RequestsTable, requestsToSheet } from '@/components/requests-table';
import Link from 'next/link';

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const span = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1;
type ProjCost = { project_id: string; project: string; requests: number; completed: number; overdue: number; parts_cost: number; quotes_approved: number; avg_resolution_hours: number | null };

function Delta({ cur, prev, goodWhenUp = true, suffix = '' }: { cur: number | null; prev: number | null; goodWhenUp?: boolean; suffix?: string }) {
  if (cur == null || prev == null) return <span className="text-stone-400">—</span>;
  const diff = cur - prev;
  if (!prev && !cur) return <span className="text-stone-400">0</span>;
  const pct = prev ? Math.round((diff / Math.abs(prev)) * 100) : null;
  const good = diff === 0 ? null : (diff > 0) === goodWhenUp;
  return (
    <span className={good == null ? 'text-stone-450' : good ? 'text-emerald-700' : 'text-rose-700'}>
      {diff > 0 ? '▲' : diff < 0 ? '▼' : '='} {pct != null ? `${Math.abs(pct)}%` : `${Math.abs(Math.round(diff * 10) / 10)}${suffix}`}
    </span>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const [{ d, locale }, sp, s, supabase] = await Promise.all([getI18n(), searchParams, getSettings(), createClient()]);
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const from = sp.from && iso.test(sp.from) ? sp.from : todayRiyadh(-89);
  const to = sp.to && iso.test(sp.to) ? sp.to : todayRiyadh();
  // comparison: the previous period of the same length
  const len = Math.max(1, span(from, to));
  const prevTo = addDays(from, -1), prevFrom = addDays(from, -len);
  const [report, overdue, prevReport, { data: costs }] = await Promise.all([
    getReport(from, to),
    supabase.from('request_overview').select('*').eq('is_overdue', true).order('due_at').limit(50),
    getReport(prevFrom, prevTo),
    supabase.rpc('report_project_costs', { p_from: from, p_to: to }),
  ]);
  const projCosts = (costs ?? []) as ProjCost[];
  const today = todayRiyadh();
  const thisMonth = today.slice(0, 8) + '01';
  const lastMonthEnd = addDays(thisMonth, -1);
  const presets = [
    { label: d.reports2.thisMonth, from: thisMonth, to: today },
    { label: d.reports2.lastMonth, from: lastMonthEnd.slice(0, 8) + '01', to: lastMonthEnd },
    { label: d.reports2.last90, from: todayRiyadh(-89), to: today },
    { label: d.reports2.thisYear, from: today.slice(0, 4) + '-01-01', to: today },
  ];
  const rp = d.admin.reports;
  if (!report) return <Alert tone="error">{d.common.errorGeneric}</Alert>;
  const k = report.kpis;

  const sheets = [
    { name: 'KPIs', rows: [
      { [d.common.from]: from, [d.common.to]: to },
      ...Object.entries({
        [d.admin.kpi.total]: k.total, [d.admin.kpi.new]: k.new, [d.admin.kpi.inProgress]: k.in_progress, [d.admin.kpi.completed]: k.completed,
        [d.admin.kpi.overdue]: k.overdue, [d.admin.kpi.completionRate]: k.completion_rate, [d.admin.kpi.avgResponse]: k.avg_response_hours,
        [d.admin.kpi.avgResolution]: k.avg_resolution_hours, [d.admin.kpi.avgRating]: k.avg_rating, [d.admin.kpi.satisfaction]: k.satisfaction_rate,
        [d.admin.kpi.partsCost]: k.parts_cost, [rp.quotes]: k.quotes_approved,
      }).map(([key, v]) => ({ [d.common.name]: key, [rp.count]: v ?? '' } as Record<string, string | number | null>)),
    ] },
    { name: d.common.category, rows: report.by_category.map((x) => ({ [d.common.category]: d.category[x.key], [rp.count]: x.count })) },
    { name: d.common.status, rows: report.by_status.map((x) => ({ [d.common.status]: d.status[x.key], [rp.count]: x.count })) },
    { name: d.admin.byProject.slice(0, 31), rows: report.by_project.map((x) => ({ [d.admin.table.project]: x.key, [rp.count]: x.count })) },
    { name: rp.techPerf.slice(0, 31), rows: report.technicians.map((t) => ({
      [d.common.name]: t.name, [rp.assigned]: t.assigned, [rp.done]: t.completed, [rp.open]: t.open,
      [rp.avgHours]: t.avg_hours, [rp.rating]: t.avg_rating, [rp.partsCost]: t.parts_cost,
    })) },
    { name: rp.overdueList.slice(0, 31), rows: requestsToSheet((overdue.data ?? []) as RequestOverview[], d, locale) },
    { name: d.reports2.projectCosts.slice(0, 31), rows: projCosts.map((x) => ({
      [d.admin.table.project]: x.project, [rp.count]: x.requests, [rp.done]: x.completed, [d.admin.kpi.overdue]: x.overdue,
      [rp.partsCost]: Number(x.parts_cost), [rp.quotes]: Number(x.quotes_approved), [d.reports2.totalCost]: Number(x.parts_cost) + Number(x.quotes_approved),
      [rp.avgHours]: x.avg_resolution_hours ?? '',
    })) },
    ...(prevReport ? [{ name: d.reports2.compare.slice(0, 31), rows: [
      { '': '', [d.reports2.current]: `${from} → ${to}`, [d.reports2.previous]: `${prevFrom} → ${prevTo}` },
      { '': d.admin.kpi.total, [d.reports2.current]: k.total, [d.reports2.previous]: prevReport.kpis.total },
      { '': d.admin.kpi.completed, [d.reports2.current]: k.completed, [d.reports2.previous]: prevReport.kpis.completed },
      { '': d.admin.kpi.overdue, [d.reports2.current]: k.overdue, [d.reports2.previous]: prevReport.kpis.overdue },
      { '': d.admin.kpi.avgResolution, [d.reports2.current]: k.avg_resolution_hours, [d.reports2.previous]: prevReport.kpis.avg_resolution_hours },
      { '': d.admin.kpi.partsCost, [d.reports2.current]: k.parts_cost, [d.reports2.previous]: prevReport.kpis.parts_cost },
    ] as Record<string, string | number | null>[] }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="hidden print:block">
        <h1 className="text-xl font-semibold">{locale === 'ar' ? s.name_ar : s.name_en} — {rp.title}</h1>
        <p className="text-sm">{from} → {to}</p>
      </div>
      <PageHeader
        title={rp.title}
        subtitle={`${from} → ${to}`}
        actions={<div className="no-print flex gap-2"><ExportExcelButton filename={`report-${from}-${to}`} sheets={sheets} /><PrintPdfButton /></div>}
      />

      <Card className="no-print p-4">
        <form className="flex flex-wrap items-end gap-3">
          <label className="text-sm"><span className="mb-1 block text-xs text-stone-450">{d.common.from}</span><Input type="date" name="from" defaultValue={from} /></label>
          <label className="text-sm"><span className="mb-1 block text-xs text-stone-450">{d.common.to}</span><Input type="date" name="to" defaultValue={to} /></label>
          <button className={buttonClass('primary')}>{d.common.apply}</button>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Link key={p.label} href={`?from=${p.from}&to=${p.to}`}
                className={buttonClass(p.from === from && p.to === to ? 'primary' : 'outline', 'sm')}>{p.label}</Link>
            ))}
          </div>
        </form>
      </Card>

      {prevReport && (
        <Card className="print-break overflow-hidden">
          <CardHeader title={d.reports2.compare} subtitle={`${from} → ${to} · ${d.reports2.vs} ${prevFrom} → ${prevTo}`} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-sand-50/70 text-xs text-stone-450">
                <tr>{['', d.reports2.current, d.reports2.previous, d.reports2.change].map((h) => <th key={h} className="px-5 py-2.5 text-start font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {([
                  [d.admin.kpi.total, k.total, prevReport.kpis.total, false, fmtNum],
                  [d.admin.kpi.completed, k.completed, prevReport.kpis.completed, true, fmtNum],
                  [d.admin.kpi.completionRate, k.completion_rate, prevReport.kpis.completion_rate, true, (v: number | null) => (v == null ? '—' : `${fmtNum(v, 1)}%`)],
                  [d.admin.kpi.overdue, k.overdue, prevReport.kpis.overdue, false, fmtNum],
                  [d.admin.kpi.avgResponse, k.avg_response_hours, prevReport.kpis.avg_response_hours, false, (v: number | null) => fmtNum(v, 1)],
                  [d.admin.kpi.avgResolution, k.avg_resolution_hours, prevReport.kpis.avg_resolution_hours, false, (v: number | null) => fmtNum(v, 1)],
                  [d.admin.kpi.satisfaction, k.satisfaction_rate, prevReport.kpis.satisfaction_rate, true, (v: number | null) => (v == null ? '—' : `${fmtNum(v)}%`)],
                  [d.admin.kpi.partsCost, k.parts_cost, prevReport.kpis.parts_cost, false, (v: number | null) => fmtMoney(v ?? 0, locale)],
                ] as [string, number | null, number | null, boolean, (v: number | null) => string][]).map(([label, cur, prev, up, f]) => (
                  <tr key={label}>
                    <td className="px-5 py-3 font-medium">{label}</td>
                    <td className="px-5 py-3 tabular-nums">{f(cur)}</td>
                    <td className="px-5 py-3 tabular-nums text-stone-450">{f(prev)}</td>
                    <td className="px-5 py-3 tabular-nums"><Delta cur={cur} prev={prev} goodWhenUp={up} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard tone="brand" label={d.admin.kpi.total} value={fmtNum(k.total)} />
        <StatCard label={d.admin.kpi.completionRate} value={k.completion_rate != null ? `${fmtNum(k.completion_rate, 1)}%` : '—'} />
        <StatCard label={d.admin.kpi.avgResponse} value={fmtNum(k.avg_response_hours, 1)} hint={`${d.common.hours} · SLA ${s.response_sla_hours}`} />
        <StatCard label={d.admin.kpi.avgResolution} value={fmtNum(k.avg_resolution_hours, 1)} hint={`${d.common.hours} · SLA ${s.resolution_sla_hours}`} />
        <StatCard tone="warn" label={d.admin.kpi.overdue} value={fmtNum(k.overdue)} />
        <StatCard tone="good" label={d.admin.kpi.satisfaction} value={k.satisfaction_rate != null ? `${fmtNum(k.satisfaction_rate)}%` : '—'} hint={k.avg_rating ? `★ ${fmtNum(k.avg_rating, 2)} / 5` : undefined} />
        <StatCard label={d.admin.kpi.partsCost} value={fmtMoney(k.parts_cost, locale)} />
        <StatCard label={rp.quotes} value={fmtMoney(k.quotes_approved, locale)} />
      </div>

      <Card className="print-break">
        <CardHeader title={d.admin.daily} />
        <div className="p-4"><DailyArea data={report.daily} /></div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="print-break"><CardHeader title={d.admin.byCategory} /><div className="p-4"><CategoryBars data={report.by_category} /></div></Card>
        <Card className="print-break"><CardHeader title={d.admin.byStatus} /><div className="p-5"><StatusDonut data={report.by_status} /></div></Card>
      </div>

      <Card className="print-break"><CardHeader title={d.admin.byProject} /><div className="p-4"><SimpleBars data={report.by_project} /></div></Card>

      <Card className="print-break overflow-hidden">
        <CardHeader title={rp.techPerf} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-sand-50/70 text-xs text-stone-450">
              <tr>
                {[d.common.name, rp.assigned, rp.done, d.reports2.prevDone, rp.open, rp.avgHours, rp.rating, rp.partsCost].map((h) => <th key={h} className="px-5 py-2.5 text-start font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {report.technicians.map((t) => (
                <tr key={t.id}>
                  <td className="px-5 py-3 font-medium">{t.name}</td>
                  <td className="px-5 py-3 tabular-nums">{t.assigned}</td>
                  <td className="px-5 py-3 tabular-nums">{t.completed}</td>
                  <td className="px-5 py-3 tabular-nums text-stone-450">
                    {(() => { const p = prevReport?.technicians.find((x) => x.id === t.id); return p ? <>{p.completed} <Delta cur={t.completed} prev={p.completed} /></> : '—'; })()}
                  </td>
                  <td className="px-5 py-3 tabular-nums">{t.open}</td>
                  <td className="px-5 py-3 tabular-nums">{fmtNum(t.avg_hours, 1)}</td>
                  <td className="px-5 py-3 tabular-nums">{t.avg_rating ? `★ ${fmtNum(t.avg_rating, 1)}` : '—'}</td>
                  <td className="px-5 py-3 tabular-nums">{fmtMoney(t.parts_cost, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="print-break overflow-hidden">
        <CardHeader title={d.reports2.projectCosts} subtitle={`${from} → ${to}`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-sand-50/70 text-xs text-stone-450">
              <tr>{[d.admin.table.project, rp.count, rp.done, d.admin.kpi.overdue, rp.partsCost, rp.quotes, d.reports2.totalCost, rp.avgHours].map((h) => <th key={h} className="px-5 py-2.5 text-start font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {!projCosts.length && <tr><td colSpan={8} className="px-5 py-6 text-stone-450">{d.common.noData}</td></tr>}
              {projCosts.map((x) => (
                <tr key={x.project_id}>
                  <td className="px-5 py-3 font-medium">{x.project}</td>
                  <td className="px-5 py-3 tabular-nums">{x.requests}</td>
                  <td className="px-5 py-3 tabular-nums">{x.completed}</td>
                  <td className="px-5 py-3 tabular-nums">{x.overdue}</td>
                  <td className="px-5 py-3 tabular-nums">{fmtMoney(Number(x.parts_cost), locale)}</td>
                  <td className="px-5 py-3 tabular-nums">{fmtMoney(Number(x.quotes_approved), locale)}</td>
                  <td className="px-5 py-3 font-semibold tabular-nums">{fmtMoney(Number(x.parts_cost) + Number(x.quotes_approved), locale)}</td>
                  <td className="px-5 py-3 tabular-nums">{fmtNum(x.avg_resolution_hours, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="print-break overflow-hidden">
        <CardHeader title={rp.overdueList} subtitle={`${overdue.data?.length ?? 0}`} />
        <RequestsTable rows={(overdue.data ?? []) as RequestOverview[]} d={d} locale={locale} compact />
      </Card>
    </div>
  );
}
