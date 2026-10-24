import Link from 'next/link';
import { Banknote, Settings2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n, getSettings } from '@/lib/session';
import { fmtDateTime } from '@/lib/format';
import { sar } from '@/lib/hr';
import { Badge, Card, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { GeneratePayrollForm, PayrollSettingsForm } from '@/components/payroll-client';
import { PAY_TONE } from '@/lib/hr';


export default async function PayrollList() {
  const [{ d, locale }, supabase, s] = await Promise.all([getI18n(), createClient(), getSettings()]);
  const p = d.payroll;
  const { data: runs } = await supabase.from('payroll_runs').select('*, payroll_lines(net, gross, total_deductions)').order('period', { ascending: false }).limit(36);
  const month = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' }).slice(0, 7);
  type Run = { id: string; period: string; status: keyof typeof PAY_TONE; generated_at: string | null; payroll_lines: { net: number; gross: number; total_deductions: number }[] };
  const st = s as unknown as { payroll_absence_deduct?: boolean; payroll_late_deduct?: boolean; payroll_late_grace_min?: number; payroll_day_hours?: number };
  return (
    <div className="space-y-6">
      <PageHeader title={p.title} subtitle={p.sub} />
      <Card><CardHeader title={p.generate} /><div className="p-5"><GeneratePayrollForm defaultPeriod={month} max={month} /></div></Card>
      <Card className="overflow-hidden">
        {!(runs ?? []).length ? <EmptyState icon={<Banknote className="h-5 w-5" />} title={p.noRuns} /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-sand-50/70 text-xs text-stone-450">
                <tr>{[p.month, p.employees, p.totalGross, p.totalDeductions, p.totalNet, d.common.status, ''].map((h, i) => <th key={i} className="px-5 py-2.5 text-start font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {((runs ?? []) as Run[]).map((r) => {
                  const sum = (k: 'net' | 'gross' | 'total_deductions') => r.payroll_lines.reduce((a, l) => a + Number(l[k]), 0);
                  return (
                    <tr key={r.id} className="hover:bg-sand-50">
                      <td className="px-5 py-3 font-semibold" dir="ltr"><Link href={`/hr/payroll/${r.id}`} className="text-brand hover:underline">{r.period}</Link></td>
                      <td className="px-5 py-3 tabular-nums">{r.payroll_lines.length}</td>
                      <td className="px-5 py-3 tabular-nums">{sar(sum('gross'))}</td>
                      <td className="px-5 py-3 tabular-nums">{sar(sum('total_deductions'))}</td>
                      <td className="px-5 py-3 font-semibold tabular-nums">{sar(sum('net'))}</td>
                      <td className="px-5 py-3"><Badge className={PAY_TONE[r.status]}>{p.status[r.status]}</Badge></td>
                      <td className="px-5 py-3 text-xs text-stone-450">{r.generated_at ? fmtDateTime(r.generated_at, locale) : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-brand" />{p.settings}</span>} subtitle={p.rulesNote} />
        <div className="p-5">
          <PayrollSettingsForm s={{ absence: st.payroll_absence_deduct ?? true, late: st.payroll_late_deduct ?? true, grace: st.payroll_late_grace_min ?? 15, dayHours: Number(st.payroll_day_hours ?? 8) }} />
        </div>
      </Card>
    </div>
  );
}
