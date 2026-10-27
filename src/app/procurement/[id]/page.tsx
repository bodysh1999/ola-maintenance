import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Award, CalendarClock, Check, ExternalLink, FileText, Phone, ShoppingCart, Trash2, Truck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n, requireRole } from '@/lib/session';
import { STAFF_ROLES } from '@/lib/hr';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { fmt } from '@/lib/i18n';
import { PURCHASE_TONE, money, type ProcRole, type PurchaseRow, type PurchaseStatus } from '@/lib/procurement';
import { cancelPurchase, deleteQuote, submitQuotes } from '@/app/actions/procurement';
import { ActionForm, SubmitButton } from '@/components/client';
import { Alert, Badge, Card, CardHeader, Field, Input, PageHeader, cx } from '@/components/ui';
import { AddQuoteForm, DecisionForm, PurchasedForm } from '@/components/procurement-client';

type Quote = {
  id: string; quote_no: number; amount: number; vat_included: boolean; delivery_days: number | null; valid_until: string | null;
  file_path: string | null; notes: string | null; created_at: string; supplier_id: string;
  suppliers: { name: string; phone: string | null; category: string | null } | null;
};

const STEP_OF: Record<PurchaseStatus, number> = { quoting: 1, pending_approval: 2, approved: 3, purchased: 4, rejected: 2, cancelled: 0 };

