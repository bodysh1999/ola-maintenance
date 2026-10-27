'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, Plus, Send, ShoppingCart, Trash2, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { translateError } from '@/lib/i18n';
import { prepareImage } from '@/lib/image';
import { addQuote, createPurchase, decidePurchase, markPurchased, saveSupplier, setMember } from '@/app/actions/procurement';
import { ActionForm, SubmitButton, useI18n } from './client';
import { Field, Input, Select, Textarea, buttonClass, cx } from './ui';

const sar = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

async function uploadProcFile(requestId: string, raw: File): Promise<string> {
  const file = await prepareImage(raw);
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  if (!['pdf', 'jpg', 'jpeg', 'png', 'webp'].includes(ext) || file.size > 10 * 1024 * 1024) throw new Error('INVALID_FILE');
  const path = `${requestId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await createClient().storage.from('procurement').upload(path, file, { contentType: file.type || undefined });
  if (error) throw new Error('INVALID_FILE');
  return path;
}

function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return <p role={msg.ok ? 'status' : 'alert'} className={cx('text-sm', msg.ok ? 'text-emerald-700' : 'text-rose-700')}>{msg.text}</p>;
}

function FilePick({ name, label, required }: { name: string; label: string; required?: boolean }) {
  const [fileName, setFileName] = useState('');
  return (
    <Field label={label} required={required}>
      <label className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-sand-300 bg-sand-50 px-3 text-sm text-ink/70 hover:border-brand/40">
        <Upload className="h-4 w-4 shrink-0" /><span className="truncate">{fileName || label}</span>
        <input type="file" name={name} accept=".pdf,image/*,.heic,.heif" className="sr-only" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')} />
      </label>
    </Field>
  );
}

// ------------------------------------------------------------------ new request
type Opt = { id: string; name: string };
type Line = { key: string; name: string; qty: string; unit: string };
const newLine = (): Line => ({ key: crypto.randomUUID(), name: '', qty: '1', unit: '' });

export function NewPurchaseForm({ projects, reps, defaultQuotes, today }: { projects: Opt[]; reps: Opt[]; defaultQuotes: number; today: string }) {
  const { d } = useI18n(); const p = d.proc;
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === k ? { ...l, ...patch } : l)));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const r = await createPurchase({
      title: String(fd.get('title') ?? ''), description: String(fd.get('description') ?? ''), needed_by: String(fd.get('needed_by') ?? ''),
      project_id: String(fd.get('project') ?? ''), rep_id: String(fd.get('rep') ?? ''), quotes: Number(fd.get('quotes')) || defaultQuotes,
      items: lines.map((l) => ({ name: l.name, qty: Number(l.qty) || 1, unit: l.unit })),
    });
    setBusy(false);
    if (r.error) return setMsg({ ok: false, text: r.error });
    if (r.id) router.push(`/procurement/${r.id}`);
    else setMsg({ ok: true, text: r.message ?? d.common.saved });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <Field label={p.reqTitle} required><Input name="title" required maxLength={200} placeholder={p.reqTitlePh} /></Field>

      <div>
        <div className="mb-2 text-[13px] font-medium text-ink/80">{p.items} <span className="text-rose-600">*</span></div>
        <div className="grid gap-2">
          {lines.map((l, i) => (
            <div key={l.key} className="grid grid-cols-[minmax(0,1fr)_88px_110px_40px] items-center gap-2">
              <Input aria-label={`${p.itemName} ${i + 1}`} placeholder={p.itemName} value={l.name} maxLength={200} onChange={(e) => set(l.key, { name: e.target.value })} required={i === 0} />
              <Input aria-label={p.qty} type="number" inputMode="decimal" min={0.01} step="0.01" dir="ltr" value={l.qty} onChange={(e) => set(l.key, { qty: e.target.value })} />
              <Input aria-label={p.unit} placeholder={p.unitPh} value={l.unit} maxLength={30} onChange={(e) => set(l.key, { unit: e.target.value })} />
              <button type="button" aria-label={d.common.delete} disabled={lines.length === 1}
                onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                className="grid h-10 w-10 place-items-center rounded-lg text-stone-450 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-30">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setLines((ls) => [...ls, newLine()])} className={cx(buttonClass('ghost', 'sm'), 'mt-2')}>
          <Plus className="h-4 w-4" /> {p.addItem}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={p.neededBy}><Input name="needed_by" type="date" min={today} /></Field>
        <Field label={p.project}>
          <Select name="project" defaultValue="">
            <option value="">{p.noProject}</option>
            {projects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </Select>
        </Field>
        <Field label={p.rep}>
          <Select name="rep" defaultValue="">
            <option value="">{p.repAuto}</option>
            {reps.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </Select>
        </Field>
        <Field label={p.quotesRequired}>
          <Select name="quotes" defaultValue={String(defaultQuotes)}>
            {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </Field>
      </div>
      <Field label={p.description}><Textarea name="description" rows={3} maxLength={3000} /></Field>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className={buttonClass('primary')}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="flip-rtl h-4 w-4" />} {p.submitNew}
        </button>
        <Msg msg={msg} />
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ buyer: add a quotation
export function AddQuoteForm({ requestId, suppliers, nextNo }: { requestId: string; suppliers: Opt[]; nextNo: number }) {
  const { d } = useI18n(); const p = d.proc;
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [mode, setMode] = useState<'pick' | 'new'>(suppliers.length ? 'pick' : 'new');
  const [vat, setVat] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get('amount'));
    if (!amount || amount <= 0) return setMsg({ ok: false, text: d.errors.INVALID_AMOUNT });
    setBusy(true);
    try {
      const raw = fd.get('file');
      const file = raw instanceof File && raw.size ? await uploadProcFile(requestId, raw) : null;
      const r = await addQuote({
        request_id: requestId,
        supplier_id: mode === 'pick' ? String(fd.get('supplier') ?? '') : undefined,
        new_supplier: mode === 'new' ? { name: String(fd.get('sup_name') ?? ''), phone: String(fd.get('sup_phone') ?? ''), category: String(fd.get('sup_category') ?? '') } : null,
        amount, vat_included: vat, delivery_days: fd.get('delivery') ? Number(fd.get('delivery')) : null,
        valid_until: String(fd.get('valid_until') ?? '') || null, file, notes: String(fd.get('notes') ?? ''),
      });
      if (r?.error) throw new Error(r.error);
      form.current?.reset(); setVat(true);
      setMsg({ ok: true, text: p.quoteAdded });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: translateError(d, (err as Error).message) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={form} onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-brand">{p.quoteNo.replace('{n}', String(nextNo))}</span>
        <div className="inline-flex rounded-full bg-sand-100 p-1">
          {(['pick', 'new'] as const).map((k) => (
            <button key={k} type="button" onClick={() => setMode(k)} disabled={k === 'pick' && !suppliers.length}
              className={cx('h-8 rounded-full px-3 text-sm font-medium transition disabled:opacity-40', mode === k ? 'bg-white text-brand shadow-sm' : 'text-ink/60')}>
              {k === 'pick' ? p.pickSupplier : p.newSupplier}
            </button>
          ))}
        </div>
      </div>
      {mode === 'pick' ? (
        <Field label={p.supplier} required className="sm:col-span-2">
          <Select name="supplier" required defaultValue="">
            <option value="" disabled>{p.pickSupplier}</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
      ) : (
        <>
          <Field label={p.supName} required><Input name="sup_name" required maxLength={160} /></Field>
          <Field label={p.phone}><Input name="sup_phone" maxLength={30} dir="ltr" inputMode="tel" /></Field>
          <Field label={p.category} className="sm:col-span-2"><Input name="sup_category" maxLength={80} /></Field>
        </>
      )}
      <Field label={p.amount} required>
        <Input name="amount" type="number" inputMode="decimal" min={0.01} step="0.01" required dir="ltr" />
      </Field>
      <div>
        <div className="mb-2 text-[13px] font-medium text-ink/80">{p.vat}</div>
        <div className="inline-flex rounded-full bg-sand-100 p-1">
          {[true, false].map((v) => (
            <button key={String(v)} type="button" onClick={() => setVat(v)}
              className={cx('h-9 rounded-full px-3 text-sm font-medium transition', vat === v ? 'bg-white text-brand shadow-sm' : 'text-ink/60')}>
              {v ? p.vatIncluded : p.vatExcluded}
            </button>
          ))}
        </div>
      </div>
      <Field label={p.deliveryDays}><Input name="delivery" type="number" min={0} max={365} inputMode="numeric" dir="ltr" /></Field>
      <Field label={p.validUntil}><Input name="valid_until" type="date" /></Field>
      <FilePick name="file" label={p.quoteFile} />
      <Field label={p.notes}><Input name="notes" maxLength={500} /></Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={busy} className={buttonClass('primary')}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {p.addQuote}
        </button>
        <Msg msg={msg} />
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ approver: pick the winning quotation
type QuoteOpt = { id: string; no: number; supplier: string; amount: number; locked: boolean };
export function DecisionForm({ requestId, quotes, lowestId }: { requestId: string; quotes: QuoteOpt[]; lowestId: string | null }) {
  const { d } = useI18n(); const p = d.proc;
  const [pick, setPick] = useState<string>(quotes.find((q) => q.id === lowestId && !q.locked)?.id ?? '');
  return (
    <ActionForm action={decidePurchase} className="grid gap-4">
      <input type="hidden" name="id" value={requestId} />
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm text-stone-450">{p.decideHint}</legend>
        {quotes.map((q) => (
          <label key={q.id} className={cx('flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition',
            pick === q.id ? 'border-brand bg-brand/[.04] ring-1 ring-brand' : 'border-sand-200 hover:border-sand-300', q.locked && 'cursor-not-allowed opacity-50')}>
            <input type="radio" name="quote" value={q.id} checked={pick === q.id} disabled={q.locked} onChange={() => setPick(q.id)} className="h-4 w-4 text-brand focus:ring-brand" />
            <span className="text-sm font-semibold text-brand">{p.quoteNo.replace('{n}', String(q.no))}</span>
            <span className="min-w-0 flex-1 truncate text-sm">{q.supplier}</span>
            {q.id === lowestId && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{p.lowest}</span>}
            <span className="text-sm font-semibold tabular-nums" dir="ltr">{sar(q.amount)}</span>
          </label>
        ))}
      </fieldset>
      <Field label={p.decisionNote}><Input name="note" maxLength={500} /></Field>
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="decision" value="approve"><CheckCircle2 className="h-4 w-4" /> {p.approve}</SubmitButton>
        <SubmitButton name="decision" value="return" variant="outline">{p.returnBtn}</SubmitButton>
        <SubmitButton name="decision" value="reject" variant="ghost" className="text-rose-700">{p.rejectBtn}</SubmitButton>
      </div>
    </ActionForm>
  );
}

// ------------------------------------------------------------------ buyer: confirm the purchase
export function PurchasedForm({ requestId, amount }: { requestId: string; amount: number }) {
  const { d } = useI18n(); const p = d.proc;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const raw = fd.get('invoice');
    if (!(raw instanceof File && raw.size)) return setMsg({ ok: false, text: d.errors.ATTACHMENT_REQUIRED });
    setBusy(true);
    try {
      const invoice = await uploadProcFile(requestId, raw);
      const r = await markPurchased({ request_id: requestId, amount: Number(fd.get('amount')), invoice, note: String(fd.get('note') ?? '') });
      if (r?.error) throw new Error(r.error);
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: translateError(d, (err as Error).message) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <Field label={p.actualAmount} required>
        <Input name="amount" type="number" inputMode="decimal" min={0.01} step="0.01" required dir="ltr" defaultValue={amount} />
      </Field>
      <FilePick name="invoice" label={p.invoice} required />
      <Field label={p.notes} className="sm:col-span-2"><Input name="note" maxLength={500} /></Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={busy} className={buttonClass('primary')}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />} {p.markPurchased}
        </button>
        <Msg msg={msg} />
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ suppliers & settings
export type SupplierInit = { id?: string; name?: string; category?: string | null; contact_name?: string | null; phone?: string | null;
  email?: string | null; cr_no?: string | null; vat_no?: string | null; notes?: string | null; is_active?: boolean };
export function SupplierForm({ init }: { init?: SupplierInit }) {
  const { d } = useI18n(); const p = d.proc;
  return (
    <ActionForm action={saveSupplier} resetOnSuccess={!init?.id} className="grid gap-4 sm:grid-cols-2">
      {init?.id && <input type="hidden" name="id" value={init.id} />}
      <Field label={p.supName} required><Input name="name" required maxLength={160} defaultValue={init?.name} /></Field>
      <Field label={p.category}><Input name="category" maxLength={80} defaultValue={init?.category ?? ''} /></Field>
      <Field label={p.contact}><Input name="contact" maxLength={120} defaultValue={init?.contact_name ?? ''} /></Field>
      <Field label={p.phone}><Input name="phone" maxLength={30} dir="ltr" inputMode="tel" defaultValue={init?.phone ?? ''} /></Field>
      <Field label={p.email}><Input name="email" type="email" maxLength={160} dir="ltr" defaultValue={init?.email ?? ''} /></Field>
      <Field label={p.crNo}><Input name="cr_no" maxLength={30} dir="ltr" defaultValue={init?.cr_no ?? ''} /></Field>
      <Field label={p.vatNo}><Input name="vat_no" maxLength={30} dir="ltr" defaultValue={init?.vat_no ?? ''} /></Field>
      <Field label={p.notes}><Input name="notes" maxLength={1000} defaultValue={init?.notes ?? ''} /></Field>
      {init?.id && (
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="inactive" value="1" defaultChecked={init.is_active === false} className="h-4 w-4 rounded border-sand-300 text-brand focus:ring-brand" />
          {p.inactive}
        </label>
      )}
      <div className="sm:col-span-2"><SubmitButton>{init?.id ? p.saveSupplier : p.addSupplier}</SubmitButton></div>
    </ActionForm>
  );
}

export function MemberForm({ people }: { people: Opt[] }) {
  const { d } = useI18n(); const p = d.proc;
  return (
    <ActionForm action={setMember} resetOnSuccess className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-end">
      <Field label={p.person} required>
        <Select name="profile" required defaultValue="">
          <option value="" disabled>{p.person}</option>
          {people.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </Select>
      </Field>
      <Field label={d.common.status} required>
        <Select name="role" required defaultValue="rep">
          <option value="rep">{p.memberRoles.rep}</option>
          <option value="approver">{p.memberRoles.approver}</option>
        </Select>
      </Field>
      <SubmitButton>{p.addMember}</SubmitButton>
    </ActionForm>
  );
}
