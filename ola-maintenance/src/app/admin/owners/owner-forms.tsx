'use client';

import { useState } from 'react';
import { Copy, KeyRound } from 'lucide-react';
import { ActionForm, SubmitButton, useI18n } from '@/components/client';
import { Field, Input, Textarea } from '@/components/ui';
import { activateOwner, createOwner, disableOwner, updateOwner } from '@/app/actions/admin';
import { Creator } from '../projects/forms';

export function OwnerCreateForm() {
  const { d } = useI18n();
  return (
    <Creator label={d.admin.owners.add}>
      {(close) => (
        <ActionForm action={createOwner} onSuccess={close} className="grid gap-3 sm:grid-cols-3">
          <Field label={d.common.name} required><Input name="full_name" required /></Field>
          <Field label={d.common.phone} required><Input name="phone" type="tel" required placeholder="05xxxxxxxx" /></Field>
          <Field label={d.common.email}><Input name="email" type="email" /></Field>
          <Field label={d.admin.owners.notes} className="sm:col-span-3"><Textarea name="notes" rows={2} /></Field>
          <div className="sm:col-span-3"><SubmitButton>{d.common.create}</SubmitButton></div>
        </ActionForm>
      )}
    </Creator>
  );
}

export function OwnerEditForm({ owner }: { owner: { id: string; full_name: string; phone: string; email: string | null; notes: string | null } }) {
  const { d } = useI18n();
  return (
    <ActionForm action={updateOwner} className="grid gap-3 sm:grid-cols-3" successText={d.common.saved}>
      <input type="hidden" name="id" value={owner.id} />
      <Field label={d.common.name}><Input name="full_name" defaultValue={owner.full_name} required /></Field>
      <Field label={d.common.phone}><Input name="phone" type="tel" defaultValue={owner.phone} required /></Field>
      <Field label={d.common.email}><Input name="email" type="email" defaultValue={owner.email ?? ''} /></Field>
      <Field label={d.admin.owners.notes} className="sm:col-span-3"><Textarea name="notes" rows={2} defaultValue={owner.notes ?? ''} /></Field>
      <div className="sm:col-span-3"><SubmitButton size="sm" variant="outline">{d.common.save}</SubmitButton></div>
    </ActionForm>
  );
}

/** Shows a one-time temporary password returned by account-creating actions */
export function TempPassword({ email, password }: { email: string; password: string }) {
  const { d } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 rounded-xl border border-accent/40 bg-accent/[.06] p-3 text-sm">
      <div className="flex items-center gap-2 font-semibold"><KeyRound className="h-4 w-4 text-accent" />{d.admin.owners.tempPassword}</div>
      <div className="mt-2 flex items-center gap-2" dir="ltr">
        <code className="rounded-lg bg-white px-2 py-1 text-xs">{email}</code>
        <code className="rounded-lg bg-white px-2 py-1 font-semibold">{password}</code>
        <button type="button" onClick={() => { navigator.clipboard.writeText(`${email}\n${password}`); setCopied(true); }} className="text-stone-450 hover:text-ink" aria-label="copy">
          <Copy className="h-4 w-4" />
        </button>
        {copied && <span className="text-xs text-emerald-700">✓</span>}
      </div>
      <p className="mt-2 text-xs text-stone-450">{d.admin.owners.tempPasswordHint}</p>
    </div>
  );
}

export function OwnerAccountActions({ ownerId, status }: { ownerId: string; status: 'pending' | 'active' | 'disabled' }) {
  const { d } = useI18n();
  if (status === 'active') {
    return (
      <ActionForm action={disableOwner}>
        <input type="hidden" name="owner_id" value={ownerId} />
        <SubmitButton size="sm" variant="ghost" confirmText={`${d.admin.owners.disable}?`}>{d.admin.owners.disable}</SubmitButton>
      </ActionForm>
    );
  }
  return (
    <ActionForm action={activateOwner}>
      {(state) => (
        <>
          <input type="hidden" name="owner_id" value={ownerId} />
          <SubmitButton size="sm">{status === 'disabled' ? d.admin.owners.enable : d.admin.owners.activate}</SubmitButton>
          {state?.data?.password ? <TempPassword email={String(state.data.email)} password={String(state.data.password)} /> : null}
        </>
      )}
    </ActionForm>
  );
}
