'use client';

import { Trash2 } from 'lucide-react';
import { addHoliday, cancelDelegation, deleteHoliday, setDelegation } from '@/app/actions/hr-ops';
import { ActionForm, SubmitButton, useI18n } from './client';
import { Field, Input, Select } from './ui';

export function DelegationForm({ candidates, minDate }: { candidates: { id: string; full_name: string; job_title: string | null }[]; minDate: string }) {
  const { d } = useI18n(); const h = d.hrops;
  return (
    <ActionForm action={setDelegation} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
      <Field label={h.delegateTo} required className="sm:col-span-2">
        <Select name="delegate_id" required defaultValue="">
          <option value="" disabled>—</option>
          {candidates.map((c) => <option key={c.id} value={c.id}>{c.full_name}{c.job_title ? ` — ${c.job_title}` : ''}</option>)}
        </Select>
      </Field>
      <Field label={h.from} required><Input type="date" name="start_date" required min={minDate} defaultValue={minDate} /></Field>
      <Field label={h.to} required><Input type="date" name="end_date" required min={minDate} /></Field>
      <Field label={h.reason} className="sm:col-span-2"><Input name="reason" maxLength={200} /></Field>
      <div className="sm:col-span-2"><SubmitButton>{h.delegate}</SubmitButton></div>
    </ActionForm>
  );
}

export function CancelDelegationButton({ id }: { id: string }) {
  const { d } = useI18n();
  return (
    <ActionForm action={cancelDelegation}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton size="sm" variant="ghost" confirmText={`${d.hrops.cancel}?`}>{d.hrops.cancel}</SubmitButton>
    </ActionForm>
  );
}

export function HolidayForm() {
  const { d } = useI18n(); const h = d.hrops;
  return (
    <ActionForm action={addHoliday} resetOnSuccess className="grid gap-3 sm:grid-cols-4">
      <Field label={h.holidayName} required className="sm:col-span-2"><Input name="name_ar" required maxLength={80} /></Field>
      <Field label={h.from} required><Input type="date" name="start_date" required /></Field>
      <Field label={h.to}><Input type="date" name="end_date" /></Field>
      <div className="sm:col-span-4"><SubmitButton size="sm">{h.addHoliday}</SubmitButton></div>
    </ActionForm>
  );
}

export function DeleteHolidayButton({ id }: { id: string }) {
  return (
    <ActionForm action={deleteHoliday}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton size="sm" variant="ghost" className="h-8 w-8 p-0 text-rose-600" confirmText="?"><Trash2 className="h-3.5 w-3.5" /></SubmitButton>
    </ActionForm>
  );
}
