'use client';

import { ActionForm, SubmitButton, useI18n } from '@/components/client';
import { Field, Input, Select, Textarea } from '@/components/ui';
import { reserveLeadUnit, updateLead, updateUnitSale } from '@/app/actions/sales';
import { LEAD_STATUSES, SALE_STATUSES } from '@/lib/sales-hr';

export function LeadUpdateForm({ lead, team }: {
  lead: { id: string; status: string; assigned_to: string | null; follow_up_at: string | null; internal_notes: string | null };
  team: { id: string; name: string }[];
}) {
  const { d } = useI18n();
  const s = d.sales;
  return (
    <ActionForm action={updateLead} className="grid gap-3">
      <input type="hidden" name="id" value={lead.id} />
      <Field label={d.common.status}>
        <Select name="status" defaultValue={lead.status}>
          {LEAD_STATUSES.map((k) => <option key={k} value={k}>{s.status[k]}</option>)}
        </Select>
      </Field>
      <Field label={s.assignee}>
        <Select name="assigned_to" defaultValue={lead.assigned_to ?? ''}>
          <option value="">{d.common.unassigned}</option>
          {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
      </Field>
      <Field label={s.followUp}><Input type="date" name="follow_up_at" defaultValue={lead.follow_up_at ?? ''} /></Field>
      <Field label={s.notes}><Textarea name="internal_notes" rows={4} defaultValue={lead.internal_notes ?? ''} /></Field>
      <SubmitButton>{s.update}</SubmitButton>
    </ActionForm>
  );
}

export function ReserveUnitButton({ id }: { id: string }) {
  const { d } = useI18n();
  return (
    <ActionForm action={reserveLeadUnit}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="accent" confirmText={d.sales.reserveUnit + '?'}>{d.sales.reserveUnit}</SubmitButton>
    </ActionForm>
  );
}

export function UnitSaleForm({ unit }: { unit: { id: string; price: number | null; sale_status: string } }) {
  const { d } = useI18n();
  return (
    <ActionForm action={updateUnitSale} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={unit.id} />
      <Input name="price" type="number" min={0} step={1000} defaultValue={unit.price ?? ''} placeholder={d.site.price} className="h-9 w-36" dir="ltr" />
      <Select name="sale_status" defaultValue={unit.sale_status} className="h-9 w-32">
        {SALE_STATUSES.map((k) => <option key={k} value={k}>{d.saleStatus[k]}</option>)}
      </Select>
      <SubmitButton size="sm" variant="outline">{d.common.save}</SubmitButton>
    </ActionForm>
  );
}
