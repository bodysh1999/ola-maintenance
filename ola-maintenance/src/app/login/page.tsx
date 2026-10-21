import { redirect } from 'next/navigation';
import { MessageCircle, Phone, ShieldCheck, Wrench, CalendarClock } from 'lucide-react';
import { getCurrentProfile, getI18n, getSettings, homeFor } from '@/lib/session';
import { LOGIN_HERO_IMAGE } from '@/lib/constants';
import { DEFAULT_LOGO } from '@/components/brand';
import { LocaleToggle } from '@/components/locale-toggle';
import { SocialLinks } from '@/components/contact-links';
import { Alert } from '@/components/ui';
import { LoginForm } from './login-form';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ disabled?: string }> }) {
  const profile = await getCurrentProfile();
  if (profile?.is_active) redirect(homeFor(profile.role));
  const [{ d, locale }, s, sp] = await Promise.all([getI18n(), getSettings(), searchParams]);
  const ar = locale === 'ar';
  const name = ar ? s.name_ar : s.name_en;
  const logo = s.logo_url || DEFAULT_LOGO;

  const features = ar
    ? [[Wrench, 'بلّغ عن العطل', 'بالصور والفيديو في أقل من دقيقة'], [CalendarClock, 'تابع كل مرحلة', 'وموعد زيارة الفني لحظة بلحظة'], [ShieldCheck, 'ضمان واضح', 'تعرف ما يشمله ضمان وحدتك']]
    : [[Wrench, 'Report an issue', 'with photos or video in under a minute'], [CalendarClock, 'Track every step', 'and the technician visit in real time'], [ShieldCheck, 'Clear warranty', 'know exactly what your home covers']];
  const stats = ar
    ? [['+20', 'عامًا'], ['+50', 'مشروعًا'], ['+750', 'وحدة'], ['+3,750', 'مستفيد']]
    : [['20+', 'years'], ['50+', 'projects'], ['750+', 'homes'], ['3,750+', 'residents']];

  return (
    <div className="grid min-h-screen bg-sand-50 lg:grid-cols-[1.15fr_1fr]">
      {/* ============ Brand panel (desktop) / hero band (mobile) ============ */}
      <section className="relative isolate overflow-hidden bg-brand text-white lg:min-h-screen">
        {/* project photo with brand-tinted overlay */}
        <div className="absolute inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: `url("${LOGIN_HERO_IMAGE}")` }} />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-brand/80 via-brand/85 to-brand lg:bg-gradient-to-t lg:from-brand lg:via-brand/85 lg:to-brand/55" />
        <div className="texture-lines absolute inset-0 -z-10 opacity-60" />

        <div className="flex h-full flex-col px-6 pb-16 pt-6 sm:px-10 lg:p-12">
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} alt={name} className="h-12 w-auto shrink-0 object-contain lg:h-16" />
              <div className="hidden min-w-0 border-s border-white/20 ps-3 leading-tight sm:block">
                <div className="truncate text-sm font-semibold lg:text-base">{name}</div>
                <div className="truncate text-[11px] text-white/60">{ar ? 'خدمات ما بعد البيع' : 'After-sales services'}</div>
              </div>
            </div>
            <LocaleToggle light className="shrink-0 lg:hidden" />
          </div>

          <div className="mt-8 max-w-lg lg:mt-auto">
            <div className="rise-in mb-5 hidden h-px w-16 bg-accent lg:block" />
            <h2 className="rise-in text-[26px] font-bold leading-[1.45] sm:text-3xl lg:text-[42px] lg:leading-[1.35]">
              {ar ? <>بيتك في عهدتنا،<br className="hidden lg:block" /> حتى بعد الاستلام.</> : <>Your home stays in our care,<br className="hidden lg:block" /> long after handover.</>}
            </h2>
            <p className="rise-in-2 mt-3 max-w-md text-sm leading-relaxed text-white/75 lg:mt-5 lg:text-base">
              {ar
                ? 'قناة موحّدة للتواصل والاعتناء باحتياجاتك، ومتابعة فعّالة لطلبك حتى إغلاقه — بما يحافظ على قيمة بيتك.'
                : 'One channel to reach us and care for your home, with every request followed through to closure.'}
            </p>

            <ul className="rise-in-3 mt-10 hidden space-y-4 lg:block">
              {features.map(([Icon, t, sub]) => {
                const I = Icon as typeof Wrench;
                return (
                  <li key={t as string} className="flex items-center gap-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-accent ring-1 ring-white/15 backdrop-blur"><I className="h-5 w-5" /></span>
                    <span><span className="block font-medium">{t as string}</span><span className="text-sm text-white/60">{sub as string}</span></span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-12 hidden lg:block">
            <div className="grid max-w-xl grid-cols-4 gap-3">
              {stats.map(([n, l]) => (
                <div key={l} className="rounded-2xl bg-white/[.07] px-4 py-3 ring-1 ring-white/10 backdrop-blur">
                  <div className="text-2xl font-bold"><span dir="ltr">{n}</span></div>
                  <div className="text-xs text-white/60">{l}</div>
                </div>
              ))}
            </div>
            <SocialLinks s={s} light className="mt-6" />
          </div>
        </div>
      </section>

      {/* ============ Form ============ */}
      <section className="relative flex min-w-0 flex-col px-4 pb-8 sm:px-10 lg:px-14 lg:py-8">
        <div className="hidden justify-end lg:flex"><LocaleToggle /></div>

        <div className="-mt-10 flex flex-1 flex-col justify-center lg:mt-0">
          <div className="rise-in mx-auto w-full max-w-md rounded-[28px] border border-sand-200 bg-white p-6 shadow-lift sm:p-9 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
            <h1 className="text-2xl font-bold tracking-tight">{ar ? 'أهلًا بك' : 'Welcome back'}</h1>
            <p className="mt-1.5 text-sm text-stone-450">{d.auth.subtitle}</p>
            {sp.disabled && <Alert tone="error" className="mt-5">{d.auth.disabled}</Alert>}
            <div className="mt-7"><LoginForm /></div>

            <div className="mt-8 rounded-2xl bg-sand-100/70 p-4">
              <p className="text-xs leading-relaxed text-stone-450">{d.auth.noAccount}</p>
              {(s.support_phone || s.whatsapp) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {s.whatsapp && (
                    <a href={`https://wa.me/${s.whatsapp}`} target="_blank" rel="noreferrer"
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700">
                      <MessageCircle className="h-4 w-4" />{ar ? 'تواصل عبر واتساب' : 'WhatsApp us'}
                    </a>
                  )}
                  {s.support_phone && (
                    <a href={`tel:${s.support_phone}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-sand-300 bg-white px-3 text-xs font-medium text-ink hover:bg-sand-50">
                      <Phone className="h-4 w-4" /><span dir="ltr">{s.support_phone}</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-[11px] text-stone-400">
          © {new Date().getFullYear()} {name}
        </p>
      </section>
    </div>
  );
}
