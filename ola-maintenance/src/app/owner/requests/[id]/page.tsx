import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarClock, CheckCircle2, ChevronRight, Phone, Receipt, Star, UserRound } from 'lucide-react';
import { getI18n, requireRole } from '@/lib/session';
import { loadRequest } from '@/lib/queries';
import { fmtDate, fmtDateTime, fmtMoney, fmtVisit } from '@/lib/format';
import { Alert, Badge, Card, CardHeader, KeyValue } from '@/components/ui';
import { StatusBadge, WarrantyBadge } from '@/components/badges';
import { CategoryIcon } from '@/components/category-icon';
import { AttachmentGrid, NotesList, RequestProgress, Timeline } from '@/components/request-parts';
import { Uploader } from '@/components/uploader';
import { NoteForm } from '@/components/note-form';
import { QuoteResponse, RatingForm, ReopenForm } from './owner-actions';

export default async function OwnerRequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const profile = await requireRole(['owner']);
  const [{ id }, sp, { d, locale }] = await Promise.all([params, searchParams, getI18n()]);
  const data = await loadRequest(id);
  if (!data) notFound();
  const { request: r, logs, attachments, notes, quotes, rating, lastMainStatus } = data;
  const open = !['completed', 'rejected'].includes(r.status);
  const pendingQuote = quotes.find((q) => q.status === 'pending');
  const latestQuote = quotes[0];

  return (
    <div className="space-y-6">
      <Link href="/owner" className="inline-flex items-center gap-1 text-sm text-stone-450 hover:text-ink">
        <ChevronRight className="h-4 w-4 ltr:rotate-180" /> {d.nav.home}
      </Link>

      {sp.created && (
        <Card className="overflow-hidden border-emerald-200">
          <div className="flex flex-col items-center gap-2 bg-emerald-50/60 px-6 py-8 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-600 text-white"><CheckCircle2 className="h-7 w-7" /></div>
            <h1 className="mt-2 text-xl font-semibold">{d.newReq.successTitle}</h1>
            <p className="max-w-md text-sm text-ink/70">{d.newReq.successBody}</p>
            <div className="mt-3 rounded-xl border border-emerald-200 bg-white px-5 py-2.5">
              <span className="text-xs text-stone-450">{d.newReq.refNo}</span>
              <div className="font-mono text-xl font-semibold tracking-wider" dir="ltr">{r.ref_no}</div>
            </div>
          </div>
        </Card>
      )}

      {/* header */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand text-accent"><CategoryIcon category={r.category} className="h-6 w-6" /></div>
            <div>
              <div className="font-mono text-xs text-stone-450" dir="ltr">{r.ref_no}</div>
              <h1 className="text-xl font-semibold">{d.category[r.category]} · {r.location_in_unit}</h1>
              <div className="mt-1 text-sm text-stone-450">
                {locale === 'en' && r.project_name_en ? r.project_name_en : r.project_name_ar} · {d.owner.building} {r.building_name} · {d.owner.unit} {r.unit_number}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <WarrantyBadge state={r.warranty_state} d={d} />
            <StatusBadge status={r.status} d={d} />
          </div>
        </div>
        <div className="mt-6 border-t border-sand-100 pt-6">
          <RequestProgress status={r.status} d={d} lastMainStatus={lastMainStatus} />
          {r.status === 'rejected' && r.reject_reason && <p className="mt-2 text-sm text-rose-800">{d.req.reason}: {r.reject_reason}</p>}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Quote needing approval */}
          {latestQuote && latestQuote.status !== 'cancelled' && (
            <Card className={pendingQuote ? 'border-accent/50 ring-4 ring-accent/10' : ''}>
              <CardHeader title={<span className="flex items-center gap-2"><Receipt className="h-4 w-4 text-accent" />{d.req.quoteTitle}</span>}
                action={<Badge className="bg-sand-100 text-ink/70 ring-sand-200">{d.req.quoteStatus[latestQuote.status]}</Badge>} />
              <div className="p-5">
                {pendingQuote && <p className="mb-3 text-sm text-ink/70">{d.req.quoteNote}</p>}
                <p className="whitespace-pre-wrap text-sm">{latestQuote.description}</p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-2xl font-semibold tabular-nums">{fmtMoney(Number(latestQuote.amount) * (1 + Number(latestQuote.vat_rate) / 100), locale)}</span>
                  <span className="text-xs text-stone-450">{d.req.vat} ({latestQuote.vat_rate}%)</span>
                </div>
                {pendingQuote && <QuoteResponse quoteId={pendingQuote.id} />}
              </div>
            </Card>
          )}

          {/* Rating / reopen */}
          {r.status === 'completed' && (
            <Card>
              <div className="p-5 text-center">
                {rating ? (
                  <>
                    <div className="flex justify-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`h-6 w-6 ${rating.score >= n ? 'fill-accent text-accent' : 'text-sand-300'}`} />)}
                    </div>
                    <p className="mt-2 font-medium">{d.req.rated}</p>
                    {rating.comment && <p className="mt-1 text-sm text-stone-450">“{rating.comment}”</p>}
                  </>
                ) : (
                  <>
                    <h2 className="text-lg font-semibold">{d.req.rateTitle}</h2>
                    <p className="text-sm text-stone-450">{d.req.rateSub}</p>
                    <div className="mx-auto mt-2 max-w-sm"><RatingForm requestId={r.id} /></div>
                  </>
                )}
                <div className="mt-5 border-t border-sand-100 pt-4 text-start"><ReopenForm requestId={r.id} /></div>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title={d.common.details} />
            <div className="divide-y divide-sand-100 px-5">
              <KeyValue label={d.req.created}>{fmtDateTime(r.created_at, locale)}</KeyValue>
              <KeyValue label={d.req.preferred}>{r.preferred_date ? `${fmtDate(r.preferred_date, locale)}${r.preferred_slot ? ` · ${d.slot[r.preferred_slot]}` : ''}` : '—'}</KeyValue>
              {r.completed_at && <KeyValue label={d.req.completedOn}>{fmtDateTime(r.completed_at, locale)}</KeyValue>}
            </div>
            <div className="px-5 pb-5 pt-2">
              <div className="mb-1 text-xs text-stone-450">{d.req.description}</div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{r.description}</p>
            </div>
          </Card>

          <Card>
            <CardHeader title={d.req.attachments} />
            <div className="space-y-4 p-5">
              <AttachmentGrid items={attachments.filter((a) => a.kind === 'request')} d={d} canDeleteOwn={open} currentUserId={profile.id} />
              {attachments.some((a) => a.kind === 'after') && (
                <div>
                  <div className="mb-2 text-xs font-medium text-stone-450">{d.admin.detail.after}</div>
                  <AttachmentGrid items={attachments.filter((a) => a.kind === 'after')} d={d} />
                </div>
              )}
              {open && <Uploader requestId={r.id} kind="request" label={d.newReq.addFiles} />}
            </div>
          </Card>

          <Card>
            <CardHeader title={d.req.conversation} />
            <div className="p-5">
              <NotesList notes={notes} d={d} locale={locale} meId={profile.id} />
              {r.status !== 'rejected' && <NoteForm requestId={r.id} />}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="bg-brand/[.05] p-5">
              <div className="flex items-center gap-2 text-xs font-medium text-brand"><CalendarClock className="h-4 w-4" />{d.req.visit}</div>
              <div className="mt-1.5 text-lg font-semibold">{r.visit_at ? fmtVisit(r.visit_at, locale) : <span className="text-base font-normal text-stone-450">{d.req.noVisit}</span>}</div>
            </div>
            <div className="flex items-center justify-between gap-3 p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-sand-100 text-ink/60"><UserRound className="h-5 w-5" /></div>
                <div>
                  <div className="text-xs text-stone-450">{d.req.technician}</div>
                  <div className="font-medium">{r.technician_name ?? d.common.unassigned}</div>
                </div>
              </div>
              {r.technician_phone && open && (
                <a href={`tel:${r.technician_phone}`} className="grid h-10 w-10 place-items-center rounded-full bg-brand text-white" aria-label={d.req.callTech}><Phone className="h-4 w-4" /></a>
              )}
            </div>
          </Card>
          {r.status === 'rejected' && r.reject_reason && <Alert tone="error">{d.req.reason}: {r.reject_reason}</Alert>}
          <Card>
            <CardHeader title={d.req.timeline} />
            <Timeline logs={logs} d={d} locale={locale} />
          </Card>
        </div>
      </div>
    </div>
  );
}
