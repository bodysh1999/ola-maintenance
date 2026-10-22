'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpLeft, BadgeCheck, CalendarCheck, ChevronDown, KeyRound, Mail, MapPin, Menu, MessageCircle, Phone, X } from 'lucide-react';
import { waLink, type SiteContent, type SiteProject } from '@/lib/site-content';
import { LocaleToggle } from './locale-toggle';
import { cx } from './ui';

// ------------------------------------------------------------------ header (contact bar + main navigation)
export type HeaderContact = { phone: string | null; email: string | null; whatsapp: string | null; socials: { href: string; label: string }[] };

export function SiteHeader({ t, logo, name, portalHref, loggedIn, contact, solidAlways = false }: {
  t: SiteContent; logo: string; name: string; portalHref: string; loggedIn: boolean; contact: HeaderContact; solidAlways?: boolean;
}) {
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const home = path === '/';
  const links: { href: string; label: string; active: boolean }[] = [
    { href: '/', label: t.nav.home, active: home },
    { href: '/#about', label: t.nav.about, active: false },
    { href: '/projects', label: t.nav.projects, active: path.startsWith('/projects') },
    { href: '/services', label: t.nav.services, active: path.startsWith('/services') },
    { href: '/#after-sales', label: t.nav.afterSales, active: false },
    { href: '/careers', label: t.nav.careers, active: path.startsWith('/careers') },
    { href: '/#contact', label: t.nav.contact, active: false },
  ];
  const solid = solidAlways || scrolled || open;

  return (
    <header className={cx('fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow] duration-300',
      solid ? 'bg-[#2A1F3A]/[.97] shadow-[0_8px_30px_-12px_rgba(0,0,0,.45)] backdrop-blur-md' : 'bg-gradient-to-b from-[#1E1628]/70 to-transparent')}>
      {/* contact bar — folds away once the page scrolls */}
      <div className={cx('hidden overflow-hidden border-b border-white/10 text-[13px] text-white/65 transition-[max-height,opacity] duration-300 md:block',
        scrolled ? 'max-h-0 border-transparent opacity-0' : 'max-h-10 opacity-100')}>
        <div className="mx-auto flex h-10 max-w-7xl items-center gap-6 px-5 sm:px-8">
          {contact.phone && <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1.5 hover:text-white"><Phone className="h-3.5 w-3.5 text-accent" /><span dir="ltr">{contact.phone}</span></a>}
          {contact.email && <a href={`mailto:${contact.email}`} className="hidden items-center gap-1.5 hover:text-white lg:inline-flex"><Mail className="h-3.5 w-3.5 text-accent" /><span dir="ltr">{contact.email}</span></a>}
          <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-accent" />{t.nav.city}</span>
          <div className="ms-auto flex items-center gap-4">
            {contact.socials.map((l) => <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="hover:text-white">{l.label}</a>)}
            <span className="h-4 w-px bg-white/15" />
            <LocaleToggle light className="h-8 px-2 text-[13px]" />
          </div>
        </div>
      </div>

      <div className={cx('mx-auto flex max-w-7xl items-center gap-6 px-5 transition-[height] duration-300 sm:px-8', scrolled ? 'h-[68px]' : 'h-[76px]')}>
        <Link href="/" className="shrink-0" aria-label={name}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt={name} className={cx('w-auto object-contain transition-[height] duration-300', scrolled ? 'h-10' : 'h-11')} />
        </Link>
        <nav aria-label="main" className="hidden flex-1 items-center justify-center gap-1 xl:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} aria-current={l.active ? 'page' : undefined}
              className={cx('relative rounded-full px-3.5 py-2 text-[15px] transition',
                l.active ? 'text-white' : 'text-white/70 hover:text-white',
                'after:absolute after:inset-x-3.5 after:-bottom-0.5 after:h-[2px] after:rounded-full after:bg-accent after:transition-transform',
                l.active ? 'after:scale-x-100' : 'after:scale-x-0 hover:after:scale-x-100')}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-2 xl:ms-0">
          <Link href="/projects" className="hidden h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-white transition hover:bg-accent/90 md:inline-flex xl:hidden 2xl:inline-flex">
            <CalendarCheck className="h-4 w-4" />{t.nav.bookVisit}
          </Link>
          {loggedIn ? (
            <Link href={portalHref} className="hidden h-11 items-center gap-2 rounded-full border border-white/25 px-5 text-sm font-medium text-white transition hover:border-white/60 hover:bg-white/10 sm:inline-flex">
              <KeyRound className="h-4 w-4 text-accent" />{t.nav.dashboard}
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden h-11 items-center gap-2 rounded-full border border-white/25 px-4 text-sm font-medium text-white transition hover:border-white/60 hover:bg-white/10 sm:inline-flex">
                <KeyRound className="h-4 w-4 text-accent" />{t.nav.portal}
              </Link>
              <Link href="/login?portal=staff" className="hidden h-11 items-center gap-2 rounded-full border border-white/25 px-4 text-sm font-medium text-white transition hover:border-white/60 hover:bg-white/10 sm:inline-flex">
                <BadgeCheck className="h-4 w-4 text-accent" />{t.nav.staffPortal}
              </Link>
            </>
          )}
          <button aria-label="menu" aria-expanded={open} onClick={() => setOpen(!open)} className="grid h-11 w-11 place-items-center rounded-full text-white hover:bg-white/10 xl:hidden">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="h-[calc(100svh-76px)] overflow-y-auto border-t border-white/10 px-5 pb-10 pt-2 xl:hidden">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
              className={cx('flex items-center justify-between border-b border-white/[.07] py-4 text-lg', l.active ? 'text-accent' : 'text-white/85')}>
              {l.label}<ChevronDown className="h-4 w-4 -rotate-90 opacity-40 rtl:rotate-90" />
            </Link>
          ))}
          <div className="mt-6 grid gap-3">
            <Link href="/projects" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent font-semibold text-white"><CalendarCheck className="h-4 w-4" />{t.nav.bookVisit}</Link>
            <Link href={portalHref} className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/25 font-medium text-white"><KeyRound className="h-4 w-4 text-accent" />{loggedIn ? t.nav.dashboard : t.nav.portal}</Link>
            {!loggedIn && <Link href="/login?portal=staff" className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/25 font-medium text-white"><BadgeCheck className="h-4 w-4 text-accent" />{t.nav.staffPortal}</Link>}
          </div>
          <div className="mt-8 space-y-3 text-sm text-white/60">
            {contact.phone && <a href={`tel:${contact.phone}`} className="flex items-center gap-2"><Phone className="h-4 w-4 text-accent" /><span dir="ltr">{contact.phone}</span></a>}
            {contact.email && <a href={`mailto:${contact.email}`} className="flex items-center gap-2"><Mail className="h-4 w-4 text-accent" /><span dir="ltr">{contact.email}</span></a>}
            <div className="flex items-center gap-4 pt-2"><LocaleToggle light />{contact.socials.map((l) => <a key={l.href} href={l.href} target="_blank" rel="noreferrer">{l.label}</a>)}</div>
          </div>
        </div>
      )}
    </header>
  );
}

