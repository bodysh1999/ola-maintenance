'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { acceptPrivacy, eraseVisitor, handleDataRequest, setConsent, submitDataRequest, updatePrivacySettings } from '@/app/actions/privacy';
import { ActionForm, SubmitButton, useI18n } from './client';
import { Field, Input, Select, Textarea, buttonClass, cx } from './ui';

const box = 'mt-0.5 h-4 w-4 shrink-0 rounded border-sand-300 text-brand focus:ring-brand';

// ------------------------------------------------------------------ consent gate
export function ConsentForm() {
  const { d } = useI18n();
  const p = d.privacy;
  return (
    <ActionForm action={acceptPrivacy} className="space-y-3">
      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-sand-50 p-3 text-sm font-medium">
        <input type="checkbox" name="accept" required className={box} />{p.gateAccept}
      </label>
      <label className="flex cursor-pointer items-start gap-2.5 px-3 text-sm text-ink/80">
        <input type="checkbox" name="whatsapp" defaultChecked className={box} />{p.gateWhatsapp}
      </label>
      <label className="flex cursor-pointer items-start gap-2.5 px-3 text-sm text-ink/80">
        <input type="checkbox" name="marketing" className={box} />{p.gateMarketing}
      </label>
      <SubmitButton size="lg" className="mt-2 w-full">{p.gateContinue}</SubmitButton>
    </ActionForm>
  );
}

// ------------------------------------------------------------------ my data
export function ConsentToggle({ purpose, granted }: { purpose: 'marketing' | 'whatsapp_updates'; granted: boolean }) {
  const { d } = useI18n();
  const p = d.privacy;
  return (
    <ActionForm action={setConsent} className="flex flex-wrap items-center justify-between gap-3 py-3">
      <input type="hidden" name="purpose" value={purpose} />
      <input type="hidden" name="granted" value={granted ? 'false' : 'true'} />
      <div>
        <div className="text-sm font-medium">{purpose === 'marketing' ? p.marketing : p.whatsapp}</div>
        <div className={cx('text-xs', granted ? 'text-emerald-700' : 'text-stone-450')}>{granted ? p.granted : p.withdrawn}</div>
      </div>
      <SubmitButton size="sm" variant="outline">{granted ? p.withdraw : p.grant}</SubmitButton>
    </ActionForm>
  );
}

export function DataRequestForm() {
  const { d } = useI18n();
  const p = d.privacy;
  const [type, setType] = useState('correction');
  return (
    <ActionForm action={submitDataRequest} resetOnSuccess className="space-y-3">
      <Field label={p.requestType}>
        <Select name="type" value={type} onChange={(e) => setType(e.target.value)}>
          {(['correction', 'deletion', 'objection', 'other'] as const).map((t) => <option key={t} value={t}>{p.types[t]}</option>)}
        </Select>
      </Field>
      <Field label={p.requestDetails}><Textarea name="details" required rows={3} maxLength={2000} placeholder={p.requestDetailsPh} /></Field>
      <SubmitButton>{p.sendRequest}</SubmitButton>
    </ActionForm>
  );
}

