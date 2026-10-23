import Link from 'next/link';
import type { ReactNode } from 'react';
import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { getCurrentProfile, getI18n, getSettings, homeFor } from '@/lib/session';
import { siteContent } from '@/lib/site-content';
import { pagesContent } from '@/lib/site-pages';
import type { CompanySettings } from '@/lib/types';
import { DEFAULT_LOGO } from './brand';
import { SiteHeader, WhatsAppFloat, type HeaderContact } from './site';

export const DEEP = 'bg-[#2A1F3A]';

/** Everything the public pages share: texts, company settings, signed-in state */
export async function getSiteChrome() {
  const [{ locale }, s, profile] = await Promise.all([getI18n(), getSettings(), getCurrentProfile()]);
  const loggedIn = !!profile?.is_active;
  return {
    locale, s,
    t: siteContent(locale),
    pg: pagesContent(locale),
    ar: locale === 'ar',
    name: locale === 'ar' ? s.name_ar : s.name_en,
    logo: s.logo_url || DEFAULT_LOGO,
    loggedIn,
    portalHref: loggedIn ? homeFor(profile!.role) : '/login',
  };
}
export type SiteChrome = Awaited<ReturnType<typeof getSiteChrome>>;

function contactOf(s: CompanySettings): HeaderContact {
  return {
    phone: s.support_phone, email: s.support_email, whatsapp: s.whatsapp,
    socials: [
      s.instagram_url && { href: s.instagram_url, label: 'Instagram' },
      s.snapchat_url && { href: s.snapchat_url, label: 'Snapchat' },
      s.tiktok_url && { href: s.tiktok_url, label: 'TikTok' },
    ].filter(Boolean) as HeaderContact['socials'],
  };
}

/** Header + footer + floating WhatsApp around a public page */
export function SiteFrame({ c, children, solidHeader = false }: { c: SiteChrome; children: ReactNode; solidHeader?: boolean }) {
  return (
    <div id="top" className="overflow-x-clip bg-sand-50 text-ink">
      <SiteHeader t={c.t} logo={c.logo} name={c.name} portalHref={c.portalHref} loggedIn={c.loggedIn} contact={contactOf(c.s)} solidAlways={solidHeader} />
      <main>{children}</main>
      <SiteFooter c={c} />
      <WhatsAppFloat phone={c.s.whatsapp} label={c.t.contact.whatsapp} />
    </div>
  );
}

/** Title band for inner pages */
export function PageHero({ eyebrow, title, body, crumbs, children }: {
  eyebrow?: string; title: string; body?: string; crumbs?: { href: string; label: string }[]; children?: ReactNode;
}) {
  return (
    <section className={`relative isolate overflow-hidden ${DEEP} pb-16 pt-32 text-white sm:pb-20 sm:pt-44`}>
      <div className="texture-lines absolute inset-0 -z-10 opacity-40" />
      <div className="absolute -end-40 -top-40 -z-10 h-[520px] w-[520px] rounded-full bg-brand blur-3xl" />
      <div className="pointer-events-none absolute -bottom-36 end-[8%] -z-10 hidden h-80 w-56 rounded-arch border border-accent/30 md:block" />
      <div className="pointer-events-none absolute -bottom-44 end-[15%] -z-10 hidden h-80 w-56 rounded-arch border border-white/10 md:block" />
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        {crumbs && (
          <nav aria-label="breadcrumb" className="rise-in mb-6 flex flex-wrap items-center gap-2 text-sm text-white/55">
            {crumbs.map((c, i) => (
              <span key={c.href} className="flex items-center gap-2">
                {i > 0 && <span aria-hidden>/</span>}
                <Link href={c.href} className="hover:text-white">{c.label}</Link>
              </span>
            ))}
          </nav>
        )}
        {eyebrow && <p className="rise-in text-sm text-accent">{eyebrow}</p>}
        <h1 className="rise-in mt-3 max-w-4xl font-display text-5xl font-bold leading-[1.15] sm:text-6xl lg:text-7xl">{title}</h1>
        {body && <p className="rise-in-2 mt-6 max-w-2xl text-lg leading-loose text-white/75">{body}</p>}
        {children && <div className="rise-in-3 mt-8">{children}</div>}
      </div>
    </section>
  );
}

export function SiteFooter({ c }: { c: SiteChrome }) {
  const { t, s, name, logo, portalHref } = c;
  const col = 'mb-4 text-sm font-semibold text-accent';
  const link = 'transition hover:text-white';
  const socials = contactOf(s).socials;
  return (
    <footer className={`${DEEP} text-white`}>
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt={name} className="h-14 w-auto" />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/55">{t.about.badge} — {t.hero.eyebrow}</p>
          {socials.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {socials.map((l) => <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="rounded-full border border-white/15 px-3.5 py-1.5 text-xs text-white/70 transition hover:border-white/40 hover:text-white">{l.label}</a>)}
            </div>
          )}
        </div>
        <nav aria-label={t.footer.quick}>
          <div className={col}>{t.footer.quick}</div>
          <ul className="space-y-2.5 text-sm text-white/70">
            <li><Link href="/#about" className={link}>{t.nav.about}</Link></li>
            <li><Link href="/projects" className={link}>{t.nav.projects}</Link></li>
            <li><Link href="/services" className={link}>{t.nav.services}</Link></li>
            <li><Link href="/careers" className={link}>{t.nav.careers}</Link></li>
          </ul>
        </nav>
        <nav aria-label={t.nav.afterSales}>
          <div className={col}>{t.nav.afterSales}</div>
          <ul className="space-y-2.5 text-sm text-white/70">
            <li><Link href={portalHref} className={link}>{c.loggedIn ? t.nav.dashboard : t.nav.portal}</Link></li>
            {!c.loggedIn && <li><Link href="/login?portal=staff" className={link}>{t.nav.staffPortal}</Link></li>}
            <li><Link href="/#after-sales" className={link}>{t.afterSales.title}</Link></li>
            <li><Link href="/#contact" className={link}>{t.nav.contact}</Link></li>
          </ul>
        </nav>
        <div>
          <div className={col}>{t.nav.contact}</div>
          <ul className="space-y-3 text-sm text-white/70">
            {s.support_phone && <li><a href={`tel:${s.support_phone}`} className={`flex items-center gap-2 ${link}`}><Phone className="h-4 w-4 text-accent" /><span dir="ltr">{s.support_phone}</span></a></li>}
            {s.whatsapp && <li><a href={`https://wa.me/${s.whatsapp}`} target="_blank" rel="noreferrer" className={`flex items-center gap-2 ${link}`}><MessageCircle className="h-4 w-4 text-accent" /><span dir="ltr">+{s.whatsapp}</span></a></li>}
            {s.support_email && <li><a href={`mailto:${s.support_email}`} className={`flex items-center gap-2 ${link}`}><Mail className="h-4 w-4 text-accent" /><span dir="ltr">{s.support_email}</span></a></li>}
            <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-accent" />{t.nav.city}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-5 py-5 text-xs text-white/45 sm:px-8">
          <span>© {new Date().getFullYear()} {name}. {t.footer.rights}</span>
          <span className="flex gap-4">
            <Link href="/privacy" className="hover:text-white">{c.ar ? 'سياسة الخصوصية' : 'Privacy policy'}</Link>
            <Link href="/terms" className="hover:text-white">{c.ar ? 'الشروط والأحكام' : 'Terms'}</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