// ------------------------------------------------------------------ partners marquee
export function PartnersMarquee({ logos, label }: { logos: string[]; label: string }) {
  // each half must be wider than the screen for a seamless loop → repeat short lists
  const half = logos.length < 8 ? [...logos, ...logos] : logos;
  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {half.map((src, i) => (
        <li key={`${src}-${i}`} className="mx-4 grid h-24 w-44 shrink-0 place-items-center rounded-2xl border border-sand-200 bg-white px-6 sm:mx-5 sm:w-52">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={hidden || i >= logos.length ? '' : label} loading="lazy" className="max-h-14 w-auto object-contain opacity-70 grayscale transition duration-300 hover:opacity-100 hover:grayscale-0" />
        </li>
      ))}
    </ul>
  );
  return (
    <div className="marquee overflow-hidden py-2" style={{ ['--marquee-speed' as string]: `${half.length * 4.5}s` }}>
      <div className="marquee-track">{row(false)}{row(true)}</div>
    </div>
  );
}

// ------------------------------------------------------------------ animated counter (runs once when visible)
export function CountUp({ to, prefix = '' }: { to: number; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setVal(to); return; }
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / 1400);
        setVal(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.5 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to]);
  return <span ref={ref} dir="ltr">{prefix}{val.toLocaleString('en-US')}</span>;
}

