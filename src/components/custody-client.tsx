'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Loader2, Plus, Receipt, Trash2, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { translateError } from '@/lib/i18n';
import { prepareImage } from '@/lib/image';
import {
  addCustodyExpense, closeCustody, deleteCustodyExpense, requestCustody, requestSettlement, reviewExpense, saveApprovalChain,
} from '@/app/actions/custody';
import { ActionForm, SubmitButton, useI18n } from './client';
import { Field, Input, Select, buttonClass, cx } from './ui';

export const EXPENSE_CATEGORIES = ['materials', 'labor', 'cleaning', 'transport', 'fuel', 'maintenance', 'hospitality', 'government', 'other'] as const;

// ------------------------------------------------------------------ employee
export function CustodyRequestForm({ max }: { max: number }) {
  const { d } = useI18n(); const c = d.custody;
  return (
    <ActionForm action={requestCustody} resetOnSuccess className="grid gap-4 sm:grid-cols-3">
      <Field label={c.amount} required hint={c.maxHint.replace('{max}', max.toLocaleString('en-US'))}>
        <Input name="amount" type="number" inputMode="decimal" min={1} max={max} step="0.01" required dir="ltr" />
      </Field>
      <Field label={c.purpose} required className="sm:col-span-2">
        <Input name="purpose" required maxLength={300} placeholder={c.purposePh} />
      </Field>
      <div className="sm:col-span-3"><SubmitButton>{c.submit}</SubmitButton></div>
    </ActionForm>
  );
}

