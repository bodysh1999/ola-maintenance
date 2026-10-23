import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile, getI18n, homeFor } from '@/lib/session';
import { MfaChallenge } from '@/components/privacy-client';
import { signOut } from '@/app/actions/common';

/** Second sign-in step for accounts with two-step login */
export default async function MfaPage() {
  const supabase = await createClient();
  const [profile, { d }] = await Promise.all([getCurrentProfile(), getI18n()]);
  if (!profile) redirect('/login');
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const home = homeFor(profile.role);
  if (aal?.currentLevel === 'aal2' || aal?.nextLevel !== 'aal2') redirect(home);
  const p = d.privacy;
  return (
    <div className="grid min-h-screen place-items-center bg-sand-50 px-5">
      <div className="w-full max-w-sm rounded-[28px] border border-sand-200 bg-white p-7 shadow-lift">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand text-accent"><ShieldCheck className="h-7 w-7" /></div>
        <h1 className="mt-5 text-xl font-bold">{p.mfaTitle}</h1>
        <p className="mt-1.5 text-sm text-stone-450">{p.mfaChallenge}</p>
        <div className="mt-6"><MfaChallenge next={home} /></div>
        <form action={signOut} className="mt-4 text-center"><button className="text-sm text-stone-450 hover:text-ink">{d.common.logout}</button></form>
      </div>
    </div>
  );
}
