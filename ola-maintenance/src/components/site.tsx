'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Menu, MessageCircle, X } from 'lucide-react';
import { waLink, type SiteContent, type SiteProject } from '@/lib/site-content';
import { LocaleToggle } from './locale-toggle';
import { cx } from './ui';

// ------------------------------------------------------------------ header
export function SiteHeader({ t, logo, name, portalHref, loggedIn }: { t: SiteContent; logo: string; name: string; portalHref: string; loggedIn: boolean }) {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 40);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const links = [['#about', t.nav.about], ['#projects', t.nav.projects], ['#after-sales', t.nav.afterSales], ['#contact', t.nav.contact]];
  return (
    <header className={cx('fixed inset-x-0 top-0 z-50 transition-colors duration-300', solid || open ? 'bg-[#2A1F3A]/95 backdrop-blur-md' : 'bg-transparent')}>
      <div className="mx-auto flex h-[76px] max-w-7xl items-center gap-8 px-5 sm:px-8">
        <a href="#top" className="shrink-0" aria-label={name}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt={name} className="h-11 w-auto object-contain" />
        </a>
        <nav className="hidden flex-1 items-center gap-7 lg:flex">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="relative py-2 text-[15px] text-white/75 transition hover:text-white after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-center after:scale-x-0 after:bg-accent after:transition hover:after:scale-x-100">{label}</a>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-2">
          <LocaleToggle light className="hidden sm:inline-flex" />
          <Link href={portalHref} className="hidden h-11 items-center rounded-full border border-accent/70 px-6 text-sm font-medium text-white transition hover:bg-accent hover:text-white sm:inline-flex">
            {loggedIn ? t.nav.dashboard : t.nav.portal}
          </Link>
          <button aria-label="menu" aria-expanded={open} onClick={() => setOpen(!open)} className="grid h-11 w-11 place-items-center rounded-full text-white hover:bg-white/10 lg:hidden">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-white/10 px-5 pb-6 pt-2 lg:hidden">
          {links.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} className="block border-b border-white/[.06] py-4 text-lg text-white/85">{label}</a>
          ))}
          <div className="mt-5 flex items-center gap-3">
            <LocaleToggle light />
            <Link href={portalHref} className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-accent px-5 font-medium text-white">
              {loggedIn ? t.nav.dashboard : t.nav.portal}
            </Link>
          </div>
        </div>
      )}
    </header>
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
          <li key={p.name_ar} className="group">
            <div className="relative aspect-[3/4] overflow-hidden rounded-arch bg-brand">
              {p.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_url} alt={nm(p)} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" />
              )}
              <div className="pointer-events-none absolute inset-0 rounded-arch ring-1 ring-inset ring-black/5" />
            </div>
            <div className="mt-4 flex items-baseline justify-between gap-2">
              <h3 className="font-display text-xl font-bold text-ink">{nm(p)}</h3>
              <span className={cx('shrink-0 text-xs', p.sales_status === 'selling' ? 'font-semibold text-accent' : 'text-stone-450')}>{t.projects.stage[p.sales_status]}</span>
            </div>
            {p.sales_status !== 'sold' && whatsapp && (
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
