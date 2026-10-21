import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentProfile, getI18n, getSettings, homeFor } from '@/lib/session';
import { BrandMark } from '@/components/brand';
import { LocaleToggle } from '@/components/locale-toggle';
import { Alert } from '@/components/ui';
import { LoginForm } from './login-form';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ disabled?: string }> }) {
  const profile = await getCurrentProfile();
  if (profile?.is_active) redirect(homeFor(profile.role));
  const [{ d, locale }, s, sp] = await Promise.all([getI18n(), getSettings(), searchParams]);

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <section className="texture-lines relative hidden overflow-hidden bg-brand p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <BrandMark s={s} locale={locale} light size="lg" />
        <div className="max-w-md">
          <div className="mb-6 h-px w-16 bg-accent" />
          <h2 className="text-4xl font-semibold leading-[1.3] tracking-tight">
            {locale === 'ar' ? 'بيتك في عهدتنا، حتى بعد الاستلام.' : 'Your home stays in our care, long after handover.'}
          </h2>
          <p className="mt-4 text-white/70">
            {locale === 'ar'
              ? 'بلّغ عن أي عطل، تابع كل مرحلة، واعرف موعد زيارة الفني — من مكان واحد.'
              : 'Report an issue, follow every stage and know exactly when the technician arrives — all in one place.'}
          </p>
        </div>
        <div className="flex gap-8 text-sm text-white/60">
          <div><div className="text-2xl font-semibold text-white">24/7</div>{locale === 'ar' ? 'استقبال البلاغات' : 'request intake'}</div>
          <div><div className="text-2xl font-semibold text-accent">●</div>{locale === 'ar' ? 'متابعة لحظية' : 'live tracking'}</div>
        </div>
        <div className="pointer-events-none absolute -bottom-32 -end-32 h-96 w-96 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -bottom-20 -end-20 h-72 w-72 rounded-full border border-accent/30" />
      </section>

      {/* Form */}
      <section className="flex min-w-0 flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1 lg:hidden"><BrandMark s={s} locale={locale} /></div>
          <LocaleToggle className="ms-auto shrink-0" />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-2xl font-semibold tracking-tight">{d.auth.title}</h1>
          <p className="mt-1.5 text-sm text-stone-450">{d.auth.subtitle}</p>
          {sp.disabled && <Alert tone="error" className="mt-6">{d.auth.disabled}</Alert>}
          <LoginForm />
          <Link href="/forgot-password" className="mt-4 text-center text-sm text-brand hover:underline">{d.auth.forgot}</Link>
          <p className="mt-10 border-t border-sand-200 pt-5 text-xs leading-relaxed text-stone-450">{d.auth.noAccount}</p>
        </div>
        {s.support_phone && (
          <p className="text-center text-xs text-stone-450">{d.owner.support}: <span dir="ltr">{s.support_phone}</span></p>
        )}
      </section>
    </div>
  );
}
