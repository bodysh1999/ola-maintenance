'use client';

import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { addPayrollAdjustment, deletePayrollAdjustment, generatePayroll, savePayrollSettings, setPayrollStatus, updatePayrollLine } from '@/app/actions/payroll';
import { ActionForm, SubmitButton, useI18n } from './client';
import { Field, Input, Select, buttonClass } from './ui';

export function GeneratePayrollForm({ defaultPeriod, max }: { defaultPeriod: string; max: string }) {
  const { d } = useI18n(); const p = d.payroll;
  return (
    <ActionForm action={generatePayroll} className="flex flex-wrap items-end gap-3">
      <Field label={p.month} required><Input type="month" name="period" required defaultValue={defaultPeriod} max={max} dir="ltr" /></Field>
      <label className="flex h-11 items-center gap-2 text-sm"><input type="checkbox" name="include_absence" defaultChecked className="h-4 w-4 accent-brand" />{p.includeAbsence}</label>
      <SubmitButton>{p.generate}</SubmitButton>
    </ActionForm>
  );
}

export function RegenerateButton({ period, includeAbsence }: { period: string; includeAbsence: boolean }) {
  const { d } = useI18n(); const p = d.payroll;
  return (
    <ActionForm action={generatePayroll} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="period" value={period} />
      <input type="hidden" name="stay" value="1" />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="include_absence" defaultChecked={includeAbsence} className="h-4 w-4 accent-brand" />{p.includeAbsence}</label>
      <SubmitButton variant="outline">{p.regenerate}</SubmitButton>
    </ActionForm>
  );
}

export function PayrollStatusButton({ id, to, label, confirm, variant = 'primary' }: { id: string; to: 'approved' | 'paid' | 'draft'; label: string; confirm?: string; variant?: 'primary' | 'outline' | 'accent' }) {
  return (
    <ActionForm action={setPayrollStatus}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton name="decision" value={to} variant={variant} confirmText={confirm}>{label}</SubmitButton>
    </ActionForm>
  );
}

export function LineEdit({ id, manual, note }: { id: string; manual: number; note: string | null }) {
  const { d } = useI18n(); const p = d.payroll;
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs text-brand hover:underline">
        <Pencil className="h-3 w-3" />{manual ? manual.toLocaleString('en-US') : p.cols.manual}
      </button>
    );
  }
  return (
    <ActionForm action={updatePayrollLine} onSuccess={() => setOpen(false)} className="flex min-w-56 flex-col gap-1.5">
      <input type="hidden" name="id" value={id} />
      <Input name="manual" type="number" step="0.01" defaultValue={manual || ''} placeholder={p.manualHint} className="h-8 text-xs" dir="ltr" autoFocus />
      <Input name="note" defaultValue={note ?? ''} placeholder={p.cols.note} maxLength={200} className="h-8 text-xs" />
      <div className="flex gap-1">
        <SubmitButton size="sm">{p.saveLine}</SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass('ghost', 'sm')}>✕</button>
      </div>
    </ActionForm>
  );
}

export function AdjustmentForm({ period, employees }: { period: string; employees: { id: string; full_name: string }[] }) {
  const { d } = useI18n(); const p = d.payroll;
  return (
    <ActionForm action={addPayrollAdjustment} resetOnSuccess className="grid gap-3 sm:grid-cols-5">
      <input type="hidden" name="period" value={period} />
      <Field label={p.cols.emp} required className="sm:col-span-2">
        <Select name="employee_id" required defaultValue="">
          <option value="" disabled>—</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </Select>
      </Field>
      <Field label={d.custody.kind} required>
        <Select name="kind" defaultValue="bonus">{(['bonus', 'allowance', 'deduction'] as const).map((k) => <option key={k} value={k}>{p.adjKinds[k]}</option>)}</Select>
      </Field>
      <Field label={d.custody.amount} required><Input name="amount" type="number" min={0.01} step="0.01" required dir="ltr" /></Field>
      <Field label={p.reason} required><Input name="reason" required maxLength={200} /></Field>
      <div className="flex items-center gap-3 sm:col-span-5"><SubmitButton size="sm">{p.addAdj}</SubmitButton><span className="text-xs text-stone-450">{p.adjHint}</span></div>
    </ActionForm>
  );
}

export function DeleteAdjustment({ id }: { id: string }) {
  return (
    <ActionForm action={deletePayrollAdjustment}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton size="sm" variant="ghost" className="h-8 px-2 text-rose-600" confirmText="?"><Trash2 className="h-3.5 w-3.5" /></SubmitButton>
    </ActionForm>
  );
}

export function PayrollSettingsForm({ s }: { s: { absence: boolean; late: boolean; grace: number; dayHours: number } }) {
  const { d } = useI18n(); const p = d.payroll;
  return (
    <ActionForm action={savePayrollSettings} className="grid gap-3 sm:grid-cols-2">
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="absence" defaultChecked={s.absence} className="h-4 w-4 accent-brand" />{p.deductAbsence}</label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="late" defaultChecked={s.late} className="h-4 w-4 accent-brand" />{p.deductLate}</label>
      <Field label={p.grace}><Input name="grace" type="number" min={0} max={120} defaultValue={s.grace} dir="ltr" /></Field>
      <Field label={p.dayHours}><Input name="day_hours" type="number" min={4} max={12} step="0.5" defaultValue={s.dayHours} dir="ltr" /></Field>
      <div className="sm:col-span-2"><SubmitButton size="sm">{d.common.save}</SubmitButton></div>
    </ActionForm>
  );
}
