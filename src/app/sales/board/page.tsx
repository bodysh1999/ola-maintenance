import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile, getI18n } from '@/lib/session';
import { todayRiyadh } from '@/lib/format';
import { pagesContent, type ServiceKey } from '@/lib/site-pages';
import { PageHeader, buttonClass } from '@/components/ui';
import Link from 'next/link';
import { LeadBoard, type BoardLead } from './board';

const COLUMNS = ['new', 'contacted', 'scheduled', 'visited', 'negotiating', 'booked', 'won', 'lost'];

export default async function SalesBoard({ searchParams }: { searchParams: Promise<{ mine?: string }> }) {
  const [{ d, locale }, supabase, sp, me] = await Promise.all([getI18n(), createClient(), searchParams, getCurrentProfile()]);
  const svc = pagesContent(locale).services.items;
  const since = new Date(Date.now() - 90 * 864e5).toISOString();
  let q = supabase.from('leads')
    .select('id, ref_no, kind, full_name, phone, service, status, follow_up_at, created_at, projects(name_ar, name_en), units(unit_number), assignee:profiles!leads_assigned_to_fkey(full_name)')
    .in('status', COLUMNS)
    .order('created_at', { ascending: false }).limit(400);
  // closed stages only show the last 90 days so the board stays light
  q = q.or(`status.in.(new,contacted,scheduled,visited,negotiating,booked),created_at.gte.${since}`);
  if (sp.mine === '1' && me) q = q.eq('assigned_to', me.id);
  const { data } = await q;
  type Raw = { id: string; ref_no: string; kind: string; full_name: string; phone: string; service: string | null; status: string; follow_up_at: string | null; created_at: string;
    projects: { name_ar: string; name_en: string | null } | null; units: { unit_number: string } | null; assignee: { full_name: string } | null };
  const leads: BoardLead[] = ((data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id, ref_no: r.ref_no, full_name: r.full_name, phone: r.phone, status: r.status, kind: r.kind, follow_up_at: r.follow_up_at, created_at: r.created_at,
    assignee: r.assignee?.full_name ?? null,
    what: r.kind === 'service' ? (svc[r.service as ServiceKey]?.title ?? r.service ?? '')
      : [r.projects ? (locale === 'en' && r.projects.name_en ? r.projects.name_en : r.projects.name_ar) : null, r.units ? `${d.sales.unit} ${r.units.unit_number}` : null].filter(Boolean).join(' · '),
  }));
  return (
    <div>
      <PageHeader title={d.salesops.board} subtitle={d.salesops.boardSub}
        actions={<Link href={sp.mine === '1' ? '/sales/board' : '/sales/board?mine=1'} className={buttonClass(sp.mine === '1' ? 'primary' : 'outline', 'sm')}>{d.sales.onlyMine}</Link>} />
      <LeadBoard leads={leads} columns={COLUMNS} today={todayRiyadh()} />
    </div>
  );
}
