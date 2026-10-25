'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Bell, Building2, ClipboardList, Home, Inbox, LayoutDashboard, LogOut, Menu, PlusCircle,
  Settings, Users, Wrench, X, BarChart3, HardHat, Megaphone, Tags, Briefcase, GraduationCap, Globe, UserRound, CheckSquare, Fingerprint, Network, IdCard, ShieldCheck, UserCog, LockKeyhole, CalendarDays, KanbanSquare, FileBarChart, Wallet, Banknote, ReceiptText, ChevronDown, MoreHorizontal,
} from 'lucide-react';
import { cx } from './ui';
import { signOut } from '@/app/actions/common';
import { useI18n } from './client';
import { LocaleToggle } from './locale-toggle';

export const NAV_ICONS = {
  dashboard: LayoutDashboard, inbox: Inbox, requests: ClipboardList, projects: Building2, owners: Users,
  team: HardHat, reports: BarChart3, settings: Settings, home: Home, newRequest: PlusCircle, tasks: Wrench, bell: Bell,
  leads: Megaphone, units: Tags, applications: Briefcase, openings: GraduationCap, website: Globe,
  me: UserRound, approvals: CheckSquare, attendance: Fingerprint, structure: Network, employees: IdCard, warranty: ShieldCheck, privacy: LockKeyhole, calendar: CalendarDays, kanban: KanbanSquare, analytics: FileBarChart, custody: Wallet, payroll: Banknote, payslip: ReceiptText,
};
export type NavItem = { href: string; label: string; icon: keyof typeof NAV_ICONS; exact?: boolean; badge?: number; group?: string };

const COLLAPSE_KEY = 'ola.nav.collapsed';

function isActive(path: string, item: NavItem) {
  return item.exact ? path === item.href : path === item.href || path.startsWith(item.href + '/');
}

