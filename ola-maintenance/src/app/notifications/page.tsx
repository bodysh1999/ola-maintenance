import Link from 'next/link';
import { Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n, requireRole } from '@/lib/session';
import { fmtDateTime, fmtRelative } from '@/lib/format';
import { AppShell } from '@/components/app-shell';
import { Card, EmptyState, PageHeader, buttonClass, cx } from '@/components/ui';
import { notifText } from '@/components/request-parts';
import { markAllNotificationsRead } from '@/app/actions/common';

export default async function NotificationsPage() {
  const profile = await requireRole(['admin', 'supervisor', 'technician', 'owner']);
  const [{ d, locale }, supabase] = await Promise.all([getI18n(), createClient()]);
  const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100);
  const items = (data ?? []) as { id: string; type: string; request_id: string | null; payload: Record<string, unknown>; read_at: string | null; created_at: string }[];

  const linkFor = async (requestId: string | null) => {
    if (!requestId) return '#';
    if (profile.role === 'owner') return `/owner/requests/${requestId}`;
    if (profile.role === 'technician') {
      const { data: wo } = await supabase.from('work_orders').select('id').eq('request_id', requestId).neq('status', 'cancelled').order('created_at', { ascending: false }).limit(1).maybeSingle();
      return wo ? `/tech/tasks/${wo.id}` : '/tech';
    }
    return `/admin/requests/${requestId}`;
  };
  const links = await Promise.all(items.map((n) => linkFor(n.request_id)));

  return (
    <AppShell profile={profile}>
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title={d.common.notifications}
          actions={items.some((n) => !n.read_at) && (
            <form action={markAllNotificationsRead}><button className={buttonClass('outline', 'sm')}>{d.common.markAllRead}</button></form>
          )}
        />
        <Card className="divide-y divide-sand-100">
          {!items.length && <EmptyState icon={<Bell className="h-5 w-5" />} title={d.notif.empty} />}
          {items.map((n, i) => (
            <Link key={n.id} href={links[i]} className={cx('flex items-start gap-3 px-5 py-4 transition hover:bg-sand-50', !n.read_at && 'bg-accent/[.05]')}>
              <span className={cx('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', n.read_at ? 'bg-sand-200' : 'bg-accent')} />
              <div className="min-w-0 flex-1">
                <p className={cx('text-sm', !n.read_at && 'font-semibold')}>{notifText(d, n.type, n.payload)}</p>
                {typeof n.payload?.note === 'string' && n.payload.note && <p className="mt-0.5 line-clamp-2 text-xs text-stone-450">{n.payload.note}</p>}
                <time className="mt-1 block text-xs text-stone-450" title={fmtDateTime(n.created_at, locale)}>{fmtRelative(n.created_at, locale)}</time>
              </div>
            </Link>
          ))}
        </Card>
      </div>
    </AppShell>
  );
}
