'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import type { SiteContent, SiteProject } from '@/lib/site-content';
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
  const links = [
    ['#about', t.nav.about], ['#projects', t.nav.projects], ['#after-sales', t.nav.afterSales], ['#contact', t.nav.contact],
  ];
  return (
    <header className={cx('fixed inset-x-0 top-0 z-50 transition-all duration-300', solid || open ? 'bg-brand/95 shadow-lift backdrop-blur-md' : 'bg-transparent')}>
      <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-6 px-5 sm:px-8">
        <a href="#top" className="flex shrink-0 items-center gap-3" aria-label={name}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt={name} className="h-11 w-auto object-contain" />
        </a>
        <nav className="hidden flex-1 items-center gap-1 lg:flex">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="rounded-lg px-3.5 py-2 text-[15px] text-white/80 transition hover:bg-white/10 hover:text-white">{label}</a>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-2">
          <LocaleToggle light className="hidden sm:inline-flex" />
          <Link href={portalHref} className="hidden h-10 items-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-white shadow-lift transition hover:bg-accent/90 sm:inline-flex">
            {loggedIn ? t.nav.dashboard : t.nav.portal}
          </Link>
          <button aria-label="menu" onClick={() => setOpen(!open)} className="grid h-10 w-10 place-items-center rounded-lg text-white hover:bg-white/10 lg:hidden">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-white/10 px-5 pb-6 pt-2 lg:hidden">
          {links.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} className="block border-b border-white/5 py-3.5 text-white/85">{label}</a>
          ))}
          <div className="mt-4 flex items-center justify-between gap-3">
            <LocaleToggle light />
            <Link href={portalHref} className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-accent px-5 text-sm font-medium text-white">
              {loggedIn ? t.nav.dashboard : t.nav.portal}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

// ------------------------------------------------------------------ animated counter
export function CountUp({ to, suffix = '' }: { to: number; suffix?: string }) {
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
        const p = Math.min(1, (now - start) / 1600);
        setVal(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to]);
  return <span ref={ref} dir="ltr">{suffix}{val.toLocaleString('en-US')}</span>;
}

// ------------------------------------------------------------------ projects with stage filter
const STAGE_TONE = {
  construction: 'bg-white/90 text-brand',
  selling: 'bg-accent text-white',
  sold: 'bg-ink/70 text-white',
};

export function ProjectsGrid({ projects, t, locale }: { projects: SiteProject[]; t: SiteContent; locale: 'ar' | 'en' }) {
  const [filter, setFilter] = useState<'all' | SiteProject['sales_status']>('all');
  const stages = (['construction', 'selling', 'sold'] as const).filter((s) => projects.some((p) => p.sales_status === s));
  const list = filter === 'all' ? projects : projects.filter((p) => p.sales_status === filter);
  return (
    <>
      <div className="mb-10 flex flex-wrap justify-center gap-2">
        {(['all', ...stages] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={cx('rounded-full border px-5 py-2 text-sm transition',
              filter === s ? 'border-brand bg-brand text-white' : 'border-sand-300 bg-white text-ink/70 hover:border-brand/40')}>
            {s === 'all' ? t.projects.all : t.projects.stage[s]}
            <span className="ms-2 text-xs opacity-60">{s === 'all' ? projects.length : projects.filter((p) => p.sales_status === s).length}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => (
          <article key={p.name_ar} className="group relative aspect-[4/3] overflow-hidden sm:aspect-[4/5] rounded-[22px] bg-brand shadow-card">
            {p.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image_url} alt={p.name_ar} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-brand via-brand/20 to-transparent opacity-90 transition group-hover:opacity-100" />
            <span className={cx('absolute start-4 top-4 rounded-full px-3 py-1 text-xs font-medium backdrop-blur', STAGE_TONE[p.sales_status])}>
              {t.projects.stage[p.sales_status]}
            </span>
            <div className="absolute inset-x-0 bottom-0 p-6 text-white">
              <span className="mb-3 block h-px w-10 bg-accent transition-all duration-500 group-hover:w-20" />
              <h3 className="text-2xl font-bold">{locale === 'en' && p.name_en ? p.name_en : p.name_ar}</h3>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