export function Sidebar({ items, brand, user }: { items: NavItem[]; brand: ReactNode; user: { name: string; role: string } }) {
  const path = usePathname();
  const { d } = useI18n();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);

  // consecutive items with the same `group` form one collapsible section; ungrouped items stay flat
  const sections = useMemo(() => {
    const out: { group?: string; items: NavItem[] }[] = [];
    for (const it of items) {
      const last = out[out.length - 1];
      if (last && last.group === it.group) last.items.push(it);
      else out.push({ group: it.group, items: [it] });
    }
    return out;
  }, [items]);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  useEffect(() => {
    try { setCollapsed(JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '[]')); } catch { /* storage unavailable */ }
  }, []);
  const toggle = (g: string) => setCollapsed((prev) => {
    const next = prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g];
    try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
    return next;
  });

  const link = (it: NavItem) => {
    const Icon = NAV_ICONS[it.icon];
    const active = isActive(path, it);
    return (
      <Link
        key={it.href}
        href={it.href}
        aria-current={active ? 'page' : undefined}
        className={cx(
          'group flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] transition',
          active ? 'relative bg-white/[.10] text-white before:absolute before:inset-y-2 before:start-0 before:w-[3px] before:rounded-full before:bg-accent' : 'text-white/70 hover:bg-white/[.06] hover:text-white',
        )}
      >
        <Icon className={cx('h-[18px] w-[18px] shrink-0', active ? 'text-accent' : 'text-white/50 group-hover:text-white/80')} />
        <span className="min-w-0 flex-1 truncate">{it.label}</span>
        {!!it.badge && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">{it.badge}</span>}
      </Link>
    );
  };

  const nav = (
    <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-2 [scrollbar-width:thin]">
      {sections.map((sec, i) => {
        if (!sec.group) return <div key={i} className="flex flex-col gap-0.5">{sec.items.map(link)}</div>;
        const hasActive = sec.items.some((it) => isActive(path, it));
        const open = hasActive || !collapsed.includes(sec.group);
        const badge = sec.items.reduce((n, it) => n + (it.badge ?? 0), 0);
        const id = `nav-sec-${i}`;
        return (
          <div key={i} className="mt-3 flex flex-col gap-0.5 first:mt-0">
            <button
              type="button"
              onClick={() => toggle(sec.group!)}
              aria-expanded={open}
              aria-controls={id}
              title={d.nav.toggleGroup}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11.5px] font-semibold tracking-wide text-white/45 transition hover:text-white/80"
            >
              <span className="flex-1 text-start">{sec.group}</span>
              {!open && !!badge && <span className="rounded-full bg-accent/90 px-1.5 text-[10px] font-semibold text-white">{badge}</span>}
              <ChevronDown className={cx('h-3.5 w-3.5 transition-transform', !open && 'rotate-90 rtl:-rotate-90')} />
            </button>
            {open && <div id={id} className="flex flex-col gap-0.5">{sec.items.map(link)}</div>}
          </div>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="border-t border-white/10 p-4">
      <Link href="/account" className="mb-3 flex items-center gap-3 rounded-xl p-1 transition hover:bg-white/[.06]" title={d.privacy.account}>
        <div className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-sm font-semibold text-accent">{user.name.charAt(0)}</div>
        <div className="min-w-0 flex-1 text-sm leading-tight">
          <div className="truncate text-white">{user.name}</div>
          <div className="truncate text-xs text-white/50">{user.role}</div>
        </div>
        <UserCog className="h-4 w-4 shrink-0 text-white/40" />
      </Link>
      <div className="flex items-center justify-between">
        <LocaleToggle light />
        <form action={signOut}>
          <button className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-white/70 hover:bg-white/10 hover:text-white">
            <LogOut className="flip-rtl h-4 w-4" /> {d.common.logout}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* desktop */}
      <aside className="texture-lines sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col bg-brand lg:flex">
        <div className="px-5 py-6">{brand}</div>
        {nav}
        {footer}
      </aside>

      {/* mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/10 bg-brand px-4 lg:hidden">
        <div className="min-w-0 flex-1">{brand}</div>
        <button aria-label="menu" onClick={() => setOpen(true)} className="grid h-10 w-10 place-items-center rounded-lg text-white hover:bg-white/10">
          <Menu className="h-5 w-5" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="texture-lines absolute inset-y-0 start-0 flex w-[82%] max-w-xs flex-col bg-brand">
            <div className="flex items-center justify-between px-5 py-5">
              <div className="min-w-0">{brand}</div>
              <button aria-label="close" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg text-white/80 hover:bg-white/10"><X className="h-5 w-5" /></button>
            </div>
            {nav}
            {footer}
          </div>
        </div>
      )}
    </>
  );
}

/** Thumb-reachable navigation for owners, staff and technicians on phones — at most 5 slots, the rest under "More" */
export function BottomNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const { d } = useI18n();
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [path]);
  const overflow = items.length > 5;
  const shown = overflow ? items.slice(0, 4) : items;
  const rest = overflow ? items.slice(4) : [];
  const restActive = rest.some((it) => isActive(path, it));
  const restBadge = rest.some((it) => !!it.badge);
  const cols = shown.length + (overflow ? 1 : 0);

  return (
    <>
      {more && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={d.nav.more}>
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={() => setMore(false)} />
          <div className="absolute inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] rounded-2xl border border-sand-200 bg-white p-2 shadow-lift">
            {rest.map((it) => {
              const Icon = NAV_ICONS[it.icon];
              const active = isActive(path, it);
              return (
                <Link key={it.href} href={it.href} className={cx('flex items-center gap-3 rounded-xl px-3 py-3 text-[15px]', active ? 'bg-brand/[.06] font-semibold text-brand' : 'text-ink/80 hover:bg-sand-50')}>
                  <Icon className={cx('h-5 w-5', active ? 'text-accent' : 'text-stone-450')} />
                  <span className="flex-1">{it.label}</span>
                  {!!it.badge && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">{it.badge}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      )}
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 grid border-t border-sand-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
        {shown.map((it) => {
          const Icon = NAV_ICONS[it.icon];
          const active = isActive(path, it);
          const primary = it.icon === 'newRequest';
          return (
            <Link key={it.href} href={it.href} aria-current={active ? 'page' : undefined} className={cx('relative flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] leading-tight', active ? 'text-brand' : 'text-stone-450')}>
              {primary ? (
                <span className="-mt-6 grid h-12 w-12 place-items-center rounded-full bg-accent text-white shadow-lift ring-4 ring-white"><Icon className="h-6 w-6" /></span>
              ) : (
                <Icon className="h-5 w-5" />
              )}
              <span className={cx('max-w-full truncate', active && 'font-semibold')}>{it.label}</span>
              {!!it.badge && <span className="absolute end-1/4 top-1.5 h-2 w-2 rounded-full bg-rose-500" />}
            </Link>
          );
        })}
        {overflow && (
          <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} className={cx('relative flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] leading-tight', more || restActive ? 'text-brand' : 'text-stone-450')}>
            <MoreHorizontal className="h-5 w-5" />
            <span className={cx((more || restActive) && 'font-semibold')}>{d.nav.more}</span>
            {restBadge && <span className="absolute end-1/4 top-1.5 h-2 w-2 rounded-full bg-rose-500" />}
          </button>
        )}
      </nav>
    </>
  );
}
