import Link from 'next/link';
import { CalendarClock, ChevronLeft, MapPin, Wrench } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n, requireRole } from '@/lib/session';
import { fmtVisit, todayRiyadh } from '@/lib/format';
import type { RequestOverview, WorkOrderStatus } from '@/lib/types';
import { Badge, Card, EmptyState, PageHeader, cx } from '@/components/ui';
import { PriorityBadge } from '@/components/badges';
import { CategoryIcon } from '@/components/category-icon';

type WO = { id: string; status: WorkOrderStatus; request_id: string; created_at: string };

export default async function TechHome() {
  const profile = await requireRole(['technician']);
  const [{ d, locale }, supabase] = await Promise.all([getI18n(), createClient()]);
  const { data: wos } = await supabase.from('work_orders').select('id, status, request_id, created_at').neq('status', 'cancelled').order('created_at', { ascending: false }).limit(60);
  const list = (wos ?? []) as WO[];
  const { data: reqs } = list.length
    ? await supabase.from('request_overview').select('*').in('id', list.map((w) => w.request_id))
    : { data: [] };
  const byId = new Map(((reqs ?? []) as RequestOverview[]).map((r) => [r.id, r]));
  const today = todayRiyadh();

  const active = list.filter((w) => ['assigned', 'in_progress', 'awaiting_parts', 'returned'].includes(w.status))
    .sort((a, b) => (byId.get(a.request_id)?.visit_at ?? '9').localeCompare(byId.get(b.request_id)?.visit_at ?? '9'));
  const todays = active.filter((w) => byId.get(w.request_id)?.visit_at?.slice(0, 10) === today || w.status === 'in_progress');
  const upcoming = active.filter((w) => !todays.includes(w));
  const waiting = list.filter((w) => w.status === 'submitted');
  const done = list.filter((w) => w.status === 'approved').slice(0, 8);

  const Section = ({ title, items, muted }: { title: string; items: WO[]; muted?: boolean }) => items.length ? (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-stone-450">{title} · {items.length}</h2>
      <div className="space-y-3">
        {items.map((w) => {
          const r = byId.get(w.request_id);
          if (!r) return null;
          return (
            <Link key={w.id} href={`/tech/tasks/${w.id}`} className={cx('block rounded-2xl border bg-white p-4 shadow-card transition active:scale-[.99]', w.status === 'returned' ? 'border-rose-200' : 'border-sand-200', muted && 'opacity-70')}>
              <div className="flex items-start gap-3">
                <div className={cx('grid h-12 w-12 shrink-0 place-items-center rounded-xl', w.status === 'in_progress' ? 'bg-accent text-white' : 'bg-brand/[.07] text-brand')}>
                  <CategoryIcon category={r.category} className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{d.category[r.category]}</span>
                    <PriorityBadge priority={r.priority} d={d} />
                    {w.status !== 'assigned' && <Badge className="bg-sand-100 text-ink/70 ring-sand-200">{w.status === 'returned' ? d.tech.returned : d.woStatus[w.status]}</Badge>}
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-sm text-ink/70">{r.location_in_unit} — {r.description}</p>
                  <div className="mt-2 space-y-1 text-xs text-stone-450">
                    <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{r.project_name_ar} · {d.owner.building} {r.building_name} · {d.owner.unit} {r.unit_number} · {d.owner.floor} {r.floor}</div>
                    {r.visit_at && <div className="flex items-center gap-1.5 font-medium text-brand"><CalendarClock className="h-3.5 w-3.5" />{fmtVisit(r.visit_at, locale)}</div>}
                  </div>
                </div>
                <ChevronLeft className="mt-3 h-5 w-5 text-stone-300 ltr:rotate-180" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  ) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-7">
      <PageHeader eyebrow={d.roles.technician} title={`${d.owner.hello}، ${profile.full_name.split(' ')[0]}`} />
      {!list.length && <Card><EmptyState icon={<Wrench className="h-5 w-5" />} title={d.tech.noTasks} /></Card>}
      <Section title={d.tech.today} items={todays} />
      <Section title={d.tech.upcoming} items={upcoming} />
      <Section title={d.woStatus.submitted} items={waiting} muted />
      <Section title={d.tech.done} items={done} muted />
    </div>
  );
}
