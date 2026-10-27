import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Bell, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n, getSettings } from '@/lib/session';
import type { Profile } from '@/lib/types';
import { BrandMark } from './brand';
import { LiveRefresh } from './live';
import { BottomNav, Sidebar, type NavItem } from './shell-nav';

export async function AppShell({ profile, children, gates = true }: { profile: Profile; children: React.ReactNode; gates?: boolean }) {
  const [{ d, locale }, s, supabase] = await Promise.all([getI18n(), getSettings(), createClient()]);

  // PDPL: everyone accepts the current privacy policy once; company policy may require two-step login for admins & HR
  if (gates) {
    if ((profile.privacy_accepted_version ?? '') !== (s.privacy_version ?? '1.0')) redirect('/account/consent');
    if (s.require_staff_mfa && (profile.role === 'admin' || profile.role === 'hr')) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel !== 'aal2') redirect('/account/security?required=1');
    }
  }
  const { count: unread } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);

  let items: NavItem[] = [];
  let bottom: NavItem[] | null = null;
  const n = d.nav;

  // sales / HR sections (also shown to the company admin)
  const salesItems = async (): Promise<NavItem[]> => {
    const { count } = await supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new');
    return [
      { href: '/sales', label: n.leads, icon: 'leads', exact: true, badge: count ?? 0, group: n.gSales, groupIcon: 'leads' },
      { href: '/sales/board', label: d.salesops.board, icon: 'kanban', group: n.gSales, groupIcon: 'leads' },
      { href: '/sales/units', label: n.salesUnits, icon: 'units', group: n.gSales, groupIcon: 'leads' },
    ];
  };
  const hrItems = async (): Promise<NavItem[]> => {
    const { count } = await supabase.from('job_applications').select('id', { count: 'exact', head: true }).eq('status', 'new');
    return [
      { href: '/hr/employees', label: d.hrm.employees, icon: 'employees', group: n.gHr, groupIcon: 'employees' },
      { href: '/hr/structure', label: d.hrm.structure, icon: 'structure', group: n.gHr, groupIcon: 'employees' },
      { href: '/hr/requests', label: d.hrm.requests, icon: 'requests', group: n.gHr, groupIcon: 'employees' },
      { href: '/hr/attendance', label: d.hrm.attendance, icon: 'attendance', group: n.gHr, groupIcon: 'employees' },
      { href: '/hr/payroll', label: d.payroll.title, icon: 'payroll', group: n.gHr, groupIcon: 'employees' },
      { href: '/hr/custody', label: d.custody.hrTitle, icon: 'custody', group: n.gHr, groupIcon: 'employees' },
      { href: '/hr', label: n.applications, icon: 'applications', exact: true, badge: count ?? 0, group: n.gHr, groupIcon: 'employees' },
      { href: '/hr/openings', label: n.openings, icon: 'openings', group: n.gHr, groupIcon: 'employees' },
    ];
  };
  const privacyItem = async (): Promise<NavItem> => {
    const { count } = await supabase.from('data_requests').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress']);
    return { href: '/admin/privacy', label: d.privacy.console, icon: 'privacy', badge: count ?? 0, group: n.gAdmin, groupIcon: 'settings' };
  };
  // employee self-service — every staff role
  const { data: approvals } = await supabase.rpc('my_pending_approvals_count');
  const me = { href: '/me', label: n.myServices, icon: 'me', exact: true, group: n.gMe, groupIcon: 'me' } as const;
  const approvalsItem: NavItem = { href: '/me/approvals', label: n.approvals, icon: 'approvals', badge: Number(approvals ?? 0), group: n.gMe, groupIcon: 'me' };
  const meRest: NavItem[] = [
    { href: '/me/calendar', label: d.hrops.calendar, icon: 'calendar', group: n.gMe, groupIcon: 'me' },
    { href: '/me/custody', label: d.custody.title, icon: 'custody', group: n.gMe, groupIcon: 'me' },
    { href: '/me/payslips', label: d.payroll.payslips, icon: 'payslip', group: n.gMe, groupIcon: 'me' },
  ];
  const meItems: NavItem[] = [me, approvalsItem, ...meRest];
  const bell: NavItem = { href: '/notifications', label: n.notifications, icon: 'bell', badge: unread ?? 0 };
  const site: NavItem = { href: '/', label: n.website, icon: 'website', exact: true };

  if (profile.role === 'sales') {
    items = [...(await salesItems()), ...meItems, bell, site];
  } else if (profile.role === 'hr') {
    items = [...(await hrItems()), ...meItems, bell, site];
  } else if (profile.role === 'employee') {
    // phone order: the four most used first, the rest under "More"
    items = [me, { href: '/me/attendance', label: d.me.attendance, icon: 'attendance', group: n.gMe, groupIcon: 'me' }, approvalsItem, { ...bell, group: n.gMe, groupIcon: 'me' }, ...meRest];
    bottom = items;
  } else if (profile.role === 'admin' || profile.role === 'supervisor') {
    const { count: fresh } = await supabase.from('maintenance_requests').select('id', { count: 'exact', head: true }).in('status', ['new', 'pending_approval', 'reopened']);
    items = [
      { href: '/admin', label: n.dashboard, icon: 'dashboard', exact: true },
      { href: '/admin/inbox', label: n.inbox, icon: 'inbox', badge: fresh ?? 0, group: n.gAfterSales, groupIcon: 'tasks' },
      { href: '/admin/requests', label: n.requests, icon: 'requests', group: n.gAfterSales, groupIcon: 'tasks' },
      { href: '/admin/projects', label: n.projects, icon: 'projects', group: n.gAfterSales, groupIcon: 'tasks' },
      { href: '/admin/owners', label: n.owners, icon: 'owners', group: n.gAfterSales, groupIcon: 'tasks' },
      { href: '/admin/team', label: n.team, icon: 'team', group: n.gAfterSales, groupIcon: 'tasks' },
      { href: '/admin/reports', label: n.reports, icon: 'reports', group: n.gAfterSales, groupIcon: 'tasks' },
      ...(profile.role === 'admin' ? [...(await salesItems()), ...(await hrItems()), await privacyItem(), { href: '/admin/system', label: d.system.title, icon: 'analytics' as const, group: n.gAdmin, groupIcon: 'settings' as const }, { href: '/admin/settings', label: n.settings, icon: 'settings' as const, group: n.gAdmin, groupIcon: 'settings' as const }] : []),
      ...meItems,
      bell,
    ];
  } else if (profile.role === 'technician') {
    items = [
      { href: '/tech', label: n.myTasks, icon: 'tasks' },
      me,
      bell,
      approvalsItem,
      ...meRest,
    ];
    bottom = items;
  } else {
    items = [
      { href: '/owner', label: n.home, icon: 'home', exact: true },
      { href: '/owner/requests/new', label: n.newRequest, icon: 'newRequest' },
      { href: '/owner/warranties', label: d.portal.warrantyCenter, icon: 'warranty' },
      { href: '/notifications', label: n.notifications, icon: 'bell', badge: unread ?? 0 },
    ];
    bottom = items;
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <LiveRefresh userId={profile.id} fallbackSeconds={300} />
      <Sidebar items={items} brand={<BrandMark s={s} locale={locale} light />} user={{ name: profile.full_name || profile.email || '', role: d.roles[profile.role] }} />
      <main className={`min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-9 ${bottom ? 'pb-28 lg:pb-9' : ''}`}>
        <div className="no-print mx-auto mb-4 hidden max-w-[1280px] items-center gap-3 lg:flex">
          {(profile.role === 'admin' || profile.role === 'supervisor') && (
            <form action="/admin/requests" role="search" className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-450" aria-hidden="true" />
              <input type="search" name="q" aria-label={n.search} placeholder={n.search}
                className="h-10 w-full rounded-full border border-sand-200 bg-white ps-10 pe-4 text-sm text-ink placeholder:text-stone-450 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/10" />
            </form>
          )}
          <div className="ms-auto flex items-center gap-2">
            <Link href="/notifications" aria-label={n.notifications} className="relative grid h-10 w-10 place-items-center rounded-full border border-sand-200 bg-white text-ink/70 hover:text-ink">
              <Bell className="h-[18px] w-[18px]" />
              {!!unread && <span className="absolute -end-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">{unread}</span>}
            </Link>
            <Link href="/account" className="flex h-10 items-center gap-2 rounded-full border border-sand-200 bg-white pe-4 ps-1 text-sm text-ink/80 hover:text-ink">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-xs font-semibold text-accent">{(profile.full_name || profile.email || '?').charAt(0)}</span>
              <span className="max-w-[160px] truncate">{profile.full_name || profile.email}</span>
            </Link>
          </div>
        </div>
        <div className="mx-auto max-w-[1280px]">{children}</div>
      </main>
      {bottom && <BottomNav items={bottom} />}
    </div>
  );
}