export function ExpenseForm({ custodyId, employeeId, remaining, minDate, today }: { custodyId: string; employeeId: string; remaining: number; minDate: string; today: string }) {
  const { d } = useI18n(); const c = d.custody;
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<'invoice' | 'no_invoice'>('invoice');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [fileName, setFileName] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get('amount'));
    const raw = fd.get('file');
    const description = String(fd.get('description') ?? '').trim();
    if (!amount || amount <= 0) return setMsg({ ok: false, text: d.errors.INVALID_AMOUNT });
    if (amount > remaining) return setMsg({ ok: false, text: d.errors.EXCEEDS_CUSTODY });
    if (kind === 'invoice' && !(raw instanceof File && raw.size)) return setMsg({ ok: false, text: c.fileRequired });
    if (kind === 'no_invoice' && !description) return setMsg({ ok: false, text: c.descRequired });
    setBusy(true);
    try {
      let attachment: string | null = null;
      if (raw instanceof File && raw.size) {
        const file = await prepareImage(raw);
        const ext = (file.name.split('.').pop() ?? '').toLowerCase();
        if (!['pdf', 'jpg', 'jpeg', 'png', 'webp'].includes(ext) || file.size > 10 * 1024 * 1024) throw new Error('INVALID_FILE');
        attachment = `${employeeId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await createClient().storage.from('hr-docs').upload(attachment, file, { contentType: file.type || undefined });
        if (error) throw new Error('INVALID_FILE');
      }
      const r = await addCustodyExpense({
        custody_id: custodyId, kind, category: String(fd.get('category')), amount, date: String(fd.get('date')),
        description, vendor: String(fd.get('vendor') ?? ''), invoice_no: String(fd.get('invoice_no') ?? ''), attachment,
      });
      if (r?.error) throw new Error(r.error);
      form.current?.reset(); setFileName(''); setKind('invoice');
      setMsg({ ok: true, text: c.saved });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: translateError(d, (err as Error).message) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={form} onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <div className="mb-2 text-[13px] font-medium text-ink/80">{c.kind}</div>
        <div className="inline-flex rounded-full bg-sand-100 p-1">
          {(['invoice', 'no_invoice'] as const).map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)}
              className={cx('h-9 rounded-full px-4 text-sm font-medium transition', kind === k ? 'bg-white text-brand shadow-sm' : 'text-ink/60')}>
              {c.kinds[k]}
            </button>
          ))}
        </div>
      </div>
      <Field label={c.category} required>
        <Select name="category" defaultValue={kind === 'no_invoice' ? 'labor' : 'materials'} key={kind}>
          {EXPENSE_CATEGORIES.map((k) => <option key={k} value={k}>{c.categories[k]}</option>)}
        </Select>
      </Field>
      <Field label={c.amount} required hint={`${c.remaining}: ${remaining.toLocaleString('en-US')}`}>
        <Input name="amount" type="number" inputMode="decimal" min={0.01} max={remaining} step="0.01" required dir="ltr" />
      </Field>
      <Field label={c.description} required={kind === 'no_invoice'} className="sm:col-span-2">
        <Input name="description" maxLength={300} placeholder={c.descriptionPh} required={kind === 'no_invoice'} />
      </Field>
      {kind === 'invoice' && (
        <>
          <Field label={c.vendor}><Input name="vendor" maxLength={120} /></Field>
          <Field label={c.invoiceNo}><Input name="invoice_no" maxLength={60} dir="ltr" /></Field>
        </>
      )}
      <Field label={c.date} required><Input name="date" type="date" required min={minDate} max={today} defaultValue={today} /></Field>
      <Field label={c.file} required={kind === 'invoice'}>
        <label className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-sand-300 bg-sand-50 px-3 text-sm text-ink/70 hover:border-brand/40">
          <Upload className="h-4 w-4" /><span className="truncate">{fileName || c.file}</span>
          <input type="file" name="file" accept=".pdf,image/*,.heic,.heif" className="sr-only" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')} />
        </label>
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={busy} className={buttonClass('primary')}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}{c.save}</button>
        {msg && <p role={msg.ok ? 'status' : 'alert'} className={cx('text-sm', msg.ok ? 'text-emerald-700' : 'text-rose-700')}>{msg.text}</p>}
      </div>
    </form>
  );
}

export function DeleteExpenseButton({ id }: { id: string }) {
  const { d } = useI18n();
  return (
    <ActionForm action={deleteCustodyExpense}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton size="sm" variant="ghost" className="h-8 px-2 text-rose-600" confirmText={`${d.custody.delete}?`}><Trash2 className="h-3.5 w-3.5" /></SubmitButton>
    </ActionForm>
  );
}

export function SettlementButton({ id }: { id: string }) {
  const { d } = useI18n();
  return (
    <ActionForm action={requestSettlement}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="outline" confirmText={d.custody.settleConfirm}>{d.custody.requestSettle}</SubmitButton>
    </ActionForm>
  );
}

// ------------------------------------------------------------------ HR
export function ReviewExpenseForm({ id }: { id: string }) {
  const { d } = useI18n(); const c = d.custody;
  const [rejecting, setRejecting] = useState(false);
  return (
    <ActionForm action={reviewExpense} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      {rejecting && <Input name="note" required placeholder={c.rejectReason} className="h-8 w-44 text-xs" autoFocus />}
      {!rejecting && <SubmitButton size="sm" name="decision" value="approve">{c.approve}</SubmitButton>}
      {rejecting
        ? <SubmitButton size="sm" variant="danger" name="decision" value="reject">{c.reject}</SubmitButton>
        : <button type="button" onClick={() => setRejecting(true)} className={buttonClass('ghost', 'sm', 'text-rose-700')}>{c.reject}</button>}
    </ActionForm>
  );
}

export function CloseCustodyForm({ id, remaining }: { id: string; remaining: number }) {
  const { d } = useI18n(); const c = d.custody;
  return (
    <ActionForm action={closeCustody} className="grid gap-3 sm:grid-cols-3">
      <input type="hidden" name="id" value={id} />
      <p className="text-sm text-stone-450 sm:col-span-3">{c.closeHint.replace('{n}', remaining.toLocaleString('en-US'))}</p>
      <Field label={c.returnedAmount}><Input name="returned" type="number" min={0} max={remaining} step="0.01" defaultValue={remaining} dir="ltr" /></Field>
      <Field label={c.closeNote} className="sm:col-span-2"><Input name="note" maxLength={200} /></Field>
      <div className="sm:col-span-3"><SubmitButton confirmText={`${c.close}?`}>{c.close}</SubmitButton></div>
    </ActionForm>
  );
}

type Step = { kind: string; employee_id?: string; min_amount?: number | null };
export function ApprovalChainEditor({ initial, max, people }: { initial: Step[]; max: number; people: { id: string; full_name: string; job_title: string | null }[] }) {
  const { d } = useI18n(); const c = d.custody;
  const router = useRouter();
  const [steps, setSteps] = useState<Step[]>(initial.length ? initial : [{ kind: 'manager' }, { kind: 'hr' }]);
  const [maxAmount, setMax] = useState(String(max));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const kinds = ['manager', 'manager2', 'dept_manager', 'hr', 'employee'] as const;
  const set = (i: number, p: Partial<Step>) => setSteps(steps.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const move = (i: number, dir: -1 | 1) => { const n = [...steps]; const [x] = n.splice(i, 1); n.splice(i + dir, 0, x); setSteps(n); };

  async function save() {
    setBusy(true); setMsg(null);
    const r = await saveApprovalChain(steps, Number(maxAmount) || null);
    setBusy(false);
    setMsg(r?.error ? { ok: false, text: r.error } : { ok: true, text: c.chainSaved });
    if (!r?.error) router.refresh();
  }

  return (
    <div className="space-y-4">
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={i} className="flex flex-wrap items-end gap-2 rounded-xl border border-sand-200 bg-white p-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-white">{i + 1}</span>
            <Field label={c.kind} className="min-w-40 flex-1">
              <Select value={s.kind} onChange={(e) => set(i, { kind: e.target.value, employee_id: undefined })}>
                {kinds.map((k) => <option key={k} value={k}>{c.stepKinds[k]}</option>)}
              </Select>
            </Field>
            {s.kind === 'employee' && (
              <Field label={c.person} className="min-w-48 flex-1">
                <Select value={s.employee_id ?? ''} onChange={(e) => set(i, { employee_id: e.target.value })}>
                  <option value="" disabled>—</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}{p.job_title ? ` — ${p.job_title}` : ''}</option>)}
                </Select>
              </Field>
            )}
            <Field label={c.minAmount} className="w-36">
              <Input type="number" min={0} value={s.min_amount ?? ''} onChange={(e) => set(i, { min_amount: e.target.value ? Number(e.target.value) : null })} dir="ltr" />
            </Field>
            <div className="flex gap-1">
              <button type="button" aria-label="up" disabled={i === 0} onClick={() => move(i, -1)} className={buttonClass('ghost', 'sm', 'h-9 w-9 p-0')}><ArrowUp className="h-4 w-4" /></button>
              <button type="button" aria-label="down" disabled={i === steps.length - 1} onClick={() => move(i, 1)} className={buttonClass('ghost', 'sm', 'h-9 w-9 p-0')}><ArrowDown className="h-4 w-4" /></button>
              <button type="button" aria-label="remove" disabled={steps.length === 1} onClick={() => setSteps(steps.filter((_, j) => j !== i))} className={buttonClass('ghost', 'sm', 'h-9 w-9 p-0 text-rose-600')}><Trash2 className="h-4 w-4" /></button>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-end gap-3">
        <button type="button" disabled={steps.length >= 6} onClick={() => setSteps([...steps, { kind: 'hr' }])} className={buttonClass('outline', 'sm')}><Plus className="h-4 w-4" />{c.addStep}</button>
        <Field label={c.maxAmount} className="w-44"><Input type="number" min={1} value={maxAmount} onChange={(e) => setMax(e.target.value)} dir="ltr" /></Field>
        <button type="button" onClick={save} disabled={busy} className={buttonClass('primary')}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{c.saveChain}</button>
        {msg && <span className={cx('text-sm', msg.ok ? 'text-emerald-700' : 'text-rose-700')}>{msg.text}</span>}
      </div>
    </div>
  );
}

