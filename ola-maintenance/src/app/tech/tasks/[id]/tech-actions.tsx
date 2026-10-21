'use client';

import { useState } from 'react';
import { PackageSearch, Play, Send } from 'lucide-react';
import { ActionForm, SubmitButton, useI18n } from '@/components/client';
import { Textarea } from '@/components/ui';
import { markAwaitingParts, startWork, submitWork } from '@/app/actions/tech';

export function StartButton({ workOrderId }: { workOrderId: string }) {
  const { d } = useI18n();
  return (
    <ActionForm action={startWork}>
      <input type="hidden" name="work_order_id" value={workOrderId} />
      <SubmitButton size="lg" variant="accent" className="h-14 w-full rounded-2xl text-base"><Play className="h-5 w-5" />{d.tech.start}</SubmitButton>
    </ActionForm>
  );
}

export function SubmitReport({ workOrderId, hasAfter }: { workOrderId: string; hasAfter: boolean }) {
  const { d } = useI18n();
  return (
    <ActionForm action={submitWork} className="space-y-3">
      <input type="hidden" name="work_order_id" value={workOrderId} />
      <Textarea name="notes" required rows={3} placeholder={d.tech.reportNotes} />
      {!hasAfter && <p className="text-xs text-amber-700">{d.tech.submitHint}</p>}
      <SubmitButton size="lg" className="h-14 w-full rounded-2xl text-base"><Send className="flip-rtl h-5 w-5" />{d.tech.submit}</SubmitButton>
    </ActionForm>
  );
}

export function AwaitingPartsForm({ workOrderId }: { workOrderId: string }) {
  const { d } = useI18n();
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 text-sm font-medium text-amber-700">
        <PackageSearch className="h-4 w-4" />{d.tech.awaitingParts}
      </button>
    );
  }
  return (
    <ActionForm action={markAwaitingParts} className="space-y-2 rounded-xl bg-amber-50 p-3">
      <input type="hidden" name="work_order_id" value={workOrderId} />
      <Textarea name="note" required rows={2} placeholder={d.tech.awaitingReason} />
      <div className="flex gap-2">
        <SubmitButton size="sm" variant="outline">{d.tech.awaitingParts}</SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-stone-450">{d.common.cancel}</button>
      </div>
    </ActionForm>
  );
}