// ------------------------------------------------------------------ projects: arches + stage filter
export function ProjectsGrid({ projects, t, locale, whatsapp }: { projects: SiteProject[]; t: SiteContent; locale: 'ar' | 'en'; whatsapp: string | null }) {
  const [filter, setFilter] = useState<'all' | SiteProject['sales_status']>('all');
  const stages = (['construction', 'selling', 'sold'] as const).filter((s) => projects.some((p) => p.sales_status === s));
  const list = filter === 'all' ? projects : projects.filter((p) => p.sales_status === filter);
  const nm = (p: SiteProject) => (locale === 'en' && p.name_en ? p.name_en : p.name_ar);
  return (
    <>
      <div role="tablist" className="mb-12 flex flex-wrap gap-x-7 gap-y-2 border-b border-sand-200">
        {(['all', ...stages] as const).map((s) => (
          <button key={s} role="tab" aria-selected={filter === s} onClick={() => setFilter(s)}
            className={cx('-mb-px border-b-2 pb-3 text-[15px] transition', filter === s ? 'border-brand font-semibold text-brand' : 'border-transparent text-stone-450 hover:text-ink')}>
            {s === 'all' ? t.projects.all : t.projects.stage[s]}
            <span className="ms-1.5 text-xs text-stone-450">({s === 'all' ? projects.length : projects.filter((p) => p.sales_status === s).length})</span>
          </button>
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-5 gap-y-12 sm:gap-x-8 lg:grid-cols-4">
        {list.map((p) => (
          <li key={p.name_ar} className="group relative">
            <div className="relative aspect-[3/4] overflow-hidden rounded-arch bg-brand">
              {p.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_url} alt={nm(p)} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" />
              )}
              <div className="pointer-events-none absolute inset-0 rounded-arch ring-1 ring-inset ring-black/5" />
            </div>
            <div className="mt-4 flex items-baseline justify-between gap-2">
              <h3 className="font-display text-xl font-bold text-ink">
                {p.id ? <Link href={`/projects/${p.id}`} className="after:absolute after:inset-0 after:content-['']">{nm(p)}</Link> : nm(p)}
              </h3>
              <span className={cx('shrink-0 text-xs', p.sales_status === 'selling' ? 'font-semibold text-accent' : 'text-stone-450')}>{t.projects.stage[p.sales_status]}</span>
            </div>
            {p.id ? (
              <span className="mt-1.5 inline-flex items-center gap-1 text-sm text-brand transition group-hover:gap-2">
                {p.sales_status === 'selling' ? t.featured.units : t.projects.details}<ArrowUpLeft className="h-3.5 w-3.5 ltr:-scale-x-100" />
              </span>
            ) : p.sales_status !== 'sold' && whatsapp && (
              <a href={waLink(whatsapp, `${t.featured.message} ${nm(p)}`)} target="_blank" rel="noreferrer" className="mt-1.5 inline-block text-sm text-brand underline-offset-4 hover:underline">
                {t.inquire}
              </a>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

// ------------------------------------------------------------------ FAQ (native details/summary — keyboard accessible)
export function Faq({ items }: { items: string[][] }) {
  return (
    <div className="divide-y divide-sand-200 border-y border-sand-200">
      {items.map(([q, a]) => (
        <details key={q} className="group py-1">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-lg font-medium text-ink marker:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
            {q}
            <ChevronDown className="h-5 w-5 shrink-0 text-accent transition-transform duration-300 group-open:rotate-180" />
          </summary>
          <p className="max-w-3xl pb-6 leading-loose text-ink/70">{a}</p>
        </details>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ floating WhatsApp
export function WhatsAppFloat({ phone, label }: { phone: string | null; label: string }) {
  if (!phone) return null;
  return (
    <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" aria-label={label}
      className="fixed bottom-5 end-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-emerald-600 text-white shadow-lift transition hover:scale-105 hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
      <MessageCircle className="h-6 w-6" />
    </a>
  );
}
