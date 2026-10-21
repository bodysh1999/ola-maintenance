import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentProfile, getI18n, getSettings, homeFor } from '@/lib/session';
import { BrandMark } from '@/components/brand';
import { LocaleToggle } from '@/components/locale-toggle';
import { Alert } from '@/components/ui';
import { LoginForm } from './login-form';
import { SocialLinks } from '@/components/contact-links';

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
          <p className="mt-4 leading-relaxed text-white/70">
            {locale === 'ar'
              ? 'قناة موحّدة للتواصل والاعتناء باحتياجاتك، ومتابعة فعّالة لطلبك حتى إغلاقه — بما يحافظ على قيمة بيتك.'
              : 'One channel to reach us and care for your home, with every request followed through to closure.'}
          </p>
        </div>
        <div>
          <div className="grid max-w-lg grid-cols-4 gap-6 text-sm text-white/60">
            {(locale === 'ar'
              ? [['+20', 'عامًا من الخبرة'], ['+50', 'مشروعًا'], ['+750', 'وحدة سكنية'], ['+3,750', 'مستفيد']]
              : [['20+', 'years'], ['50+', 'projects'], ['750+', 'homes'], ['3,750+', 'residents']]
            ).map(([n, l]) => (
              <div key={l}><div className="text-2xl font-semibold text-white"><span dir="ltr">{n}</span></div>{l}</div>
            ))}
          </div>
          <SocialLinks s={s} light className="mt-8" />
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
        {(s.support_phone || s.whatsapp) && (
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-stone-450">
            <span>{d.owner.support}</span>
            {s.support_phone && <a href={`tel:${s.support_phone}`} dir="ltr" className="hover:text-ink">{s.support_phone}</a>}
            {s.whatsapp && <a href={`https://wa.me/${s.whatsapp}`} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">{d.owner.whatsapp}</a>}
            {s.website_url && <a href={s.website_url} target="_blank" rel="noreferrer" dir="ltr" className="hover:text-ink">{s.website_url.replace(/^https?:\/\/(www\.)?/, '')}</a>}
          </div>
        )}
      </section>
    </div>
  );
}
