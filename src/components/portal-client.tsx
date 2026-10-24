'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, BellOff, CalendarCheck2, CalendarClock, Camera, Loader2, Navigation, Trash2, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { translateError } from '@/lib/i18n';
import { DOC_KINDS } from '@/lib/portal';
import { prepareImage, setInputFiles } from '@/lib/image';
import {
  deleteUnitDocument, ownerConfirmVisit, ownerRequestReschedule, registerUnitDocument, setNotifyExternal, techOnTheWay, uploadTechnicianPhoto,
} from '@/app/actions/portal';
import { ActionForm, SubmitButton, useI18n } from './client';
import { Field, Input, Select, Textarea, buttonClass, cx } from './ui';

/** Re-renders the page every few seconds while it is visible (chat, tracking) */
export function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}

// ------------------------------------------------------------------ unit documents
export function UnitDocUploader({ unitId }: { unitId: string }) {
  const { d } = useI18n();
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const raw = fd.get('file');
    const title = String(fd.get('title') ?? '').trim();
    if (!(raw instanceof File) || !raw.size || !title) { setMsg({ ok: false, text: d.errors.REQUIRED }); return; }
    setBusy(true);
    const file = await prepareImage(raw, { maxSide: 2400, quality: 0.85 });
    setBusy(false);
    if (file.size > 25 * 1024 * 1024) { setMsg({ ok: false, text: d.errors.FILE_TOO_LARGE }); return; }
    setBusy(true); setMsg(null);
    try {
      const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '') : 'pdf';
      const path = `${unitId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await createClient().storage.from('unit-docs').upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw new Error(error.message);
      const r = await registerUnitDocument({
        unit_id: unitId, kind: String(fd.get('kind')), title, storage_path: path,
        file_name: file.name, mime_type: file.type, size_bytes: file.size,
      });
      if (r?.error) throw new Error(r.error);
      form.current?.reset();
      setMsg({ ok: true, text: d.portal.uploaded });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: translateError(d, (err as Error).message) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={form} onSubmit={onSubmit} className="space-y-3 rounded-2xl bg-sand-50 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={d.portal.docKind}>
          <Select name="kind" defaultValue="sale_contract">
            {DOC_KINDS.map((k) => <option key={k} value={k}>{d.portal.docKinds[k]}</option>)}
          </Select>
        </Field>
        <Field label={d.portal.docTitle}><Input name="title" required maxLength={160} /></Field>
      </div>
      <Field label={d.portal.chooseFile}>
        <input type="file" name="file" required accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
          className="w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm" />
      </Field>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className={buttonClass('primary', 'sm')}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{d.portal.uploadDoc}
        </button>
        {msg && <span className={cx('text-sm', msg.ok ? 'text-emerald-700' : 'text-rose-700')}>{msg.text}</span>}
      </div>
    </form>
  );
}

export function DeleteDocButton({ id }: { id: string }) {
  const { d } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" aria-label={d.portal.deleteDoc} title={d.portal.deleteDoc} disabled={pending}
      onClick={() => {
        if (!window.confirm(d.portal.confirmDeleteDoc)) return;
        const fd = new FormData(); fd.set('id', id);
        start(async () => { await deleteUnitDocument(undefined, fd); router.refresh(); });
      }}
      className="grid h-9 w-9 place-items-center rounded-xl text-rose-600 hover:bg-rose-50">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}

// ------------------------------------------------------------------ visit (owner)
export function VisitActions({ requestId, confirmed, rescheduleNote }: { requestId: string; confirmed: boolean; rescheduleNote: string | null }) {
  const { d } = useI18n();
  const [changing, setChanging] = useState(false);
  if (rescheduleNote && !changing) {
    return (
      <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
        <div className="font-medium">{d.portal.changeSent}</div>
        <div className="mt-0.5 text-xs text-amber-800">“{rescheduleNote}”</div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {confirmed ? (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-800">
          <CalendarCheck2 className="h-4 w-4" />{d.portal.visitConfirmed}
        </div>
      ) : !changing && (
        <ActionForm action={ownerConfirmVisit}>
          <input type="hidden" name="request_id" value={requestId} />
          <SubmitButton className="w-full"><CalendarCheck2 className="h-4 w-4" />{d.portal.confirmVisit}</SubmitButton>
        </ActionForm>
      )}
      {changing ? (
        <ActionForm action={ownerRequestReschedule} className="space-y-2" onSuccess={() => setChanging(false)}>
          <input type="hidden" name="request_id" value={requestId} />
          <Textarea name="note" required rows={2} maxLength={500} placeholder={d.portal.changeVisitPh} />
          <div className="flex gap-2">
            <SubmitButton size="sm" variant="outline">{d.portal.sendChange}</SubmitButton>
            <button type="button" onClick={() => setChanging(false)} className="text-sm text-stone-450">{d.common.cancel}</button>
          </div>
        </ActionForm>
      ) : (
        <button type="button" onClick={() => setChanging(true)} className="flex w-full items-center justify-center gap-2 text-sm font-medium text-brand hover:underline">
          <CalendarClock className="h-4 w-4" />{d.portal.changeVisit}
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ technician
export function OnTheWayForm({ workOrderId, sentAt }: { workOrderId: string; sentAt: string | null }) {
  const { d } = useI18n();
  return (
    <ActionForm action={techOnTheWay} className="space-y-2 rounded-2xl border border-sky-200 bg-sky-50 p-3">
      <input type="hidden" name="work_order_id" value={workOrderId} />
      <div className="flex items-end gap-2">
        <Field label={d.portal.etaLabel} className="flex-1">
          <Select name="eta" defaultValue="30">
            {[10, 15, 20, 30, 45, 60, 90].map((n) => <option key={n} value={n}>{d.portal.minutes.replace('{n}', String(n))}</option>)}
          </Select>
        </Field>
        <SubmitButton variant="outline" className="h-11 border-sky-300 bg-white text-sky-800">
          <Navigation className="h-4 w-4" />{d.portal.techOnWayBtn}
        </SubmitButton>
      </div>
      {sentAt && <p className="text-xs text-sky-800">{d.portal.onWaySent}</p>}
    </ActionForm>
  );
}

export function TechPhotoForm({ technicianId, photo, name }: { technicianId: string; photo: string | null; name: string }) {
  const { d } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  return (
    <ActionForm action={uploadTechnicianPhoto} className="relative">
      <input type="hidden" name="technician_id" value={technicianId} />
      <input ref={input} type="file" name="photo" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" className="hidden"
        onChange={async (e) => {
          const el = e.currentTarget; const f = el.files?.[0];
          if (!f) return;
          setInputFiles(el, [await prepareImage(f, { maxSide: 600, skipBelow: 0 })]);
          el.form?.requestSubmit();
        }} />
      <button type="button" onClick={() => input.current?.click()} title={d.portal.uploadPhoto}
        className="group relative grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-sand-100 text-ink/50">
        {photo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={photo} alt={name} className="h-full w-full object-cover" />
          : <span className="text-sm font-semibold">{name.slice(0, 1)}</span>}
        <span className="absolute inset-0 grid place-items-center bg-ink/50 text-white opacity-0 transition group-hover:opacity-100"><Camera className="h-4 w-4" /></span>
      </button>
    </ActionForm>
  );
}

// ------------------------------------------------------------------ owner preference
export function NotifyToggle({ on }: { on: boolean }) {
  const { d } = useI18n();
  return (
    <ActionForm action={setNotifyExternal} className="flex flex-wrap items-center justify-between gap-3">
      <input type="hidden" name="on" value={on ? 'false' : 'true'} />
      <div className="flex items-center gap-3">
        <span className={cx('grid h-10 w-10 place-items-center rounded-full', on ? 'bg-emerald-50 text-emerald-700' : 'bg-sand-100 text-stone-450')}>
          {on ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        </span>
        <div>
          <div className="font-medium">{d.portal.notifyTitle}</div>
          <div className="text-sm text-stone-450">{on ? d.portal.notifyOn : d.portal.notifyOff}</div>
        </div>
      </div>
      <SubmitButton size="sm" variant="outline">{on ? d.portal.turnOff : d.portal.turnOn}</SubmitButton>
    </ActionForm>
  );
}
