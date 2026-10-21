import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { getMyEmployee } from '@/lib/me';
import { hoursBetween, timeRiyadh } from '@/lib/hr';
import { Card, PageHeader, cx } from '@/components/ui';

type Row = { work_date: string; check_in_at: string | null; check_out_at: string | null; source: string; in_distance_m: number | null };

export default async function MyAttendance({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const [{ m: monthParam }, { d, locale }, me, supabase] = await Promise.all([searchParams, getI18n(), getMyEmployee(), createClient()]);
  const a = d.me.att;
  const month = /^\d{4}-\d{2}$/.test(monthParam ?? '') ? monthParam! : new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' }).slice(0, 7);
  const [y, mo] = month.split('-').map(Number);
  const first = `${month}-01`;
  const last = new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
  const { data } = me ? await supabase.from('attendance').select('work_date, check_in_at, check_out_at, source, in_distance_m')
    .eq('employee_id', me.id).gte('work_date', first).lte('work_date', last).order('work_date') : { data: [] };
  const byDate = new Map(((data ?? []) as Row[]).map((r) => [r.work_date, r]));
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
  const days: string[] = [];
  for (let i = 1; i <= Number(last.slice(8)); i++) { const ds = `${month}-${String(i).padStart(2, '0')}`; if (ds <= today) days.push(ds); }
  const shift = (n: number) => { const dt = new Date(Date.UTC(y, mo - 1 + n, 1)); return dt.toISOString().slice(0, 7); };
  const total = [...byDate.values()].reduce((s, r) => s + (hoursBetween(r.check_in_at, r.check_out_at) ?? 0), 0);
  const lateAfter = me?.work_start?.slice(0, 5) ?? '08:00';

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={a.title} subtitle={`${byDate.size} / ${days.length} · ${total.toFixed(1)} ${d.common.hours}`}
        actions={<div className="flex items-center gap-2 text-sm">
          <Link href={`?m=${shift(-1)}`} className="rounded-lg border border-sand-200 bg-white px-3 py-1.5">‹</Link>
          <span className="font-medium" dir="ltr">{month}</span>
          <Link href={`?m=${shift(1)}`} className="rounded-lg border border-sand-200 bg-white px-3 py-1.5">›</Link>
        </div>} />
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand-50/70 text-xs text-stone-450">
            <tr>{[a.date, a.in, a.out, a.hours, a.source].map((h) => <th key={h} className="px-4 py-2.5 text-start font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-sand-100">
            {days.reverse().map((ds) => {
              const r = byDate.get(ds);
              const dow = new Date(ds + 'T12:00:00Z').getUTCDay();
              const weekend = dow === 5 || dow === 6;
              const late = r?.check_in_at && timeRiyadh(r.check_in_at) > lateAfter;
              return (
                <tr key={ds} className={cx(weekend && !r && 'text-stone-400')}>
                  <td className="px-4 py-2.5">{new Date(ds + 'T12:00:00Z').toLocaleDateString(locale === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                  <td className={cx('px-4 py-2.5', late && 'text-amber-700')} dir="ltr">{r ? timeRiyadh(r.check_in_at) : '—'}{late ? ` · ${a.late}` : ''}</td>
                  <td className="px-4 py-2.5" dir="ltr">{r ? timeRiyadh(r.check_out_at) : '—'}</td>
                  <td className="px-4 py-2.5">{r ? (hoursBetween(r.check_in_at, r.check_out_at)?.toFixed(1) ?? '—') : weekend || ds === today ? '' : <span className="text-rose-600">{a.absent}</span>}</td>
                  <td className="px-4 py-2.5 text-stone-450">{r ? a.sources[r.source as keyof typeof a.sources] : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <p className="mt-3 text-xs text-stone-450"><Link href="/me/requests/new?type=attendance_correction" className="text-brand hover:underline">{d.me.types.attendance_correction}</Link></p>
    </div>
  );
}