export default async function PurchaseDetail({ params }: { params: Promise<{ id: string }> }) {
  const [{ d, locale }, supabase, { id }, me] = await Promise.all([getI18n(), createClient(), params, requireRole([...STAFF_ROLES])]);
  const p = d.proc;
  const { data: row } = await supabase.from('purchase_overview').select('*').eq('id', id).maybeSingle();
  if (!row) notFound();
  const r = row as PurchaseRow;
  const [{ data: items }, { data: qs }, { data: roleData }, { data: settings }] = await Promise.all([
    supabase.from('purchase_items').select('id, position, name, qty, unit').eq('request_id', id).order('position'),
    supabase.from('purchase_quotes').select('id, quote_no, amount, vat_included, delivery_days, valid_until, file_path, notes, created_at, supplier_id, suppliers(name, phone, category)').eq('request_id', id).order('quote_no'),
    supabase.rpc('proc_role'),
    supabase.from('procurement_settings').select('admin_threshold').eq('id', 1).maybeSingle(),
  ]);
  const role = (roleData ?? null) as ProcRole;
  const quotes = (qs ?? []) as unknown as Quote[];
  const isRep = r.rep_id === me.id || role === 'admin';
  const canDecide = (role === 'admin' || role === 'approver') && (r.rep_id !== me.id || role === 'admin');
  const canCancel = ['quoting', 'pending_approval'].includes(r.status) && (r.requested_by === me.id || role === 'admin' || role === 'approver');
  const threshold = settings?.admin_threshold != null ? Number(settings.admin_threshold) : null;
  const lowest = quotes.length ? quotes.reduce((a, b) => (Number(b.amount) < Number(a.amount) ? b : a)) : null;

  // short-lived links to the private files (quotations, invoice)
  const sign = async (path: string | null) => {
    if (!path) return null;
    const { data } = await supabase.storage.from('procurement').createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  };
  const [fileUrls, invoiceUrl] = await Promise.all([Promise.all(quotes.map((q) => sign(q.file_path))), sign(r.invoice_path)]);

  let suppliers: { id: string; name: string }[] = [];
  if (isRep && r.status === 'quoting') {
    const { data } = await supabase.from('suppliers').select('id, name').eq('is_active', true).order('name');
    const used = new Set(quotes.map((q) => q.supplier_id));
    suppliers = (data ?? []).filter((s) => !used.has(s.id));
  }

  const step = STEP_OF[r.status];
  const steps = [p.steps.request, p.steps.quotes, p.steps.approval, p.steps.purchase];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow={<Link href="/procurement" className="hover:underline">{p.title}</Link>}
        title={r.title}
        subtitle={<span className="inline-flex flex-wrap items-center gap-2"><span className="font-mono" dir="ltr">{r.ref_no}</span><Badge className={PURCHASE_TONE[r.status]}>{p.statuses[r.status]}</Badge></span>}
        actions={canCancel ? (
          <ActionForm action={cancelPurchase}>
            <input type="hidden" name="id" value={r.id} />
            <SubmitButton variant="ghost" className="text-rose-700" confirmText={p.cancelConfirm}>{p.cancel}</SubmitButton>
          </ActionForm>
        ) : undefined}
      />

      {/* progress */}
      {r.status !== 'cancelled' && (
        <ol className="mb-6 grid grid-cols-4 gap-2" aria-label={p.status}>
          {steps.map((s, i) => {
            const done = step > i + 1 || (r.status === 'purchased' && i === 3);
            const current = step === i + 1 && r.status !== 'purchased';
            return (
              <li key={s} className="flex flex-col gap-1.5">
                <span className={cx('h-1.5 rounded-full', done ? 'bg-brand' : current ? (r.status === 'rejected' ? 'bg-rose-400' : 'bg-accent') : 'bg-sand-200')} />
                <span className={cx('flex items-center gap-1 text-xs', done || current ? 'font-medium text-ink' : 'text-stone-450')}>
                  {done && <Check className="h-3.5 w-3.5 text-brand" />}{s}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {/* the buyer's instruction after approval */}
      {r.status === 'approved' && r.chosen_supplier && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl bg-brand p-5 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-accent"><Award className="h-5 w-5" /></span>
            <div>
              <div className="text-lg font-semibold">{fmt(p.buyFrom, { supplier: r.chosen_supplier })}</div>
              <div className="text-sm text-white/75">{fmt(p.buyFromHint, { n: r.chosen_no, amount: money(r.chosen_amount) })}{r.decider_name ? ` · ${fmt(p.decisionBy, { name: r.decider_name })}` : ''}</div>
              {r.decision_note && <div className="mt-1 text-sm text-white/85">“{r.decision_note}”</div>}
            </div>
          </div>
          {r.chosen_supplier_phone && (
            <a href={`tel:${r.chosen_supplier_phone}`} className="inline-flex h-10 items-center gap-2 self-start rounded-full bg-white/10 px-4 text-sm hover:bg-white/20" dir="ltr">
              <Phone className="h-4 w-4" />{r.chosen_supplier_phone}
            </a>
          )}
        </div>
      )}
      {r.status === 'purchased' && (
        <Alert tone="success" className="mb-6">
          <span className="font-medium">{fmt(p.purchasedOn, { date: fmtDate(r.purchased_at, locale), amount: money(r.purchased_amount) })}</span>
          {r.chosen_supplier && <> — {r.chosen_supplier}</>}
          {invoiceUrl && <> · <a href={invoiceUrl} target="_blank" rel="noreferrer" className="underline">{p.viewInvoice}</a></>}
        </Alert>
      )}
      {(r.status === 'rejected' || r.status === 'cancelled' || (r.status === 'quoting' && r.decision_note)) && r.decision_note && (
        <Alert tone={r.status === 'quoting' ? 'warn' : 'error'} className="mb-6">
          {r.decider_name ? `${fmt(p.decisionBy, { name: r.decider_name })}: ` : ''}{r.decision_note}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid min-w-0 gap-6">
          {/* quotations side by side */}
          <Card>
            <CardHeader title={p.quotes} subtitle={fmt(p.quotesOf, { n: quotes.length, m: r.quotes_required })} />
            {quotes.length ? (
              <div className="grid gap-3 p-4 pt-0 sm:grid-cols-2 xl:grid-cols-3">
                {quotes.map((q, i) => {
                  const chosen = q.id === r.chosen_quote_id;
                  const isLow = lowest?.id === q.id && quotes.length > 1;
                  return (
                    <div key={q.id} className={cx('flex flex-col gap-2 rounded-2xl border p-4', chosen ? 'border-brand bg-brand/[.03] ring-1 ring-brand' : 'border-sand-200')}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-brand">{fmt(p.quoteNo, { n: q.quote_no })}</span>
                        <span className="flex gap-1">
                          {isLow && <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">{p.lowest}</Badge>}
                          {chosen && <Badge className="bg-brand text-white ring-brand">{p.chosen}</Badge>}
                        </span>
                      </div>
                      <div className="truncate font-medium" title={q.suppliers?.name}>{q.suppliers?.name}</div>
                      <div className="text-2xl font-semibold tabular-nums" dir="ltr">{money(q.amount)} <span className="text-xs font-normal text-stone-450">{d.common.sar}</span></div>
                      <div className="text-xs text-stone-450">{q.vat_included ? p.vatIncluded : p.vatExcluded}</div>
                      <div className="mt-1 grid gap-1 text-xs text-ink/75">
                        {q.delivery_days != null && <span className="inline-flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" />{q.delivery_days} {p.days}</span>}
                        {q.valid_until && <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" />{p.validUntil} {fmtDate(q.valid_until, locale)}</span>}
                        {q.notes && <span className="line-clamp-2">{q.notes}</span>}
                      </div>
                      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                        {fileUrls[i] ? (
                          <a href={fileUrls[i]!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                            <FileText className="h-3.5 w-3.5" />{p.viewFile}<ExternalLink className="h-3 w-3" />
                          </a>
                        ) : <span />}
                        {isRep && r.status === 'quoting' && (
                          <ActionForm action={deleteQuote}>
                            <input type="hidden" name="id" value={q.id} />
                            <SubmitButton variant="ghost" size="sm" className="text-rose-700"><Trash2 className="h-3.5 w-3.5" /> {p.removeQuote}</SubmitButton>
                          </ActionForm>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <p className="px-5 pb-6 text-sm text-stone-450">{d.common.noData}</p>}
          </Card>

          {/* buyer: add quotations, then submit */}
          {isRep && r.status === 'quoting' && (
            <>
              {quotes.length < 6 && (
                <Card className="p-5">
                  <h2 className="mb-4 font-semibold">{p.addQuote}</h2>
                  <AddQuoteForm requestId={r.id} suppliers={suppliers} nextNo={quotes.length + 1} />
                </Card>
              )}
              {quotes.length > 0 && (
                <Card className="p-5">
                  <h2 className="mb-1 font-semibold">{p.submitQuotes}</h2>
                  {quotes.length < r.quotes_required && <p className="mb-3 text-sm text-amber-700">{fmt(p.fewerHint, { m: r.quotes_required })}</p>}
                  <ActionForm action={submitQuotes} className="grid gap-3">
                    <input type="hidden" name="id" value={r.id} />
                    {quotes.length < r.quotes_required && <Field label={p.fewerNote} required><Input name="note" required maxLength={500} /></Field>}
                    <div><SubmitButton>{p.submitQuotes}</SubmitButton></div>
                  </ActionForm>
                </Card>
              )}
            </>
          )}

          {/* approver */}
          {canDecide && r.status === 'pending_approval' && (
            <Card className="p-5">
              <h2 className="mb-1 font-semibold">{p.decide}</h2>
              {r.submit_note && <p className="mb-3 text-sm text-ink/75">{p.submitNote}: {r.submit_note}</p>}
              {threshold != null && role !== 'admin' && <p className="mb-3 text-xs text-amber-700">{fmt(p.thresholdHint, { amount: money(threshold) })}</p>}
              <DecisionForm
                requestId={r.id}
                lowestId={lowest?.id ?? null}
                quotes={quotes.map((q) => ({ id: q.id, no: q.quote_no, supplier: q.suppliers?.name ?? '—', amount: Number(q.amount),
                  locked: role !== 'admin' && threshold != null && Number(q.amount) >= threshold }))}
              />
            </Card>
          )}

          {/* buyer confirms the purchase */}
          {isRep && r.status === 'approved' && (
            <Card className="p-5">
              <h2 className="mb-4 flex items-center gap-2 font-semibold"><ShoppingCart className="h-4 w-4 text-brand" />{p.markPurchased}</h2>
              <PurchasedForm requestId={r.id} amount={Number(r.chosen_amount ?? 0)} />
            </Card>
          )}
        </div>

        {/* request details */}
        <aside className="grid content-start gap-6">
          <Card>
            <CardHeader title={p.items} />
            <ul className="divide-y divide-sand-100 px-5 pb-3">
              {(items ?? []).map((it) => (
                <li key={it.id} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0">{it.name}</span>
                  <span className="shrink-0 tabular-nums text-ink/70">{Number(it.qty).toLocaleString('en-US')} {it.unit ?? ''}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="grid gap-3 p-5 text-sm">
            <div className="flex justify-between gap-3"><span className="text-stone-450">{p.requester}</span><span className="text-end">{r.requester_name ?? '—'}</span></div>
            <div className="flex justify-between gap-3"><span className="text-stone-450">{p.rep}</span><span className="text-end">{r.rep_name ?? '—'}</span></div>
            {r.project_name && <div className="flex justify-between gap-3"><span className="text-stone-450">{p.project}</span><span className="text-end">{r.project_name}</span></div>}
            {r.needed_by && <div className="flex justify-between gap-3"><span className="text-stone-450">{p.neededBy}</span><span>{fmtDate(r.needed_by, locale)}</span></div>}
            <div className="flex justify-between gap-3"><span className="text-stone-450">{d.common.date}</span><span>{fmtDateTime(r.created_at, locale)}</span></div>
            {r.description && <p className="whitespace-pre-line border-t border-sand-100 pt-3 text-ink/80">{r.description}</p>}
          </Card>
        </aside>
      </div>
    </div>
  );
}
