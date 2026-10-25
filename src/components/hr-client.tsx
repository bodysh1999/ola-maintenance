'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startTransition, useActionState, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Crosshair, FileText, Fingerprint, Loader2, LogIn, LogOut, MapPin, Upload } from 'lucide-react';
import { cancelHrRequest, decideHrRequest, punch, submitHrRequest } from '@/app/actions/me';
import { createClient } from '@/lib/supabase/client';
import { prepareImage } from '@/lib/image';
import { overtimeHourly, sar, timeRiyadh, type HrRequestType, type Salary } from '@/lib/hr';
import { ActionForm, SubmitButton, useI18n } from './client';
import { Field, Input, Select, Textarea, buttonClass, cx } from './ui';

// ------------------------------------------------------------------ geolocation
type Fix = { lat: number; lng: number; accuracy: number };
function locate(): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('LOCATION_REQUIRED'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      (e) => reject(new Error(e.code === 1 ? 'DENIED' : 'LOCATION_REQUIRED')),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}

// ------------------------------------------------------------------ check-in / check-out
export function PunchCard({ today, remote }: { today: { check_in_at: string | null; check_out_at: string | null; source: string | null } | null; remote: boolean }) {
  const { d } = useI18n();
  const t = d.me.punch;
  const router = useRouter();
  const [busy, setBusy] = useState<'in' | 'out' | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string; outOfRange?: boolean } | null>(null);
  const [clock, setClock] = useState('');
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const kind: 'in' | 'out' | null = !today?.check_in_at ? 'in' : !today.check_out_at ? 'out' : null;

  async function run(k: 'in' | 'out') {
    setBusy(k); setMsg(null);
    try {
      const fix = await locate();
      const r = await punch(k, fix.lat, fix.lng, fix.accuracy);
      if (r?.error) setMsg({ tone: 'err', text: r.error, outOfRange: r.error === d.errors.OUT_OF_RANGE });
      else {
        const dist = r?.data?.distance_m;
        setMsg({ tone: 'ok', text: `${t.ok}${dist != null ? ` · ${t.distance}: ${dist} ${t.m}` : ''}` });
        router.refresh();
      }
    } catch (e) {
      setMsg({ tone: 'err', text: (e as Error).message === 'DENIED' ? t.denied : d.errors.LOCATION_REQUIRED });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-[28px] bg-brand p-6 text-white sm:p-8">
      <div className="pointer-events-none absolute -bottom-24 end-6 h-56 w-40 rounded-arch border border-accent/30" />
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="flex items-center gap-2 text-sm text-white/65"><Fingerprint className="h-4 w-4 text-accent" />{t.title}</p>
          <div className="mt-2 font-display text-5xl font-bold tabular-nums" dir="ltr">{clock || '—'}</div>
          <div className="mt-4 flex gap-6 text-sm">
            <div><div className="text-white/55">{t.checkedIn}</div><div className="mt-0.5 text-lg font-semibold" dir="ltr">{timeRiyadh(today?.check_in_at ?? null)}</div></div>
            <div><div className="text-white/55">{t.checkedOut}</div><div className="mt-0.5 text-lg font-semibold" dir="ltr">{timeRiyadh(today?.check_out_at ?? null)}</div></div>
          </div>
          {remote && <p className="mt-3 text-xs text-white/55">{t.remote}</p>}
        </div>
        <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto">
          {kind ? (
            <button type="button" disabled={!!busy} onClick={() => run(kind)}
              className={cx('inline-flex h-16 items-center justify-center gap-3 rounded-2xl px-8 text-lg font-semibold shadow-lift transition disabled:opacity-60',
                kind === 'in' ? 'bg-accent text-white hover:bg-accent/90' : 'bg-white text-brand hover:bg-white/90')}>
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : kind === 'in' ? <LogIn className="h-5 w-5" /> : <LogOut className="h-5 w-5 flip-rtl" />}
              {busy ? t.locating : kind === 'in' ? t.in : t.out}
            </button>
          ) : (
            <div className="inline-flex h-16 items-center justify-center gap-2 rounded-2xl bg-white/10 px-8 font-medium"><CheckCircle2 className="h-5 w-5 text-accent" />{t.done}</div>
          )}
          <Link href="/me/requests/new?type=attendance_correction" className="text-center text-xs text-white/60 underline-offset-4 hover:text-white hover:underline">{t.forgot}</Link>
        </div>
      </div>
      {msg && (
        <div role={msg.tone === 'err' ? 'alert' : 'status'} className={cx('relative mt-5 rounded-xl px-4 py-3 text-sm', msg.tone === 'ok' ? 'bg-emerald-500/15 text-emerald-100' : 'bg-rose-500/15 text-rose-100')}>
          <div className="flex items-start gap-2">{msg.tone === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}{msg.text}</div>
          {msg.outOfRange && (
            <p className="mt-2 text-xs text-white/75">{t.presenceHint} <Link href="/me/requests/new?type=presence" className="font-semibold text-white underline">{t.presence}</Link></p>
          )}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ request form (all types)
type LeaveTypeOpt = { code: string; name_ar: string; name_en: string; max_days: number | null; requires_attachment: boolean; uses_balance: boolean; note_ar: string | null; gender: string | null };

export function HrRequestForm({ type, employeeId, leaveTypes, available, salary, perDiem, gender, holidays = [] }: {
  type: HrRequestType; employeeId: string; leaveTypes: LeaveTypeOpt[]; available: number | null;
  salary: Salary | null; perDiem: number; gender: 'male' | 'female'; holidays?: { start_date: string; end_date: string }[];
}) {
  const { d, locale } = useI18n();
  const f = d.me.form;
  const router = useRouter();
  const [state, action, pending] = useActionState(submitHrRequest, undefined);
  const [lt, setLt] = useState(type === 'leave' ? 'annual' : '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [hours, setHours] = useState('');
  const [fix, setFix] = useState<Fix | null>(null);
  const [locBusy, setLocBusy] = useState(false);
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (state?.ok && state.data?.id) router.push(`/me/requests/${state.data.id}`);
  }, [state, router]);

  const leave = leaveTypes.find((x) => x.code === lt);
  const calDays = useMemo(() => (from && to && to >= from ? Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1 : 0), [from, to]);
  // official holidays inside the range are not deducted from leave that uses the balance (same rule as the database)
  const holidayDays = useMemo(() => {
    if (!calDays || type !== 'leave') return 0;
    const set = new Set<string>();
    for (const h of holidays) {
      for (let t = Date.parse(h.start_date > from ? h.start_date : from); t <= Date.parse(h.end_date < to ? h.end_date : to); t += 864e5) set.add(new Date(t).toISOString().slice(0, 10));
    }
    return set.size;
  }, [calDays, holidays, from, to, type]);
  const days = calDays - (leave?.uses_balance ? holidayDays : 0);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });

  async function capture() {
    setLocBusy(true); setErr(null);
    try { setFix(await locate()); } catch (e) { setErr((e as Error).message === 'DENIED' ? d.me.punch.denied : d.errors.LOCATION_REQUIRED); }
    setLocBusy(false);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const raw = fd.get('file') as File | null;
    fd.delete('file');
    if (raw && raw.size > 0) {
      const file = await prepareImage(raw);
      const ext = (file.name.split('.').pop() ?? '').toLowerCase();
      if (!['pdf', 'jpg', 'jpeg', 'png', 'webp'].includes(ext) || file.size > 10 * 1024 * 1024) { setErr(d.errors.INVALID_FILE); return; }
      setUploading(true);
      const path = `${employeeId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await createClient().storage.from('hr-docs').upload(path, file, { contentType: file.type || undefined });
      setUploading(false);
      if (error) { setErr(d.errors.INVALID_FILE); return; }
      fd.set('attachment_path', path);
    }
    if (fix) { fd.set('lat', String(fix.lat)); fd.set('lng', String(fix.lng)); fd.set('accuracy_m', String(fix.accuracy)); }
    startTransition(() => action(fd));
  }

  const needsFile = type === 'leave' && leave?.requires_attachment;
  const range = type === 'leave' || type === 'business_trip' || type === 'exit_reentry';
  const busy = pending || uploading;

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="type" value={type} />

      {type === 'leave' && (
        <Field label={f.leaveType} required className="sm:col-span-2">
          <Select name="leave_type" value={lt} onChange={(e) => setLt(e.target.value)} required>
            {leaveTypes.filter((x) => !x.gender || x.gender === gender).map((x) => <option key={x.code} value={x.code}>{locale === 'en' ? x.name_en : x.name_ar}</option>)}
          </Select>
          {leave?.note_ar && locale === 'ar' && <p className="mt-1.5 text-xs text-stone-450">{leave.note_ar}</p>}
          {leave?.uses_balance && available != null && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand/[.06] px-3 py-1 text-xs text-brand">
              {f.balanceNow}: <b className="tabular-nums">{available.toFixed(1)}</b> {f.dayUnit}
            </p>
          )}
        </Field>
      )}

      {range && (
        <>
          <Field label={f.from} required><Input type="date" name="start_date" required value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label={f.to} required><Input type="date" name="end_date" required min={from || undefined} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          {days > 0 && (
            <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-xl bg-sand-50 px-4 py-3 text-sm sm:col-span-2">
              <span>{f.days}: <b>{days}</b></span>
              {type === 'leave' && leave?.uses_balance && holidayDays > 0 && <span className="text-emerald-700">{d.hrops.holidaysInRange.replace('{n}', String(holidayDays))}</span>}
              {type === 'leave' && leave?.uses_balance && available != null && (
                <span className={available - days < 0 ? 'text-rose-700' : ''}>{f.balanceAfter}: <b>{(available - days).toFixed(1)}</b></span>
              )}
              {type === 'leave' && leave?.max_days && days > leave.max_days && <span className="text-rose-700">{d.errors.LEAVE_MAX_EXCEEDED} ({leave.max_days})</span>}
              {type === 'business_trip' && <span>{f.perDiem}: <b>{sar(days * perDiem)}</b> {d.common.sar} <span className="text-stone-450">({f.estimate})</span></span>}
            </div>
          )}
        </>
      )}

      {type === 'business_trip' && <Field label={f.destination} required className="sm:col-span-2"><Input name="destination" required maxLength={200} /></Field>}

      {(type === 'overtime' || type === 'attendance_correction') && (
        <Field label={f.workDate} required><Input type="date" name="work_date" required max={type === 'attendance_correction' ? today : undefined} defaultValue={today} /></Field>
      )}
      {type === 'overtime' && (
        <>
          <Field label={f.hours} required><Input type="number" name="hours" required min={0.5} max={12} step={0.5} value={hours} onChange={(e) => setHours(e.target.value)} /></Field>
          {salary && Number(hours) > 0 && (
            <p className="rounded-xl bg-sand-50 px-4 py-3 text-sm sm:col-span-2">
              {f.overtimePay}: <b>{sar(overtimeHourly(salary) * Number(hours))}</b> {d.common.sar} <span className="text-stone-450">({f.estimate})</span>
              <span className="mt-1 block text-xs text-stone-450">{f.overtimeRule}</span>
            </p>
          )}
        </>
      )}
      {type === 'attendance_correction' && (
        <>
          <Field label={f.timeIn}><Input type="time" name="time_in" defaultValue="08:00" /></Field>
          <Field label={f.timeOut}><Input type="time" name="time_out" /></Field>
        </>
      )}

      {type === 'presence' && (
        <div className="sm:col-span-2">
          <button type="button" onClick={capture} disabled={locBusy} className={buttonClass(fix ? 'outline' : 'primary', 'lg')}>
            {locBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : fix ? <MapPin className="h-4 w-4 text-emerald-600" /> : <Crosshair className="h-4 w-4" />}
            {fix ? f.captured : f.capture}
          </button>
          {fix && <p className="mt-2 text-xs text-stone-450" dir="ltr">{fix.lat.toFixed(5)}, {fix.lng.toFixed(5)} · ±{fix.accuracy}m</p>}
        </div>
      )}

      {type === 'salary_advance' && <Field label={f.amount} required><Input type="number" name="amount" required min={1} step={1} dir="ltr" /></Field>}
      {(type === 'salary_certificate' || type === 'experience_letter') && (
        <Field label={f.addressedTo} className="sm:col-span-2"><Input name="addressed_to" maxLength={200} placeholder={locale === 'ar' ? 'إلى من يهمه الأمر' : 'To whom it may concern'} /></Field>
      )}

      <Field label={f.reason} required={type === 'attendance_correction' || type === 'presence'} className="sm:col-span-2">
        <Textarea name="reason" rows={3} maxLength={2000} required={type === 'attendance_correction' || type === 'presence'} />
      </Field>

      {(type === 'leave' || type === 'business_trip') && (
        <div className="sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-ink/80">{f.attachment}{needsFile ? ' *' : ''}</span>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-sand-300 bg-sand-50 px-4 py-4 hover:border-brand/40">
            {fileName ? <FileText className="h-5 w-5 text-brand" /> : <Upload className="h-5 w-5 text-brand" />}
            <span className="min-w-0"><span className="block truncate text-sm">{fileName || f.attachmentHint}</span></span>
            <input type="file" name="file" accept=".pdf,image/*,.heic,.heif" className="sr-only" required={!!needsFile && ['sick', 'maternity'].includes(lt)} onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')} />
          </label>
        </div>
      )}

      <div className="space-y-3 sm:col-span-2">
        {(err || state?.error) && (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{err || state?.error}</p>
        )}
        <button type="submit" disabled={busy || (type === 'presence' && !fix)} className={buttonClass('primary', 'lg', 'w-full sm:w-auto')}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}{uploading ? f.uploading : f.submit}
        </button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ approve / reject / cancel
export function DecisionForm({ id }: { id: string }) {
  const { d } = useI18n();
  return (
    <ActionForm action={decideHrRequest} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <Field label={d.me.detail.comment}><Textarea name="comment" rows={3} /></Field>
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="decision" value="approve" variant="primary">{d.me.detail.approve}</SubmitButton>
        <SubmitButton name="decision" value="reject" variant="outline" className="text-rose-700">{d.me.detail.reject}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function CancelRequestButton({ id }: { id: string }) {
  const { d } = useI18n();
  return (
    <ActionForm action={cancelHrRequest}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="outline" confirmText={d.me.detail.cancel + '?'}>{d.me.detail.cancel}</SubmitButton>
    </ActionForm>
  );
}
