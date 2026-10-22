import { createClient } from '@/lib/supabase/server';
import { getI18n, getSettings } from '@/lib/session';
import { getReport } from '@/lib/report';
import { fmtMoney, fmtNum, todayRiyadh } from '@/lib/format';
import type { RequestOverview } from '@/lib/types';
import { Alert, Card, CardHeader, Input, PageHeader, StatCard, buttonClass } from '@/components/ui';
import { CategoryBars, DailyArea, SimpleBars, StatusDonut } from '@/components/charts';
import { ExportExcelButton, PrintPdfButton } from '@/components/export-button';
import { RequestsTable, requestsToSheet } from '@/components/requests-table';

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const [{ d, locale }, sp, s, supabase] = await Promise.all([getI18n(), searchParams, getSettings(), createClient()]);
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const from = sp.from && iso.test(sp.from) ? sp.from : todayRiyadh(-89);
  const to = sp.to && iso.test(sp.to) ? sp.to : todayRiyadh();
  const [report, overdue] = await Promise.all([
    getReport(from, to),
    supabase.from('request_overview').select('*').eq('is_overdue', true).order('due_at').limit(50),
  ]);
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
        </form>
      </Card>

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
                {[d.common.name, rp.assigned, rp.done, rp.open, rp.avgHours, rp.rating, rp.partsCost].map((h) => <th key={h} className="px-5 py-2.5 text-start font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {report.technicians.map((t) => (
                <tr key={t.id}>
                  <td className="px-5 py-3 font-medium">{t.name}</td>
                  <td className="px-5 py-3 tabular-nums">{t.assigned}</td>
                  <td className="px-5 py-3 tabular-nums">{t.completed}</td>
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
        <CardHeader title={rp.overdueList} subtitle={`${overdue.data?.length ?? 0}`} />
        <RequestsTable rows={(overdue.data ?? []) as RequestOverview[]} d={d} locale={locale} compact />
      </Card>
    </div>
  );
}