// ------------------------------------------------------------------ admin console
export function HandleRequestForm({ id }: { id: string }) {
  const { d } = useI18n();
  const p = d.privacy;
  return (
    <ActionForm action={handleDataRequest} className="mt-3 space-y-2">
      <input type="hidden" name="id" value={id} />
      <Textarea name="response" rows={2} maxLength={2000} placeholder={p.responsePh} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton size="sm" variant="outline" name="status" value="in_progress">{p.markInProgress}</SubmitButton>
        <SubmitButton size="sm" name="status" value="completed">{p.markDone}</SubmitButton>
        <SubmitButton size="sm" variant="outline" name="status" value="rejected" className="text-rose-700">{p.markRejected}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function EraseVisitorForm() {
  const { d } = useI18n();
  const p = d.privacy;
  return (
    <ActionForm action={eraseVisitor} resetOnSuccess className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <Field label={p.erasePh}><Input name="email" type="email" dir="ltr" /></Field>
      <Field label={p.erasePhone}><Input name="phone" dir="ltr" placeholder="05XXXXXXXX" /></Field>
      <SubmitButton variant="danger" confirmText={p.eraseConfirm}><Trash2 className="h-4 w-4" />{p.eraseBtn}</SubmitButton>
    </ActionForm>
  );
}

export function PrivacySettingsForm({ s }: {
  s: { dpo_name: string | null; dpo_email: string | null; region: string | null; cv: number; leads: number; notif: number; mfa: boolean };
}) {
  const { d } = useI18n();
  const p = d.privacy;
  return (
    <ActionForm action={updatePrivacySettings} className="space-y-4" successText={d.common.saved}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={p.dpoName}><Input name="dpo_name" defaultValue={s.dpo_name ?? ''} /></Field>
        <Field label={p.dpoEmail}><Input name="dpo_email" type="email" dir="ltr" defaultValue={s.dpo_email ?? ''} /></Field>
        <Field label={p.region} className="sm:col-span-2"><Input name="region" placeholder={p.regionPh} defaultValue={s.region ?? ''} /></Field>
        <Field label={p.cvMonths}><Input name="cv_months" type="number" min={1} max={120} defaultValue={s.cv} /></Field>
        <Field label={p.leadsMonths}><Input name="leads_months" type="number" min={1} max={120} defaultValue={s.leads} /></Field>
        <Field label={p.notifDays}><Input name="notif_days" type="number" min={30} max={3650} defaultValue={s.notif} /></Field>
      </div>
      <label className="flex items-start gap-2.5 text-sm"><input type="checkbox" name="require_mfa" defaultChecked={s.mfa} className={box} />{p.requireMfa}</label>
      <label className="flex items-start gap-2.5 text-sm"><input type="checkbox" name="bump_version" className={box} />{p.bumpVersion}</label>
      <SubmitButton>{d.common.save}</SubmitButton>
    </ActionForm>
  );
}

// ------------------------------------------------------------------ two-step login (TOTP)
type Factor = { id: string; status: string; factor_type: string; friendly_name?: string | null };

export function MfaManager() {
  const { d } = useI18n();
  const p = d.privacy;
  const router = useRouter();
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    const { data } = await createClient().auth.mfa.listFactors();
    setFactors(((data?.all ?? []) as Factor[]).filter((f) => f.factor_type === 'totp'));
  }
  useEffect(() => { load(); }, []);
  const verified = factors?.find((f) => f.status === 'verified');

  async function start() {
    setBusy(true); setMsg(null);
    const sb = createClient();
    for (const f of factors ?? []) if (f.status !== 'verified') await sb.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Ola ${new Date().toISOString().slice(0, 10)}` });
    setBusy(false);
    if (error || !data) { setMsg({ ok: false, text: error?.message ?? d.common.errorGeneric }); return; }
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }
  async function verify() {
    if (!enroll) return;
    setBusy(true); setMsg(null);
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: enroll.id, code: code.trim() });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: p.mfaWrong }); return; }
    setEnroll(null); setCode(''); setMsg({ ok: true, text: p.mfaEnabled });
    await load(); router.refresh();
  }
  async function disable() {
    if (!verified || !window.confirm(p.mfaDisableConfirm)) return;
    setBusy(true);
    const { error } = await createClient().auth.mfa.unenroll({ factorId: verified.id });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    await load(); router.refresh();
  }

  if (!factors) return <Loader2 className="h-5 w-5 animate-spin text-stone-450" />;
  return (
    <div className="space-y-4">
      <div className={cx('flex items-center gap-3 rounded-2xl p-4', verified ? 'bg-emerald-50 text-emerald-900' : 'bg-sand-50 text-ink/80')}>
        {verified ? <ShieldCheck className="h-6 w-6 text-emerald-700" /> : <ShieldOff className="h-6 w-6 text-stone-450" />}
        <span className="font-medium">{verified ? p.mfaOn : p.mfaOff}</span>
      </div>
      {verified ? (
        <button type="button" onClick={disable} disabled={busy} className={buttonClass('outline', 'sm', 'text-rose-700')}>{p.mfaDisable}</button>
      ) : enroll ? (
        <div className="space-y-4 rounded-2xl border border-sand-200 p-4">
          <p className="text-sm">{p.mfaScan}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enroll.qr} alt="QR" className="h-44 w-44 rounded-xl bg-white p-2 ring-1 ring-sand-200" />
          <div className="text-xs text-stone-450">{p.mfaSecret}: <code dir="ltr" className="select-all break-all rounded bg-sand-100 px-1.5 py-0.5 text-ink">{enroll.secret}</code></div>
          <div className="flex items-end gap-2">
            <Field label={p.mfaCode} className="w-40"><Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" dir="ltr" autoComplete="one-time-code" /></Field>
            <button type="button" onClick={verify} disabled={busy || code.length !== 6} className={buttonClass('primary', 'md')}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{p.mfaVerify}</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={start} disabled={busy} className={buttonClass('primary', 'md')}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}{p.mfaEnable}</button>
      )}
      {msg && <p className={cx('text-sm', msg.ok ? 'text-emerald-700' : 'text-rose-700')}>{msg.text}</p>}
    </div>
  );
}

/** Second step at sign-in */
export function MfaChallenge({ next }: { next: string }) {
  const { d } = useI18n();
  const p = d.privacy;
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const sb = createClient();
    const { data } = await sb.auth.mfa.listFactors();
    const f = data?.totp?.[0];
    if (!f) { window.location.href = next; return; }
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: f.id, code: code.trim() });
    setBusy(false);
    if (error) { setErr(p.mfaWrong); return; }
    window.location.href = next;
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={p.mfaCode}>
        <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" dir="ltr" autoFocus autoComplete="one-time-code" className="text-center text-2xl tracking-[0.5em]" />
      </Field>
      {err && <p className="text-sm text-rose-700">{err}</p>}
      <button type="submit" disabled={busy || code.length !== 6} className={buttonClass('primary', 'lg', 'w-full')}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{p.mfaVerify}</button>
    </form>
  );
}
