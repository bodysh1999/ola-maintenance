import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { getCurrentProfile, getI18n, getSettings, homeFor } from '@/lib/session';
import { fmtDate } from '@/lib/format';
import { ConsentForm } from '@/components/privacy-client';

/** Shown once per policy version before using any portal */
export default async function ConsentPage() {
  const [profile, { d, locale }, s] = await Promise.all([getCurrentProfile(), getI18n(), getSettings()]);
  if (!profile) redirect('/login');
  if ((profile.privacy_accepted_version ?? '') === (s.privacy_version ?? '1.0')) redirect(homeFor(profile.role));
  const p = d.privacy;
  return (
    <div className="grid min-h-screen place-items-center bg-sand-50 px-5 py-10">
      <div className="w-full max-w-lg rounded-[28px] border border-sand-200 bg-white p-7 shadow-lift sm:p-9">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand text-accent"><ShieldCheck className="h-7 w-7" /></div>
        <h1 className="mt-5 font-display text-2xl font-bold">{p.gateTitle}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink/70">{p.gateBody}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/privacy" target="_blank" className="inline-flex h-10 items-center rounded-xl border border-sand-200 px-4 text-sm font-medium text-brand hover:border-brand/40">{p.policy}</Link>
          <Link href="/terms" target="_blank" className="inline-flex h-10 items-center rounded-xl border border-sand-200 px-4 text-sm font-medium text-brand hover:border-brand/40">{p.terms}</Link>
        </div>
        <p className="mt-2 text-xs text-stone-450">{p.version} {s.privacy_version ?? '1.0'} · {p.updatedOn}: {fmtDate(s.privacy_updated_on ?? null, locale)}</p>
        <div className="mt-6"><ConsentForm /></div>
      </div>
    </div>
  );
}
