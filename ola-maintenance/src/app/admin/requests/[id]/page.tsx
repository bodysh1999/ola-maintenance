import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarClock, ChevronRight, ClipboardCheck, Mail, Phone, Receipt, ShieldCheck, Star, UserRound, Wrench } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n, requireRole } from '@/lib/session';
import { loadRequest } from '@/lib/queries';
import { STAFF_TRANSITIONS } from '@/lib/constants';
import { fmtDate, fmtDateTime, fmtMoney, fmtVisit, isoToRiyadhInput } from '@/lib/format';
import type { Category } from '@/lib/types';
import { Alert, Badge, Card, CardHeader, KeyValue } from '@/components/ui';
import { OverdueBadge, PriorityBadge, StatusBadge, WarrantyBadge } from '@/components/badges';
import { CategoryIcon } from '@/components/category-icon';
import { AttachmentGrid, NotesList, RequestProgress, Timeline } from '@/components/request-parts';
import { NoteForm } from '@/components/note-form';
import { Uploader } from '@/components/uploader';
import { PartsTable } from '@/components/parts';
import { AssignForm, QuoteForm, ReviewForm, ScheduleForm, TransitionPanel, TriageForm, type TechOption } from './staff-forms';

export default async function StaffRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(['admin', 'supervisor']);
  const [{ id }, { d, locale }, supabase] = await Promise.all([params, getI18n(), createClient()]);
  const data = await loadRequest(id);
  if (!data) notFound();
  const { request: r, logs, attachments, notes, quotes, rating, workOrders, lastMainStatus } = data;

  const [{ data: techs }, { data: openWos }, { data: owner }, { data: warranties }] = await Promise.all([
    supabase.from('technicians').select('id, full_name, specialties, contractors(name)').eq('is_active', true).order('full_name'),
    supabase.from('work_orders').select('technician_id').in('status', ['assigned', 'in_progress', 'awaiting_parts', 'returned', 'submitted']),
    supabase.from('owners').select('full_name, phone, email').eq('id', r.owner_id).maybeSingle(),
    supabase.from('warranties').select('*, contractors(name)').eq('unit_id', r.unit_id).order('end_date', { ascending: false }),
  ]);

  const openCount = new Map<string, number>();
  (openWos ?? []).forEach((w) => openCount.set(w.technician_id, (openCount.get(w.technician_id) ?? 0) + 1));
  const techOptions: TechOption[] = ((techs ?? []) as unknown as { id: string; full_name: string; specialties: Category[]; contractors: { name: string } | null }[])
    .map((t) => ({ id: t.id, name: t.full_name, contractor: t.contractors?.name ?? null, open: openCount.get(t.id) ?? 0, match: t.specialties.includes(r.category) }));

  const wo = workOrders.find((w) => !['cancelled'].includes(w.status));
  const transitions = STAFF_TRANSITIONS[r.status] ?? [];
  const canAssign = !['completed', 'rejected', 'pending_approval', 'in_progress'].includes(r.status);
  const canSchedule = !!wo && ['assigned', 'in_progress', 'awaiting_parts', 'returned'].includes(wo.status) && !['completed', 'rejected', 'pending_approval'].includes(r.status);
  const matchedWarranty = (warranties ?? []).find((w) => w.id === r.warranty_id);
  const relevantWarranties = (warranties ?? []).filter((w) => !w.category || w.category === r.category);
  const pendingQuote = quotes.find((q) => q.status === 'pending');
  const t = d.admin.detail;

  return (
    <div className="space-y-6">
      <Link href="/admin/requests" className="inline-flex items-center gap-1 text-sm text-stone-450 hover:text-ink">
        <ChevronRight className="h-4 w-4 ltr:rotate-180" /> {d.nav.requests}
      </Link>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand text-accent"><CategoryIcon category={r.category} className="h-6 w-6" /></div>
            <div>
              <div className="font-mono text-xs text-stone-450" dir="ltr">{r.ref_no}</div>
              <h1 className="text-xl font-semibold">{d.category[r.category]} · {r.location_in_unit}</h1>
              <div className="mt-1 text-sm text-stone-450">
                {r.project_name_ar} · {d.owner.building} {r.building_name} · <Link href={`/admin/units/${r.unit_id}`} className="text-brand hover:underline">{d.owner.unit} {r.unit_number}</Link> · {r.owner_name}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {r.is_overdue && <OverdueBadge d={d} />}
            {r.is_paid && <Badge className="bg-accent/10 text-accent ring-accent/30">{d.req.paid}</Badge>}
            <PriorityBadge priority={r.priority} d={d} />
            <WarrantyBadge state={r.warranty_state} d={d} />
            <StatusBadge status={r.status} d={d} />
          </div>
        </div>
        <div className="mt-6 border-t border-sand-100 pt-6"><RequestProgress status={r.status} d={d} lastMainStatus={lastMainStatus} /></div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {/* Work report awaiting sign-off comes first */}
          {wo?.status === 'submitted' && (
            <Card className="border-orange-200 ring-4 ring-orange-50">
              <CardHeader title={<span className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-orange-600" />{t.workReport}</span>}
                subtitle={`${wo.technicians?.full_name} · ${fmtDateTime(wo.submitted_at, locale)}`} />
              <div className="space-y-5 p-5">
                <div><div className="mb-1 text-xs text-stone-450">{t.techNotes}</div><p className="whitespace-pre-wrap text-sm">{wo.tech_notes}</p></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><div className="mb-2 text-xs font-medium text-stone-450">{t.before}</div><AttachmentGrid items={attachments.filter((a) => a.kind === 'before' && a.work_order_id === wo.id)} d={d} /></div>
                  <div><div className="mb-2 text-xs font-medium text-stone-450">{t.after}</div><AttachmentGrid items={attachments.filter((a) => a.kind === 'after' && a.work_order_id === wo.id)} d={d} /></div>
                </div>
                <div><div className="mb-2 text-xs font-medium text-stone-450">{t.parts}</div><PartsTable parts={wo.work_order_parts} /></div>
                <ReviewForm requestId={r.id} workOrderId={wo.id} />
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title={t.changeStatus} />
            <div className="space-y-6 p-5">
              {transitions.length > 0 ? <TransitionPanel requestId={r.id} options={transitions} /> : <p className="text-sm text-stone-450">{d.status[r.status]}</p>}
              {canAssign && (
                <div className="border-t border-sand-100 pt-5">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Wrench className="h-4 w-4 text-brand" />{wo ? t.reassign : t.assign}</h4>
                  {pendingQuote ? <Alert tone="warn">{d.errors.QUOTE_PENDING}</Alert> : (
                    <AssignForm requestId={r.id} techs={techOptions} current={wo?.technician_id} priority={r.priority} />
                  )}
                </div>
              )}
              {canSchedule && (
                <div className="border-t border-sand-100 pt-5">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold"><CalendarClock className="h-4 w-4 text-brand" />{r.visit_at ? t.reschedule : t.schedule}</h4>
                  <ScheduleForm requestId={r.id} hasVisit={!!r.visit_at} defaultStart={r.visit_at ? isoToRiyadhInput(r.visit_at) : undefined} />
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title={d.common.details} />
            <div className="grid gap-x-8 px-5 sm:grid-cols-2">
              <KeyValue label={d.req.created}>{fmtDateTime(r.created_at, locale)}</KeyValue>
              <KeyValue label={d.req.preferred}>{r.preferred_date ? `${fmtDate(r.preferred_date, locale)}${r.preferred_slot ? ` · ${d.slot[r.preferred_slot]}` : ''}` : '—'}</KeyValue>
              <KeyValue label={d.req.due}>{fmtDateTime(r.due_at, locale)}</KeyValue>
              <KeyValue label={d.req.completedOn}>{fmtDateTime(r.completed_at, locale)}</KeyValue>
            </div>
            <div className="space-y-4 px-5 pb-5 pt-2">
              <div>
                <div className="mb-1 text-xs text-stone-450">{d.req.description}</div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{r.description}</p>
              </div>
              {r.reject_reason && <Alert tone="error">{d.req.reason}: {r.reject_reason}</Alert>}
              <div>
                <div className="mb-2 text-xs text-stone-450">{d.req.attachments}</div>
                <AttachmentGrid items={attachments.filter((a) => a.kind === 'request' || a.kind === 'other')} d={d} canDeleteOwn currentUserId={profile.id} />
                <div className="mt-3 max-w-xs"><Uploader requestId={r.id} kind="other" label={d.newReq.addFiles} accept="image/*,video/*,application/pdf" compact /></div>
              </div>
            </div>
          </Card>

          {wo && wo.status !== 'submitted' && (
            <Card>
              <CardHeader title={<span className="flex items-center gap-2"><Wrench className="h-4 w-4 text-brand" />{t.workReport}</span>}
                subtitle={`${wo.technicians?.full_name} · ${d.woStatus[wo.status as keyof typeof d.woStatus]}`} />
              <div className="space-y-4 p-5">
                {wo.instructions && <div><div className="mb-1 text-xs text-stone-450">{t.instructions}</div><p className="text-sm">{wo.instructions}</p></div>}
                {wo.tech_notes && <div><div className="mb-1 text-xs text-stone-450">{t.techNotes}</div><p className="whitespace-pre-wrap text-sm">{wo.tech_notes}</p></div>}
                {wo.review_note && <Alert tone="info">{t.reviewNote}: {wo.review_note}</Alert>}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><div className="mb-2 text-xs font-medium text-stone-450">{t.before}</div><AttachmentGrid items={attachments.filter((a) => a.kind === 'before')} d={d} /></div>
                  <div><div className="mb-2 text-xs font-medium text-stone-450">{t.after}</div><AttachmentGrid items={attachments.filter((a) => a.kind === 'after')} d={d} /></div>
                </div>
                <div><div className="mb-2 text-xs font-medium text-stone-450">{t.parts}</div><PartsTable parts={wo.work_order_parts} /></div>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title={d.req.conversation} />
            <div className="p-5">
              <NotesList notes={notes} d={d} locale={locale} meId={profile.id} />
              <NoteForm requestId={r.id} allowInternal />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand" />{t.warrantyCheck}</span>} />
            <div className="space-y-4 p-5">
              <div className="rounded-xl bg-sand-50 p-3">
                <div className="text-xs text-stone-450">{t.systemResult}</div>
                <div className="mt-1 flex items-center gap-2"><WarrantyBadge state={r.warranty_state} d={d} /></div>
                {r.warranty_note && <p className="mt-2 text-sm">{r.warranty_note}</p>}
              </div>
              {matchedWarranty ? (
                <div className="space-y-1.5 text-sm">
                  <div className="font-medium">{matchedWarranty.title}</div>
                  <div className="text-xs text-stone-450">{fmtDate(matchedWarranty.start_date, locale)} — {fmtDate(matchedWarranty.end_date, locale)}</div>
                  {matchedWarranty.covered_items && <p><span className="text-emerald-700">{t.covered}:</span> {matchedWarranty.covered_items}</p>}
                  {matchedWarranty.excluded_items && <p><span className="text-rose-700">{t.excluded}:</span> {matchedWarranty.excluded_items}</p>}
                  {(matchedWarranty.contractors?.name || matchedWarranty.responsible_party) && (
                    <p><span className="text-stone-450">{t.responsible}:</span> {matchedWarranty.contractors?.name ?? matchedWarranty.responsible_party}</p>
                  )}
                </div>
              ) : relevantWarranties.length > 0 ? (
                <ul className="space-y-1 text-xs text-stone-450">
                  {relevantWarranties.map((w) => <li key={w.id}>{w.title}: {fmtDate(w.end_date, locale)}</li>)}
                </ul>
              ) : <p className="text-xs text-stone-450">{t.noWarrantyRecord}</p>}
              <div className="border-t border-sand-100 pt-4">
                <TriageForm requestId={r.id} priority={r.priority} warranty={r.warranty_state} note={r.warranty_note} />
              </div>
            </div>
          </Card>

          {(r.warranty_state !== 'in_warranty' || quotes.length > 0) && (
            <Card>
              <CardHeader title={<span className="flex items-center gap-2"><Receipt className="h-4 w-4 text-accent" />{t.quote}</span>} />
              <div className="space-y-4 p-5">
                {quotes.map((q) => (
                  <div key={q.id} className="rounded-xl border border-sand-200 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold tabular-nums">{fmtMoney(Number(q.amount) * (1 + Number(q.vat_rate) / 100), locale)}</span>
                      <Badge className="bg-sand-100 text-ink/70 ring-sand-200">{d.req.quoteStatus[q.status]}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-stone-450">{q.description}</p>
                  </div>
                ))}
                {!['completed', 'rejected'].includes(r.status) && <QuoteForm requestId={r.id} />}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title={t.owner} />
            <div className="space-y-2 p-5 text-sm">
              <div className="flex items-center gap-2 font-medium"><UserRound className="h-4 w-4 text-stone-450" />{owner?.full_name}</div>
              {owner?.phone && <a href={`tel:${owner.phone}`} className="flex items-center gap-2 text-brand" dir="ltr"><Phone className="h-4 w-4" />{owner.phone}</a>}
              {owner?.email && <a href={`mailto:${owner.email}`} className="flex items-center gap-2 text-brand" dir="ltr"><Mail className="h-4 w-4" />{owner.email}</a>}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="bg-brand/[.05] p-5">
              <div className="flex items-center gap-2 text-xs font-medium text-brand"><CalendarClock className="h-4 w-4" />{d.req.visit}</div>
              <div className="mt-1.5 font-semibold">{r.visit_at ? fmtVisit(r.visit_at, locale) : <span className="font-normal text-stone-450">{d.req.noVisit}</span>}</div>
              <div className="mt-2 text-sm text-stone-450">{d.req.technician}: <span className="text-ink">{r.technician_name ?? d.common.unassigned}</span></div>
            </div>
            {rating && (
              <div className="flex items-center gap-2 border-t border-sand-100 p-4 text-sm">
                <Star className="h-4 w-4 fill-accent text-accent" /> <span className="font-semibold">{rating.score}/5</span>
                {rating.comment && <span className="truncate text-stone-450">— {rating.comment}</span>}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title={d.req.timeline} />
            <Timeline logs={logs} d={d} locale={locale} />
          </Card>
        </div>
      </div>
    </div>
  );
}
