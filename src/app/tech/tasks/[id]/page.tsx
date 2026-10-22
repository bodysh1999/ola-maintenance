import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarClock, CheckCircle2, ChevronRight, Clock, MapPin, Phone, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n, requireRole } from '@/lib/session';
import { loadRequest } from '@/lib/queries';
import { fmtVisit } from '@/lib/format';
import { Alert, Card, CardHeader } from '@/components/ui';
import { PriorityBadge, WarrantyBadge } from '@/components/badges';
import { CategoryIcon } from '@/components/category-icon';
import { AttachmentGrid, NotesList } from '@/components/request-parts';
import { Uploader } from '@/components/uploader';
import { NoteForm } from '@/components/note-form';
import { AddPartForm, PartsTable } from '@/components/parts';
import { AwaitingPartsForm, StartButton, SubmitReport } from './tech-actions';
import { OnTheWayForm } from '@/components/portal-client';

export default async function TechTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(['technician']);
  const [{ id }, { d, locale }, supabase] = await Promise.all([params, getI18n(), createClient()]);
  const { data: wo } = await supabase.from('work_orders').select('id, request_id, status').eq('id', id).maybeSingle();
  if (!wo) notFound();
  const data = await loadRequest(wo.request_id);
  if (!data) notFound();
  const { request: r, attachments, notes, workOrders } = data;
  const full = workOrders.find((w) => w.id === id);
  const status = wo.status as string;
  const working = ['in_progress', 'awaiting_parts', 'returned'].includes(status);
  const mine = attachments.filter((a) => a.work_order_id === id);
  const before = mine.filter((a) => a.kind === 'before');
  const after = mine.filter((a) => a.kind === 'after');
  const live = ['assigned', 'in_progress', 'awaiting_parts', 'returned'].includes(status);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/tech" className="inline-flex items-center gap-1 text-sm text-stone-450 hover:text-ink"><ChevronRight className="h-4 w-4 ltr:rotate-180" />{d.nav.myTasks}</Link>

      <Card className="overflow-hidden">
        <div className="texture-lines bg-brand p-5 text-white">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/10 text-accent"><CategoryIcon category={r.category} className="h-6 w-6" /></div>
            <div className="min-w-0 flex-1">
              <div className="font-mono text-xs text-white/60" dir="ltr">{r.ref_no}</div>
              <h1 className="text-lg font-semibold">{d.category[r.category]} · {r.location_in_unit}</h1>
              <div className="mt-2 flex flex-wrap gap-1.5"><PriorityBadge priority={r.priority} d={d} /><WarrantyBadge state={r.warranty_state} d={d} /></div>
            </div>
          </div>
        </div>
        <div className="divide-y divide-sand-100">
          <div className="flex items-center gap-3 px-5 py-3.5 text-sm"><MapPin className="h-4 w-4 shrink-0 text-brand" />{r.project_name_ar} · {d.owner.building} {r.building_name} · {d.owner.floor} {r.floor} · {d.owner.unit} {r.unit_number}</div>
          <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 text-sm"><CalendarClock className="h-4 w-4 shrink-0 text-brand" />{r.visit_at ? fmtVisit(r.visit_at, locale) : d.req.noVisit}
            {r.owner_confirmed_at && <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">{d.portal.ownerConfirmed}</span>}
          </div>
          {live && r.owner_name && (
            <div className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="flex items-center gap-3 text-sm"><UserRound className="h-4 w-4 text-brand" /><span>{d.tech.customer}: <strong className="font-medium">{r.owner_name}</strong></span></div>
              {r.owner_phone && <a href={`tel:${r.owner_phone}`} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white"><Phone className="h-4 w-4" />{d.tech.call}</a>}
            </div>
          )}
        </div>
      </Card>

      {status === 'returned' && full?.review_note && <Alert tone="error"><strong>{d.tech.returned}:</strong> {full.review_note}</Alert>}
      {status === 'awaiting_parts' && <Alert tone="warn">{d.status.awaiting_parts}</Alert>}
      {status === 'submitted' && <Alert tone="info"><span className="flex items-center gap-2"><Clock className="h-4 w-4" />{d.tech.submitted}</span></Alert>}
      {status === 'approved' && <Alert tone="success"><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{d.tech.approved}</span></Alert>}

      <Card>
        <CardHeader title={d.req.description} />
        <div className="space-y-4 p-5">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{r.description}</p>
          {full?.instructions && <div className="rounded-xl bg-accent/[.08] p-3 text-sm"><div className="mb-0.5 text-xs font-medium text-accent">{d.tech.instructions}</div>{full.instructions}</div>}
          <AttachmentGrid items={attachments.filter((a) => a.kind === 'request' || a.kind === 'other')} d={d} />
        </div>
      </Card>

      {['assigned', 'returned', 'awaiting_parts'].includes(status) && (
        <div className="space-y-3">
          <OnTheWayForm workOrderId={id} sentAt={r.on_the_way_at ?? null} />
          <StartButton workOrderId={id} />
        </div>
      )}

      {(working || status === 'submitted' || status === 'approved') && (
        <>
          <Card>
            <CardHeader title={d.tech.photosBefore} />
            <div className="space-y-3 p-5">
              <AttachmentGrid items={before} d={d} canDeleteOwn={working} currentUserId={profile.id} emptyText="—" />
              {working && <Uploader requestId={r.id} workOrderId={id} kind="before" label={d.tech.addPhoto} accept="image/*" capture />}
            </div>
          </Card>

          <Card>
            <CardHeader title={d.admin.detail.parts} />
            <div className="p-5">
              <PartsTable parts={full?.work_order_parts ?? []} editable={working} />
              {working && <AddPartForm workOrderId={id} />}
            </div>
          </Card>

          <Card>
            <CardHeader title={d.tech.photosAfter} />
            <div className="space-y-3 p-5">
              <AttachmentGrid items={after} d={d} canDeleteOwn={working} currentUserId={profile.id} emptyText="—" />
              {working && <Uploader requestId={r.id} workOrderId={id} kind="after" label={d.tech.addPhoto} accept="image/*" capture />}
            </div>
          </Card>

          {status === 'in_progress' && (
            <Card className="p-5">
              <SubmitReport workOrderId={id} hasAfter={after.length > 0} />
              <div className="mt-4 border-t border-sand-100 pt-4"><AwaitingPartsForm workOrderId={id} /></div>
            </Card>
          )}
          {full?.tech_notes && status !== 'in_progress' && (
            <Card className="p-5"><div className="mb-1 text-xs text-stone-450">{d.admin.detail.techNotes}</div><p className="whitespace-pre-wrap text-sm">{full.tech_notes}</p></Card>
          )}
        </>
      )}

      <Card>
        <CardHeader title={d.req.conversation} />
        <div className="p-5">
          <NotesList notes={notes} d={d} locale={locale} meId={profile.id} />
          {live && <NoteForm requestId={r.id} allowInternal />}
        </div>
      </Card>
    </div>
  );
}
