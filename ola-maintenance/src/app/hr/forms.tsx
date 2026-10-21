'use client';

import { ActionForm, SubmitButton, useI18n } from '@/components/client';
import { Field, Input, Select, Textarea } from '@/components/ui';
import { createOpening, toggleOpening, updateApplication } from '@/app/actions/hr';
import { APPLICATION_STATUSES, EMPLOYMENT_TYPES } from '@/lib/sales-hr';
import { Creator } from '@/app/admin/projects/forms';

export function ApplicationUpdateForm({ app }: { app: { id: string; status: string; internal_notes: string | null } }) {
  const { d } = useI18n();
  return (
    <ActionForm action={updateApplication} className="grid gap-3">
      <input type="hidden" name="id" value={app.id} />
      <Field label={d.common.status}>
        <Select name="status" defaultValue={app.status}>
          {APPLICATION_STATUSES.map((k) => <option key={k} value={k}>{d.hr.status[k]}</option>)}
        </Select>
      </Field>
      <Field label={d.hr.notes}><Textarea name="internal_notes" rows={5} defaultValue={app.internal_notes ?? ''} /></Field>
      <SubmitButton>{d.hr.update}</SubmitButton>
    </ActionForm>
  );
}

export function OpeningForm() {
  const { d } = useI18n();
  const o = d.hr.openings;
  return (
    <Creator label={o.add}>
      {(close) => (
        <ActionForm action={createOpening} onSuccess={close} className="grid gap-3 sm:grid-cols-2">
          <Field label={o.jobTitle} required><Input name="title" required /></Field>
          <Field label={o.department}><Input name="department" /></Field>
          <Field label={o.location}><Input name="location" defaultValue="جدة" /></Field>
          <Field label={o.employment}>
            <Select name="employment" defaultValue="full_time">
              {EMPLOYMENT_TYPES.map((k) => <option key={k} value={k}>{d.hr.employment[k]}</option>)}
            </Select>
          </Field>
          <Field label={o.description} className="sm:col-span-2"><Textarea name="description" rows={3} /></Field>
          <Field label={o.requirements} hint="·" className="sm:col-span-2"><Textarea name="requirements" rows={3} /></Field>
          <div className="sm:col-span-2"><SubmitButton>{d.common.create}</SubmitButton></div>
        </ActionForm>
      )}
    </Creator>
  );
}

export function ToggleOpening({ id, open }: { id: string; open: boolean }) {
  const { d } = useI18n();
  return (
    <ActionForm action={toggleOpening}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="open" value={String(!open)} />
      <SubmitButton size="sm" variant="outline">{open ? d.hr.openings.close : d.hr.openings.reopen}</SubmitButton>
    </ActionForm>
  );
}
