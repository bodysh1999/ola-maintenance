import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { hoursBetween, timeRiyadh } from '@/lib/hr';
import { Badge, Card, CardHeader, Input, PageHeader, buttonClass } from '@/components/ui';
import { fmtDate } from '@/lib/format';
import { ExportExcelButton } from '@/components/export-button';

type A = { employee_id: string; check_in_at: string | null; check_out_at: string | null; source: string; in_distance_m: number | null; work_locations: { name: string } | null };

export default async function HrAttendance({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const [{ d, locale }, supabase, sp] = await Promise.all([getI18n(), createClient(), searchParams]);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? '') ? sp.date! : today;
  const [{ data: emps }, { data: att }, { data: away }, { data: alerts }] = await Promise.all([
    supabase.from('employees').select('id, full_name, job_title, work_start, departments!employees_department_id_fkey(name)').eq('status', 'active').order('full_name'),
    supabase.from('attendance').select('employee_id, check_in_at, check_out_at, source, in_distance_m, work_locations(name)').eq('work_date', date),
    supabase.from('hr_requests').select('employee_id, type, leave_types(name_ar)').eq('status', 'approved').in('type', ['leave', 'business_trip']).lte('start_date', date).gte('end_date', date),
    supabase.from('attendance_alerts').select('id, kind, period_key, detail, created_at, employees(full_name)').order('created_at', { ascending: false }).limit(30),
  ]);
  const byEmp = new Map(((att ?? []) as unknown as A[]).map((a) => [a.employee_id, a]));
  const awayBy = new Map((away ?? []).map((x) => [x.employee_id, x as unknown as { type: string; leave_types: { name_ar: string } | null }]));
  const a = d.me.att; const h = d.hrm;
  const rows = (emps ?? []).map((e) => {
    const r = byEmp.get(e.id); const aw = awayBy.get(e.id);
    const status = r ? 'present' : aw ? 'away' : 'absent';
    return { e, r, aw, status, late: !!r?.check_in_at && timeRiyadh(r.check_in_at) > String(e.work_start).slice(0, 5) };
  });
  return (
    <div>
      <PageHeader title={h.attendance}
        subtitle={`${h.present}: ${rows.filter((x) => x.status === 'present').length} · ${h.onLeave}: ${rows.filter((x) => x.status === 'away').length} · ${h.absent}: ${rows.filter((x) => x.status === 'absent').length}`}
        actions={<ExportExcelButton filename={`attendance-${date}`} sheets={[{ name: date, rows: rows.map(({ e, r, status }) => ({
          [d.common.name]: e.full_name, [d.me.info.jobTitle]: e.job_title, [a.in]: r ? timeRiyadh(r.check_in_at) : '', [a.out]: r ? timeRiyadh(r.check_out_at) : '',
          [a.hours]: r ? (hoursBetween(r.check_in_at, r.check_out_at)?.toFixed(2) ?? '') : '', [d.common.status]: status === 'present' ? h.present : status === 'away' ? h.onLeave : h.absent,
        })) }]} />} />
      <Card className="mb-4 p-4">
        <form className="flex flex-wrap items-center gap-3">
          <Input type="date" name="date" defaultValue={date} max={today} className="w-auto" />
          <button className={buttonClass('primary')}>{d.common.apply}</button>
          <Link href="/hr/attendance" className="text-sm text-brand hover:underline">{d.common.today}</Link>
        </form>
      </Card>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-sand-50/70 text-xs text-stone-450">
              <tr>{[d.common.name, d.me.info.department, a.in, a.out, a.hours, a.source, d.common.status].map((x) => <th key={x} className="px-4 py-3 text-start font-medium">{x}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {rows.map(({ e, r, aw, status, late }) => (
                <tr key={e.id}>
                  <td className="px-4 py-3"><Link href={`/hr/employees/${e.id}`} className="font-medium text-brand hover:underline">{e.full_name}</Link><div className="text-xs text-stone-450">{e.job_title}</div></td>
                  <td className="px-4 py-3">{(e.departments as unknown as { name: string } | null)?.name ?? '—'}</td>
                  <td className={late ? 'px-4 py-3 text-amber-700' : 'px-4 py-3'} dir="ltr">{r ? timeRiyadh(r.check_in_at) : '—'}</td>
                  <td className="px-4 py-3" dir="ltr">{r ? timeRiyadh(r.check_out_at) : '—'}</td>
                  <td className="px-4 py-3">{r ? (hoursBetween(r.check_in_at, r.check_out_at)?.toFixed(1) ?? '—') : '—'}</td>
                  <td className="px-4 py-3 text-xs text-stone-450">{r ? `${a.sources[r.source as keyof typeof a.sources]}${r.in_distance_m != null ? ` · ${r.in_distance_m}m` : ''}` : ''}</td>
                  <td className="px-4 py-3">
                    {status === 'present' ? <Badge className="bg-emerald-50 text-emerald-800 ring-emerald-200">{h.present}{late ? ` · ${a.late}` : ''}</Badge>
                      : status === 'away' ? <Badge className="bg-sky-50 text-sky-800 ring-sky-200">{aw?.type === 'business_trip' ? d.me.types.business_trip : aw?.leave_types?.name_ar ?? h.onLeave}</Badge>
                        : <Badge className="bg-rose-50 text-rose-800 ring-rose-200">{h.absent}</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader title={d.hrops.alerts} />
        {(alerts ?? []).length ? (
          <ul className="divide-y divide-sand-100">
            {((alerts ?? []) as unknown as { id: string; kind: string; detail: { count?: number }; created_at: string; employees: { full_name: string } | null }[]).map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span className="font-medium">{x.employees?.full_name}</span>
                <span className="flex items-center gap-3 text-xs">
                  <Badge className={x.kind === 'absent_no_request' ? 'bg-rose-50 text-rose-800 ring-rose-200' : 'bg-amber-50 text-amber-800 ring-amber-200'}>
                    {x.kind === 'absent_no_request' ? d.hrops.absent : d.hrops.late.replace('{n}', String(x.detail?.count ?? ''))}
                  </Badge>
                  <span className="text-stone-450">{fmtDate(x.created_at, locale)}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="px-5 py-6 text-sm text-stone-450">{d.hrops.noAlerts}</p>}
      </Card>
    </div>
  );
}
