import { ReceiptText } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { getMyEmployee } from '@/lib/me';
import { sar } from '@/lib/hr';
import { Card, CardHeader, EmptyState, PageHeader } from '@/components/ui';

type Slip = Record<string, number | string | null> & { id: string; payroll_runs: { period: string; status: string } | null };

/** The employee's approved payslips (visible once the admin approves the month) */
export default async function Payslips() {
  const [{ d }, supabase, me] = await Promise.all([getI18n(), createClient(), getMyEmployee()]);
  const p = d.payroll; const c = p.cols;
  const { data } = me ? await supabase.from('payroll_lines').select('*, payroll_runs(period, status)').eq('employee_id', me.id) : { data: [] };
  const slips = ((data ?? []) as Slip[]).sort((a, b) => String(b.payroll_runs?.period).localeCompare(String(a.payroll_runs?.period)));
  const row = (label: string, v: unknown, neg = false) => (Number(v) ? (
    <div className="flex justify-between gap-3 py-1.5 text-sm"><dt className="text-stone-450">{label}</dt><dd className={neg ? 'tabular-nums text-rose-700' : 'tabular-nums'}>{sar(v as number)}</dd></div>
  ) : null);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={p.payslips} />
      {!slips.length && <Card><EmptyState icon={<ReceiptText className="h-5 w-5" />} title={p.noPayslips} /></Card>}
      {slips.map((s) => (
        <Card key={s.id}>
          <CardHeader title={<span dir="ltr">{s.payroll_runs?.period}</span>} subtitle={p.status[(s.payroll_runs?.status ?? 'approved') as keyof typeof p.status]}
            action={<span className="font-display text-2xl font-bold text-brand tabular-nums">{sar(s.net as number)} <span className="text-xs font-normal text-stone-450">{d.common.sar}</span></span>} />
          <div className="grid gap-6 p-5 sm:grid-cols-2">
            <dl>
              <div className="mb-1 text-xs font-semibold text-emerald-700">{p.earnings}</div>
              {row(c.basic, s.basic)}{row(c.housing, s.housing)}{row(c.transport, s.transport)}{row(c.otherAllow, s.other_allowances)}
              {row(`${c.overtime} (${s.overtime_hours} h)`, s.overtime_amount)}{row(c.trip, s.trip_amount)}{row(c.bonus, s.bonus_amount)}
              {Number(s.manual_adjustment) > 0 && row(c.manual, s.manual_adjustment)}
              <div className="mt-1 flex justify-between border-t border-sand-100 pt-2 text-sm font-semibold"><dt>{c.gross}</dt><dd className="tabular-nums">{sar(s.gross as number)}</dd></div>
            </dl>
            <dl>
              <div className="mb-1 text-xs font-semibold text-rose-700">{p.deductionsTitle}</div>
              {row(`${c.absence} (${s.absence_days})`, s.absence_deduction, true)}{row(`${c.late} (${s.late_minutes} min)`, s.late_deduction, true)}
              {row(c.unpaid, s.unpaid_leave_deduction, true)}{row(c.advance, s.advance_deduction, true)}{row(c.gosi, s.gosi_amount, true)}
              {row(c.fixed, s.fixed_deductions, true)}{row(c.otherDed, s.other_deductions, true)}
              {Number(s.manual_adjustment) < 0 && row(c.manual, -Number(s.manual_adjustment), true)}
              <div className="mt-1 flex justify-between border-t border-sand-100 pt-2 text-sm font-semibold"><dt>{c.deductions}</dt><dd className="tabular-nums text-rose-700">{sar(s.total_deductions as number)}</dd></div>
            </dl>
          </div>
          {s.note && <p className="border-t border-sand-100 px-5 py-3 text-xs text-stone-450">{s.note}</p>}
        </Card>
      ))}
    </div>
  );
}
