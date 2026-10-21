import Link from 'next/link';
import { Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n, getSettings } from '@/lib/session';
import type { Profile } from '@/lib/types';
import { BrandMark } from './brand';
import { BottomNav, Sidebar, type NavItem } from './shell-nav';

export async function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const [{ d, locale }, s, supabase] = await Promise.all([getI18n(), getSettings(), createClient()]);
  const { count: unread } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);

  let items: NavItem[] = [];
  let bottom: NavItem[] | null = null;
  const n = d.nav;

  // sales / HR sections (also shown to the company admin)
  const salesItems = async (): Promise<NavItem[]> => {
    const { count } = await supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new');
    return [
      { href: '/sales', label: n.leads, icon: 'leads', exact: true, badge: count ?? 0 },
      { href: '/sales/units', label: n.salesUnits, icon: 'units' },
    ];
  };
  const hrItems = async (): Promise<NavItem[]> => {
    const { count } = await supabase.from('job_applications').select('id', { count: 'exact', head: true }).eq('status', 'new');
    return [
      { href: '/hr', label: n.applications, icon: 'applications', exact: true, badge: count ?? 0 },
      { href: '/hr/openings', label: n.openings, icon: 'openings' },
    ];
  };
  const bell: NavItem = { href: '/notifications', label: n.notifications, icon: 'bell', badge: unread ?? 0 };
  const site: NavItem = { href: '/', label: n.website, icon: 'website', exact: true };

  if (profile.role === 'sales') {
    items = [...(await salesItems()), bell, site];
  } else if (profile.role === 'hr') {
    items = [...(await hrItems()), bell, site];
  } else if (profile.role === 'admin' || profile.role === 'supervisor') {
    const { count: fresh } = await supabase.from('maintenance_requests').select('id', { count: 'exact', head: true }).in('status', ['new', 'pending_approval', 'reopened']);
    items = [
      { href: '/admin', label: n.dashboard, icon: 'dashboard', exact: true },
      { href: '/admin/inbox', label: n.inbox, icon: 'inbox', badge: fresh ?? 0 },
      { href: '/admin/requests', label: n.requests, icon: 'requests' },
      { href: '/admin/projects', label: n.projects, icon: 'projects' },
      { href: '/admin/owners', label: n.owners, icon: 'owners' },
      { href: '/admin/team', label: n.team, icon: 'team' },
      { href: '/admin/reports', label: n.reports, icon: 'reports' },
      ...(profile.role === 'admin' ? [...(await salesItems()), ...(await hrItems()), { href: '/admin/settings', label: n.settings, icon: 'settings' as const }] : []),
      bell,
    ];
  } else if (profile.role === 'technician') {
    items = [
      { href: '/tech', label: n.myTasks, icon: 'tasks' },
      { href: '/notifications', label: n.notifications, icon: 'bell', badge: unread ?? 0 },
    ];
    bottom = items;
  } else {
    items = [
      { href: '/owner', label: n.home, icon: 'home', exact: true },
      { href: '/owner/requests/new', label: n.newRequest, icon: 'newRequest' },
      { href: '/notifications', label: n.notifications, icon: 'bell', badge: unread ?? 0 },
    ];
    bottom = items;
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar items={items} brand={<BrandMark s={s} locale={locale} light />} user={{ name: profile.full_name || profile.email || '', role: d.roles[profile.role] }} />
      <main className={`min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-9 ${bottom ? 'pb-28 lg:pb-9' : ''}`}>
        <div className="no-print mb-2 hidden justify-end lg:flex">
          <Link href="/notifications" className="relative grid h-10 w-10 place-items-center rounded-full border border-sand-200 bg-white text-ink/70 hover:text-ink">
            <Bell className="h-[18px] w-[18px]" />
            {!!unread && <span className="absolute -end-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">{unread}</span>}
          </Link>
        </div>
        <div className="mx-auto max-w-[1280px]">{children}</div>
      </main>
      {bottom && <BottomNav items={bottom} />}
    </div>
  );
}
