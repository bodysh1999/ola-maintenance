import Link from 'next/link';
import { AlarmClock, Building2, CheckCircle2, ClipboardList, Gauge, Hourglass, Inbox, Star, Timer, Users, Wrench } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n, requireRole } from '@/lib/session';
import { getReport } from '@/lib/report';
import { fmtNum, todayRiyadh } from '@/lib/format';
import type { RequestOverview } from '@/lib/types';
import { Card, CardHeader, PageHeader, StatCard } from '@/components/ui';
import { CategoryBars, DailyArea, StatusDonut } from '@/components/charts';
import { RequestsTable } from '@/components/requests-table';
import { OverdueBadge, StatusBadge } from '@/components/badges';

export default async function AdminDashboard() {
  const profile = await requireRole(['admin', 'supervisor']);
  const [{ d, locale }, supabase] = await Promise.all([getI18n(), createClient()]);
  const from = todayRiyadh(-29);
  const to = todayRiyadh();
  const [report, recent, action] = await Promise.all([
    getReport(from, to),
    supabase.from('request_overview').select('*').order('created_at', { ascending: false }).limit(8),
    supabase.from('request_overview').select('*')
      .or('status.in.(new,pending_approval,reopened),is_overdue.eq.true')
      .order('created_at', { ascending: true }).limit(6),
  ]);
  const k = report?.kpis;
  const h = d.common.hours;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={d.admin.last30} title={`${d.owner.hello}، ${profile.full_name.split(' ')[0]}`} subtitle={d.admin.welcome} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard tone="brand" label={d.admin.kpi.total} value={fmtNum(k?.total)} icon={<ClipboardList className="h-4 w-4" />} />
        <StatCard label={d.admin.kpi.new} value={fmtNum(k?.new)} icon={<Inbox className="h-4 w-4" />} />
        <StatCard label={d.admin.kpi.inProgress} value={fmtNum(k?.in_progress)} icon={<Wrench className="h-4 w-4" />} />
        <StatCard tone="good" label={d.admin.kpi.completed} value={fmtNum(k?.completed)} icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard tone="warn" label={d.admin.kpi.overdue} value={fmtNum(k?.overdue)} icon={<AlarmClock className="h-4 w-4" />} />
        <StatCard label={d.admin.kpi.completionRate} value={k?.completion_rate != null ? `${fmtNum(k.completion_rate, 1)}%` : '—'} icon={<Gauge className="h-4 w-4" />} />
        <StatCard label={d.admin.kpi.avgResponse} value={k?.avg_response_hours != null ? fmtNum(k.avg_response_hours, 1) : '—'} hint={h} icon={<Timer className="h-4 w-4" />} />
        <StatCard label={d.admin.kpi.avgResolution} value={k?.avg_resolution_hours != null ? fmtNum(k.avg_resolution_hours, 1) : '—'} hint={h} icon={<Hourglass className="h-4 w-4" />} />
        <StatCard label={d.admin.kpi.units} value={fmtNum(k?.units)} icon={<Building2 className="h-4 w-4" />} />
        <StatCard label={d.admin.kpi.owners} value={fmtNum(k?.owners)} hint={k?.avg_rating ? `★ ${fmtNum(k.avg_rating, 1)} · ${d.admin.kpi.satisfaction} ${fmtNum(k.satisfaction_rate, 0)}%` : undefined} icon={<Users className="h-4 w-4" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title={d.admin.daily} subtitle={d.admin.last30} />
          <div className="p-4"><DailyArea data={report?.daily ?? []} /></div>
        </Card>
        <Card>
          <CardHeader title={d.admin.byStatus} />
          <div className="p-5"><StatusDonut data={report?.by_status ?? []} /></div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
        <Card>
          <CardHeader title={d.admin.byCategory} />
          <div className="p-4"><CategoryBars data={report?.by_category ?? []} /></div>
        </Card>
        <Card>
          <CardHeader title={d.admin.needsAction} action={<Link href="/admin/inbox" className="text-sm text-brand hover:underline">{d.admin.viewAll}</Link>} />
          <ul className="divide-y divide-sand-100">
            {((action.data ?? []) as RequestOverview[]).map((r) => (
              <li key={r.id}>
                <Link href={`/admin/requests/${r.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-sand-50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-xs text-brand" dir="ltr">{r.ref_no}</span>
                      <span className="font-medium">{d.category[r.category]}</span>
                      <span className="truncate text-stone-450">· {r.owner_name}</span>
                    </div>
                    <p className="truncate text-xs text-stone-450">{r.project_name_ar} · {r.building_name} · {r.unit_number}</p>
                  </div>
                  {r.is_overdue && <OverdueBadge d={d} />}
                  <StatusBadge status={r.status} d={d} />
                </Link>
              </li>
            ))}
            {!action.data?.length && (
              <li className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-stone-450"><Star className="h-4 w-4 text-accent" />{d.common.noData}</li>
            )}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader title={d.admin.recent} action={<Link href="/admin/requests" className="text-sm text-brand hover:underline">{d.admin.viewAll}</Link>} />
        <RequestsTable rows={(recent.data ?? []) as RequestOverview[]} d={d} locale={locale} compact />
      </Card>
    </div>
  );
}
