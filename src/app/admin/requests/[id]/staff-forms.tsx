'use client';

import { useState } from 'react';
import { ActionForm, SubmitButton, useI18n } from '@/components/client';
import { Field, Input, Select, Textarea, cx } from '@/components/ui';
import { assignTechnician, issueQuote, reviewWork, scheduleVisit, transitionRequest, updateTriage } from '@/app/actions/staff';
import { NOTE_REQUIRED, PRIORITIES, STATUS_TONE } from '@/lib/constants';
import type { Priority, RequestStatus, WarrantyState } from '@/lib/types';

export function TransitionPanel({ requestId, options }: { requestId: string; options: RequestStatus[] }) {
  const { d } = useI18n();
  const [to, setTo] = useState<RequestStatus | null>(null);
  if (!options.length) return null;
  const needsNote = to ? NOTE_REQUIRED.includes(to) : false;
  return (
    <ActionForm action={transitionRequest} onSuccess={() => setTo(null)}>
      <input type="hidden" name="request_id" value={requestId} />
      <div className="mb-2 text-xs font-medium text-stone-450">{d.admin.detail.moveTo}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((s) => (
          <button key={s} type="button" onClick={() => setTo(to === s ? null : s)}
            className={cx('rounded-full px-3.5 py-1.5 text-sm ring-1 ring-inset transition', to === s ? 'ring-2 ring-brand ' + STATUS_TONE[s] : STATUS_TONE[s] + ' opacity-80 hover:opacity-100')}>
            {d.status[s]}
          </button>
        ))}
      </div>
      {to && (
        <div className="mt-3 space-y-3 rounded-xl bg-sand-50 p-3">
          <input type="hidden" name="to" value={to} />
          <Textarea name="note" required={needsNote} rows={2} placeholder={needsNote ? d.admin.detail.reasonReq : `${d.common.note} (${d.common.optional})`} />
          <SubmitButton size="sm" variant={to === 'rejected' ? 'danger' : 'primary'}>{d.common.confirm}: {d.status[to]}</SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}

export type TechOption = { id: string; name: string; contractor: string | null; open: number; match: boolean; warranty?: boolean };

export function AssignForm({ requestId, techs, current, priority }: { requestId: string; techs: TechOption[]; current?: string | null; priority: Priority }) {
  const { d } = useI18n();
  const sorted = [...techs].sort((a, b) => Number(!!b.warranty) - Number(!!a.warranty) || Number(b.match) - Number(a.match) || a.open - b.open);
  const suggested = !current ? sorted.find((t) => t.warranty)?.id : undefined;
  return (
    <ActionForm action={assignTechnician} className="space-y-3">
      <input type="hidden" name="request_id" value={requestId} />
      <Field label={d.admin.detail.tech} required>
        <Select name="technician_id" required defaultValue={current ?? suggested ?? ''}>
          <option value="" disabled>—</option>
          {sorted.map((t) => (
            <option key={t.id} value={t.id}>
              {t.warranty ? `🛡 ${d.ops.warrantyTech} · ` : ''}{t.match ? '★ ' : ''}{t.name}{t.contractor ? ` — ${t.contractor}` : ''} ({d.admin.team.openTasks}: {t.open})
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={d.common.priority}>
          <Select name="priority" defaultValue={priority}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{d.priority[p]}</option>)}
          </Select>
        </Field>
        <Field label={d.admin.detail.visitStart} hint={d.common.optional}>
          <Input type="datetime-local" name="starts_at" />
        </Field>
      </div>
      <Field label={d.admin.detail.instructions}>
        <Textarea name="instructions" rows={2} />
      </Field>
      <SubmitButton>{current ? d.admin.detail.reassign : d.admin.detail.assign}</SubmitButton>
    </ActionForm>
  );
}

export function ScheduleForm({ requestId, hasVisit, defaultStart }: { requestId: string; hasVisit: boolean; defaultStart?: string }) {
  const { d } = useI18n();
  return (
    <ActionForm action={scheduleVisit} className="space-y-3">
      <input type="hidden" name="request_id" value={requestId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={d.admin.detail.visitStart} required><Input type="datetime-local" name="starts_at" required defaultValue={defaultStart} /></Field>
        <Field label={d.admin.detail.visitEnd}><Input type="datetime-local" name="ends_at" /></Field>
      </div>
      {hasVisit && <Input name="note" placeholder={`${d.req.reason} (${d.common.optional})`} />}
      <SubmitButton variant={hasVisit ? 'outline' : 'primary'}>{hasVisit ? d.admin.detail.reschedule : d.admin.detail.schedule}</SubmitButton>
    </ActionForm>
  );
}

export function ReviewForm({ requestId, workOrderId }: { requestId: string; workOrderId: string }) {
  const { d } = useI18n();
  return (
    <ActionForm action={reviewWork} className="space-y-3">
      <input type="hidden" name="request_id" value={requestId} />
      <input type="hidden" name="work_order_id" value={workOrderId} />
      <Textarea name="note" rows={2} placeholder={d.admin.detail.reviewNote} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="decision" value="approve">{d.admin.detail.approve}</SubmitButton>
        <SubmitButton name="decision" value="return" variant="outline">{d.admin.detail.returnWork}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function TriageForm({ requestId, priority, warranty, note }: { requestId: string; priority: Priority; warranty: WarrantyState; note: string | null }) {
  const { d } = useI18n();
  return (
    <ActionForm action={updateTriage} className="space-y-3" successText={d.common.saved}>
      <input type="hidden" name="request_id" value={requestId} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={d.common.priority}>
          <Select name="priority" defaultValue={priority}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{d.priority[p]}</option>)}
          </Select>
        </Field>
        <Field label={d.admin.detail.override}>
          <Select name="warranty_state" defaultValue={warranty}>
            {(['in_warranty', 'out_of_warranty', 'unknown'] as const).map((w) => <option key={w} value={w}>{d.warranty[w]}</option>)}
          </Select>
        </Field>
      </div>
      <Field label={d.admin.detail.warrantyNote}><Input name="warranty_note" defaultValue={note ?? ''} /></Field>
      <SubmitButton size="sm" variant="outline">{d.common.save}</SubmitButton>
    </ActionForm>
  );
}

export function QuoteForm({ requestId }: { requestId: string }) {
  const { d } = useI18n();
  return (
    <ActionForm action={issueQuote} className="space-y-3" resetOnSuccess>
      <input type="hidden" name="request_id" value={requestId} />
      <Field label={d.admin.detail.quoteDesc} required><Textarea name="description" rows={2} required /></Field>
      <Field label={`${d.req.amount} (${d.common.sar}) — ${d.admin.detail.beforeVat}`} required>
        <Input type="number" name="amount" min={0} step="0.01" required />
      </Field>
      <SubmitButton variant="accent" size="sm">{d.admin.detail.issueQuote}</SubmitButton>
    </ActionForm>
  );
}
