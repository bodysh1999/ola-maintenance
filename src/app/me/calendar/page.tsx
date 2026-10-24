import Link from 'next/link';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile, getI18n } from '@/lib/session';
import { fmtDate } from '@/lib/format';
import { Card, CardHeader, EmptyState, PageHeader, buttonClass, cx } from '@/components/ui';
import { DeleteHolidayButton, HolidayForm } from '@/components/hr-ops-client';

type Row = { request_id: string; employee_id: string; employee_name: string; department: string | null; type: string; leave_type: string | null;
  leave_name_ar: string | null; leave_name_en: string | null; start_date: string; end_date: string; status: string };
type Holiday = { id: string; name_ar: string; name_en: string | null; start_date: string; end_date: string };

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Month grid of team leave (what the viewer is allowed to see) + official holidays; HR manages the holidays here */
export default async function LeaveCalendar({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const [{ d, locale }, supabase, sp, profile] = await Promise.all([getI18n(), createClient(), searchParams, getCurrentProfile()]);
  const h = d.hrops;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
  const [ty, tm] = (/^\d{4}-\d{2}$/.test(sp.m ?? '') ? sp.m! : today.slice(0, 7)).split('-').map(Number);
  const days = new Date(ty, tm, 0).getDate();
  const from = iso(ty, tm, 1), to = iso(ty, tm, days);
  const prev = tm === 1 ? `${ty - 1}-12` : `${ty}-${String(tm - 1).padStart(2, '0')}`;
  const next = tm === 12 ? `${ty + 1}-01` : `${ty}-${String(tm + 1).padStart(2, '0')}`;
  const isHr = profile?.role === 'hr' || profile?.role === 'admin';

  const [{ data: leaves }, { data: hol }, { data: allHol }] = await Promise.all([
    supabase.rpc('leave_calendar', { p_from: from, p_to: to }),
    supabase.from('public_holidays').select('*').lte('start_date', to).gte('end_date', from),
    isHr ? supabase.from('public_holidays').select('*').gte('end_date', `${ty - 1}-01-01`).order('start_date') : Promise.resolve({ data: [] }),
  ]);
  const rows = (leaves ?? []) as Row[];
  const holidays = (hol ?? []) as Holiday[];
  const isHoliday = (day: string) => holidays.find((x) => day >= x.start_date && day <= x.end_date);
  const byEmp = new Map<string, { name: string; dept: string | null; items: Row[] }>();
  rows.forEach((r) => {
    const e = byEmp.get(r.employee_id) ?? { name: r.employee_name, dept: r.department, items: [] };
    e.items.push(r); byEmp.set(r.employee_id, e);
  });
  const dayList = Array.from({ length: days }, (_, i) => iso(ty, tm, i + 1));
  const monthName = new Date(ty, tm - 1, 15).toLocaleDateString(locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric' });
  const Prev = locale === 'ar' ? ChevronRight : ChevronLeft;
  const Next = locale === 'ar' ? ChevronLeft : ChevronRight;

  return (
    <div className="space-y-6">
      <PageHeader title={h.calendar} subtitle={h.calendarSub}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`?m=${prev}`} className={buttonClass('outline', 'sm')} aria-label="prev"><Prev className="h-4 w-4" /></Link>
            <span className="min-w-36 text-center text-sm font-semibold">{monthName}</span>
            <Link href={`?m=${next}`} className={buttonClass('outline', 'sm')} aria-label="next"><Next className="h-4 w-4" /></Link>
            <Link href="/me/calendar" className={buttonClass('ghost', 'sm')}>{h.today}</Link>
          </div>
        } />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap gap-4 border-b border-sand-100 px-5 py-3 text-xs text-stone-450">
          <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-emerald-500" />{h.approved}</span>
          <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-amber-300" />{h.pending}</span>
          <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-sky-500" />{h.trip}</span>
          <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-rose-100 ring-1 ring-rose-200" />{h.holidays}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] table-fixed border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky start-0 z-10 w-44 bg-white px-3 py-2 text-start font-medium text-stone-450" />
                {dayList.map((day, i) => {
                  const wd = new Date(`${day}T12:00:00`).getDay(); const weekend = wd === 5 || wd === 6;
                  return (
                    <th key={day} title={isHoliday(day)?.name_ar} className={cx('py-2 text-center font-medium', day === today ? 'bg-brand text-white' : isHoliday(day) ? 'bg-rose-50 text-rose-700' : weekend ? 'bg-sand-50 text-stone-400' : 'text-stone-450')}>
                      {i + 1}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {[...byEmp.entries()].map(([id, e]) => (
                <tr key={id}>
                  <td className="sticky start-0 z-10 truncate bg-white px-3 py-2">
                    <div className="truncate font-medium text-ink">{e.name}</div>
                    {e.dept && <div className="truncate text-[10px] text-stone-450">{e.dept}</div>}
                  </td>
                  {dayList.map((day) => {
                    const it = e.items.find((x) => day >= x.start_date && day <= x.end_date);
                    const hd = isHoliday(day);
                    const label = it ? `${it.type === 'business_trip' ? h.trip : (locale === 'en' ? it.leave_name_en : it.leave_name_ar) ?? ''} · ${fmtDate(it.start_date, locale)} — ${fmtDate(it.end_date, locale)}` : hd?.name_ar;
                    return (
                      <td key={day} title={label} className={cx('h-9 p-0.5', hd && 'bg-rose-50/60')}>
                        {it && (
                          <Link href={`/me/requests/${it.request_id}`} className={cx('block h-full rounded',
                            it.type === 'business_trip' ? 'bg-sky-500' : it.status === 'approved' ? 'bg-emerald-500' : 'bg-amber-300')} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!byEmp.size && <EmptyState icon={<CalendarDays className="h-5 w-5" />} title={h.noLeaves} />}
        {holidays.length > 0 && (
          <div className="border-t border-sand-100 px-5 py-3 text-xs text-rose-800">
            {holidays.map((x) => <span key={x.id} className="me-4">{locale === 'en' && x.name_en ? x.name_en : x.name_ar}: {fmtDate(x.start_date, locale)}{x.end_date !== x.start_date ? ` — ${fmtDate(x.end_date, locale)}` : ''}</span>)}
          </div>
        )}
      </Card>

      {isHr && (
        <Card>
          <CardHeader title={h.holidays} subtitle={h.holidayNote} />
          <div className="space-y-5 p-5">
            <ul className="divide-y divide-sand-100 rounded-xl border border-sand-100">
              {((allHol ?? []) as Holiday[]).map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                  <span className="font-medium">{x.name_ar}</span>
                  <span className="flex items-center gap-3 text-xs text-stone-450">
                    {fmtDate(x.start_date, locale)}{x.end_date !== x.start_date ? ` — ${fmtDate(x.end_date, locale)}` : ''}
                    <DeleteHolidayButton id={x.id} />
                  </span>
                </li>
              ))}
            </ul>
            <HolidayForm />
          </div>
        </Card>
      )}
    </div>
  );
}
