'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { addPart, deletePart } from '@/app/actions/tech';
import { fmtMoney } from '@/lib/format';
import { ActionForm, SubmitButton, useI18n } from './client';
import { Input } from './ui';

type Part = { id: string; name: string; quantity: number; unit_cost: number };

export function PartsTable({ parts, editable }: { parts: Part[]; editable?: boolean }) {
  const { d, locale } = useI18n();
  const total = parts.reduce((s, p) => s + Number(p.quantity) * Number(p.unit_cost), 0);
  if (!parts.length) return <p className="text-sm text-stone-450">{d.common.noData}</p>;
  return (
    <div className="overflow-hidden rounded-xl border border-sand-200">
      <table className="w-full text-sm">
        <thead className="bg-sand-50 text-xs text-stone-450">
          <tr>
            <th className="px-3 py-2 text-start font-medium">{d.admin.detail.partName}</th>
            <th className="px-3 py-2 text-start font-medium">{d.admin.detail.qty}</th>
            <th className="px-3 py-2 text-start font-medium">{d.admin.detail.unitCost}</th>
            <th className="px-3 py-2 text-end font-medium">{d.common.total}</th>
            {editable && <th className="w-10" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-sand-100">
          {parts.map((p) => (
            <tr key={p.id}>
              <td className="px-3 py-2">{p.name}</td>
              <td className="px-3 py-2 tabular-nums">{Number(p.quantity)}</td>
              <td className="px-3 py-2 tabular-nums">{fmtMoney(p.unit_cost, locale)}</td>
              <td className="px-3 py-2 text-end tabular-nums">{fmtMoney(Number(p.quantity) * Number(p.unit_cost), locale)}</td>
              {editable && <td className="px-2"><DeletePart id={p.id} /></td>}
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-sand-50 font-semibold">
          <tr><td className="px-3 py-2" colSpan={3}>{d.common.total}</td><td className="px-3 py-2 text-end tabular-nums">{fmtMoney(total, locale)}</td>{editable && <td />}</tr>
        </tfoot>
      </table>
    </div>
  );
}

function DeletePart({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" aria-label="delete" disabled={pending} onClick={() => start(async () => { await deletePart(id); router.refresh(); })}
      className="grid h-7 w-7 place-items-center rounded-lg text-rose-600 hover:bg-rose-50">
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
    </button>
  );
}

export function AddPartForm({ workOrderId }: { workOrderId: string }) {
  const { d } = useI18n();
  return (
    <ActionForm action={addPart} resetOnSuccess className="mt-3">
      <input type="hidden" name="work_order_id" value={workOrderId} />
      <div className="grid grid-cols-[1fr_72px_96px_auto] gap-2">
        <Input name="name" required placeholder={d.admin.detail.partName} />
        <Input name="quantity" type="number" min="0.01" step="0.01" defaultValue={1} required aria-label={d.admin.detail.qty} />
        <Input name="unit_cost" type="number" min="0" step="0.01" placeholder={d.admin.detail.unitCost} aria-label={d.admin.detail.unitCost} />
        <SubmitButton variant="outline" className="h-11"><Plus className="h-4 w-4" /></SubmitButton>
      </div>
    </ActionForm>
  );
}
