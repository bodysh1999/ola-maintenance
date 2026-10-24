import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile, getI18n } from '@/lib/session';
import { PAY_TONE, sar } from '@/lib/hr';
import { Badge, Card, CardHeader, PageHeader, StatCard } from '@/components/ui';
import { ExportExcelButton } from '@/components/export-button';
import { AdjustmentForm, DeleteAdjustment, LineEdit, PayrollStatusButton, RegenerateButton } from '@/components/payroll-client';

type Line = {
  id: string; employee_id: string; emp_no: string | null; full_name: string; job_title: string | null; department: string | null; payable_days: number;
  basic: number; housing: number; transport: number; other_allowances: number; overtime_hours: number; overtime_amount: number; trip_amount: number; bonus_amount: number;
  absence_days: number; absence_deduction: number; late_minutes: number; late_deduction: number; unpaid_leave_days: number; unpaid_leave_deduction: number;
  advance_deduction: number; gosi_amount: number; fixed_deductions: number; other_deductions: number; manual_adjustment: number;
  gross: number; total_deductions: number; net: number; note: string | null;
};

export default async function PayrollRun({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { d }, supabase, profile] = await Promise.all([params, getI18n(), createClient(), getCurrentProfile()]);
  const p = d.payroll; const c = p.cols;
  const { data: run } = await supabase.from('payroll_runs').select('*').eq('id', id).maybeSingle();
  if (!run) notFound();
  const [{ data: ls }, { data: adj }, { data: bank }] = await Promise.all([
    supabase.from('payroll_lines').select('*').eq('run_id', id).order('full_name'),
    supabase.from('payroll_adjustments').select('*, employees(full_name)').eq('period', run.period).order('created_at'),
    supabase.rpc('payroll_bank_sheet', { p_run: id }),
  ]);
  const lines = (ls ?? []) as Line[];
  const draft = run.status === 'draft';
  const isAdmin = profile?.role === 'admin';
  const tot = (k: keyof Line) => lines.reduce((a, l) => a + Number(l[k] ?? 0), 0);
  const bankBy = new Map(((bank ?? []) as { employee_id: string; iban: string | null; bank_name: string | null; id_number: string | null }[]).map((b) => [b.employee_id, b]));
  const n = (v: number) => Number(v ?? 0);

  const sheets = [
    { name: p.sheetName, rows: lines.map((l) => ({
      [c.empNo]: l.emp_no ?? '', [c.emp]: l.full_name, [c.job]: l.job_title ?? '', [c.dept]: l.department ?? '', [c.days]: l.payable_days,
      [c.basic]: n(l.basic), [c.housing]: n(l.housing), [c.transport]: n(l.transport), [c.otherAllow]: n(l.other_allowances),
      [c.otHours]: n(l.overtime_hours), [c.overtime]: n(l.overtime_amount), [c.trip]: n(l.trip_amount), [c.bonus]: n(l.bonus_amount), [c.gross]: n(l.gross),
      [c.absenceDays]: l.absence_days, [c.absence]: n(l.absence_deduction), [c.lateMin]: l.late_minutes, [c.late]: n(l.late_deduction),
      [c.unpaid]: n(l.unpaid_leave_deduction), [c.advance]: n(l.advance_deduction), [c.gosi]: n(l.gosi_amount), [c.fixed]: n(l.fixed_deductions),
      [c.otherDed]: n(l.other_deductions), [c.manual]: n(l.manual_adjustment), [c.deductions]: n(l.total_deductions), [c.net]: n(l.net), [c.note]: l.note ?? '',
    })) },
    { name: p.bankSheet, rows: lines.map((l) => ({
      [c.empNo]: l.emp_no ?? '', [c.emp]: l.full_name, [c.idNo]: bankBy.get(l.employee_id)?.id_number ?? '',
      [c.bank]: bankBy.get(l.employee_id)?.bank_name ?? '', [c.iban]: bankBy.get(l.employee_id)?.iban ?? '', [c.net]: n(l.net),
    })) },
    { name: p.summary, rows: [
      { '': p.month, [c.net]: run.period },
      { '': p.employees, [c.net]: lines.length },
      { '': p.totalGross, [c.net]: tot('gross') },
      { '': c.gosi, [c.net]: tot('gosi_amount') },
      { '': p.totalDeductions, [c.net]: tot('total_deductions') },
      { '': p.totalNet, [c.net]: tot('net') },
      { '': d.common.status, [c.net]: p.status[run.status as keyof typeof p.status] },
    ] as Record<string, string | number | null>[] },
  ];

  const cell = 'whitespace-nowrap px-3 py-2.5 tabular-nums';
  const ded = (v: number) => (n(v) ? <span className="text-rose-700">{sar(v)}</span> : <span className="text-stone-300">—</span>);
  const add = (v: number) => (n(v) ? sar(v) : <span className="text-stone-300">—</span>);

  return (
    <div className="space-y-6">
      <Link href="/hr/payroll" className="inline-flex items-center gap-1 text-sm text-stone-450 hover:text-ink"><ChevronRight className="h-4 w-4 ltr:rotate-180" />{p.title}</Link>
      <PageHeader eyebrow={<Badge className={PAY_TONE[run.status as keyof typeof PAY_TONE]}>{p.status[run.status as keyof typeof p.status]}</Badge>}
        title={<span dir="ltr">{run.period}</span>} subtitle={p.sub}
        actions={<div className="flex flex-wrap items-center gap-2">
          <ExportExcelButton filename={`payroll-${run.period}`} sheets={sheets} />
          {draft && isAdmin && <PayrollStatusButton id={id} to="approved" label={p.approve} confirm={p.approveConfirm} />}
          {run.status === 'approved' && <PayrollStatusButton id={id} to="paid" label={p.markPaid} confirm={p.paidConfirm} variant="accent" />}
          {run.status === 'approved' && isAdmin && <PayrollStatusButton id={id} to="draft" label={p.reopen} variant="outline" />}
        </div>} />
      {draft && !isAdmin && <p className="-mt-3 text-xs text-stone-450">{p.approveHint}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={p.employees} value={lines.length} tone="brand" />
        <StatCard label={p.totalGross} value={sar(tot('gross'))} />
        <StatCard label={p.totalDeductions} value={sar(tot('total_deductions'))} tone="warn" />
        <StatCard label={p.totalNet} value={sar(tot('net'))} tone="good" />
      </div>

      {draft && <Card className="p-4"><RegenerateButton period={run.period} includeAbsence={run.include_absence} /></Card>}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1500px] text-xs">
            <thead className="bg-sand-50/70 text-stone-450">
              <tr>{[c.emp, c.days, c.basic, c.housing, c.transport, c.otherAllow, c.overtime, c.trip, c.bonus, c.gross, c.absence, c.late, c.unpaid, c.advance, c.gosi, c.fixed, c.otherDed, c.manual, c.deductions, c.net]
                .map((h) => <th key={h} className="whitespace-nowrap px-3 py-2.5 text-start font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {lines.map((l) => (
                <tr key={l.id} className="align-top hover:bg-sand-50/60">
                  <td className="sticky start-0 bg-white px-3 py-2.5">
                    <div className="font-medium text-ink">{l.full_name}</div>
                    <div className="text-[10px] text-stone-450">{l.job_title}{l.note ? ` · ${l.note}` : ''}</div>
                  </td>
                  <td className={cell}>{l.payable_days}</td>
                  <td className={cell}>{sar(l.basic)}</td><td className={cell}>{sar(l.housing)}</td><td className={cell}>{sar(l.transport)}</td><td className={cell}>{add(l.other_allowances)}</td>
                  <td className={cell} title={`${l.overtime_hours} h`}>{add(l.overtime_amount)}</td><td className={cell}>{add(l.trip_amount)}</td><td className={cell}>{add(l.bonus_amount)}</td>
                  <td className={`${cell} font-semibold`}>{sar(l.gross)}</td>
                  <td className={cell} title={`${l.absence_days}`}>{ded(l.absence_deduction)}{l.absence_days ? <div className="text-[10px] text-stone-450">{l.absence_days} {d.me.balance.days}</div> : null}</td>
                  <td className={cell}>{ded(l.late_deduction)}{l.late_minutes ? <div className="text-[10px] text-stone-450">{l.late_minutes} min</div> : null}</td>
                  <td className={cell}>{ded(l.unpaid_leave_deduction)}</td><td className={cell}>{ded(l.advance_deduction)}</td><td className={cell}>{ded(l.gosi_amount)}</td>
                  <td className={cell}>{ded(l.fixed_deductions)}</td><td className={cell}>{ded(l.other_deductions)}</td>
                  <td className={cell}>{draft ? <LineEdit id={l.id} manual={n(l.manual_adjustment)} note={l.note} /> : (n(l.manual_adjustment) ? sar(l.manual_adjustment) : '—')}</td>
                  <td className={`${cell} text-rose-700`}>{sar(l.total_deductions)}</td>
                  <td className={`${cell} text-sm font-bold text-brand`}>{sar(l.net)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-sand-200 bg-sand-50/70 font-semibold">
              <tr>
                <td className="sticky start-0 bg-sand-50 px-3 py-2.5">{lines.length}</td><td />
                {(['basic', 'housing', 'transport', 'other_allowances', 'overtime_amount', 'trip_amount', 'bonus_amount', 'gross', 'absence_deduction', 'late_deduction',
                  'unpaid_leave_deduction', 'advance_deduction', 'gosi_amount', 'fixed_deductions', 'other_deductions', 'manual_adjustment', 'total_deductions', 'net'] as (keyof Line)[])
                  .map((k) => <td key={k} className={cell}>{sar(tot(k))}</td>)}
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title={p.adjustments} />
        <div className="space-y-4 p-5">
          {(adj ?? []).length ? (
            <ul className="divide-y divide-sand-100 rounded-xl border border-sand-100">
              {((adj ?? []) as { id: string; kind: 'bonus' | 'allowance' | 'deduction'; amount: number; reason: string; employees: { full_name: string } | null }[]).map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                  <span><span className="font-medium">{a.employees?.full_name}</span> · {p.adjKinds[a.kind]} · {a.reason}</span>
                  <span className="flex items-center gap-2"><span className={a.kind === 'deduction' ? 'text-rose-700' : 'text-emerald-700'}>{a.kind === 'deduction' ? '−' : '+'}{sar(a.amount)}</span>{draft && <DeleteAdjustment id={a.id} />}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-stone-450">{p.noAdj}</p>}
          {draft && <AdjustmentForm period={run.period} employees={lines.map((l) => ({ id: l.employee_id, full_name: l.full_name }))} />}
        </div>
      </Card>
    </div>
  );
}
