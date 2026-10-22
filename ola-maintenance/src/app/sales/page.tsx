import Link from 'next/link';
import { CalendarClock, Inbox, Search, Trophy, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile, getI18n } from '@/lib/session';
import { fmtDate, fmtRelative, todayRiyadh } from '@/lib/format';
import { pagesContent, type ServiceKey } from '@/lib/site-pages';
import { LEAD_KINDS, LEAD_STATUSES, LEAD_TONE, OPEN_LEAD } from '@/lib/sales-hr';
import { Badge, Card, EmptyState, Input, PageHeader, Select, StatCard, buttonClass } from '@/components/ui';
import { ExportExcelButton } from '@/components/export-button';

type SP = { q?: string; kind?: string; status?: string; mine?: string };
export type LeadRow = {
  id: string; ref_no: string; kind: string; full_name: string; phone: string; email: string | null; city: string | null;
  service: string | null; preferred_date: string | null; preferred_time: string | null; message: string | null; status: string;
  assigned_to: string | null; follow_up_at: string | null; created_at: string;
  projects: { name_ar: string; name_en: string | null } | null; units: { unit_number: string; price: number | null } | null;
  assignee: { full_name: string } | null;
};

export default async function SalesInbox({ searchParams }: { searchParams: Promise<SP> }) {
  const [{ d, locale }, supabase, sp, me] = await Promise.all([getI18n(), createClient(), searchParams, getCurrentProfile()]);
  const s = d.sales;
  const svc = pagesContent(locale).services.items;
  const today = todayRiyadh();

  let q = supabase.from('leads')
    .select('id, ref_no, kind, full_name, phone, email, city, service, preferred_date, preferred_time, message, status, assigned_to, follow_up_at, created_at, projects(name_ar, name_en), units(unit_number, price), assignee:profiles!leads_assigned_to_fkey(full_name)')
    .order('created_at', { ascending: false }).limit(300);
  if (sp.kind && (LEAD_KINDS as readonly string[]).includes(sp.kind)) q = q.eq('kind', sp.kind);
  if (sp.status === 'open') q = q.in('status', OPEN_LEAD);
  else if (sp.status && (LEAD_STATUSES as readonly string[]).includes(sp.status)) q = q.eq('status', sp.status);
  if (sp.mine === '1' && me) q = q.eq('assigned_to', me.id);
  if (sp.q) {
    const term = sp.q.replace(/[%,()*]/g, ' ').trim();
    if (term) q = q.or(`ref_no.ilike.%${term}%,full_name.ilike.%${term}%,phone.ilike.%${term}%`);
  }
  const [{ data, error }, { data: all }] = await Promise.all([q, supabase.from('leads').select('status, follow_up_at')]);
  const rows = (data ?? []) as unknown as LeadRow[];
  const stats = all ?? [];
  const what = (r: LeadRow) => r.kind === 'service'
    ? (svc[r.service as ServiceKey]?.title ?? r.service)
    : [r.projects ? (locale === 'en' && r.projects.name_en ? r.projects.name_en : r.projects.name_ar) : null, r.units ? `${d.sales.unit} ${r.units.unit_number}` : null].filter(Boolean).join(' · ');

  return (
    <div>
      <PageHeader title={s.title} subtitle={s.subtitle}
        actions={<ExportExcelButton filename={`leads-${today}`} sheets={[{ name: s.title, rows: rows.map((r) => ({
          [s.ref]: r.ref_no, [d.sales.type]: s.kind[r.kind as keyof typeof s.kind], [s.customer]: r.full_name, [d.common.phone]: r.phone,
          [d.common.email]: r.email ?? '', [s.project]: what(r), [s.preferred]: [r.preferred_date, r.preferred_time].filter(Boolean).join(' '),
          [d.common.status]: s.status[r.status as keyof typeof s.status], [s.assignee]: r.assignee?.full_name ?? '', [s.received]: r.created_at.slice(0, 16).replace('T', ' '),
          [s.message]: r.message ?? '',
        })) }]} />} />

      {error && <p className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{/(does not exist|Could not find the table)/i.test(error.message) ? 'شغّل ملفات SQL رقم 6 و 7 في Supabase أولًا.' : error.message}</p>}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={s.kpi.new} value={stats.filter((x) => x.status === 'new').length} icon={<Inbox className="h-5 w-5" />} tone="brand" />
        <StatCard label={s.kpi.open} value={stats.filter((x) => OPEN_LEAD.includes(x.status)).length} icon={<Users className="h-5 w-5" />} />
        <StatCard label={s.kpi.followToday} value={stats.filter((x) => x.follow_up_at && x.follow_up_at <= today && OPEN_LEAD.includes(x.status)).length} icon={<CalendarClock className="h-5 w-5" />} tone="warn" />
        <StatCard label={s.kpi.won} value={stats.filter((x) => x.status === 'won').length} icon={<Trophy className="h-5 w-5" />} tone="good" />
      </div>

      <Card className="mb-4 p-4">
        <form className="grid gap-3 md:grid-cols-5">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input name="q" defaultValue={sp.q} placeholder={`${s.ref} / ${d.common.name} / ${d.common.phone}`} className="ps-9" />
          </div>
          <Select name="kind" defaultValue={sp.kind ?? ''}>
            <option value="">{s.allKinds}</option>
            {LEAD_KINDS.map((k) => <option key={k} value={k}>{s.kind[k]}</option>)}
          </Select>
          <Select name="status" defaultValue={sp.status ?? ''}>
            <option value="">{s.allStatuses}</option>
            <option value="open">{s.kpi.open}</option>
            {LEAD_STATUSES.map((k) => <option key={k} value={k}>{s.status[k]}</option>)}
          </Select>
          <div className="flex items-center gap-2">
            <label className="flex flex-1 items-center gap-2 text-sm"><input type="checkbox" name="mine" value="1" defaultChecked={sp.mine === '1'} className="h-4 w-4 accent-brand" />{s.onlyMine}</label>
            <button className={buttonClass('primary', 'md')}>{d.common.apply}</button>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        {!rows.length ? <EmptyState icon={<Inbox className="h-5 w-5" />} title={s.empty} /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-sand-50/70 text-xs text-stone-450">
                <tr>{[s.ref, d.sales.type, s.customer, s.project, s.preferred, d.common.status, s.assignee, s.received].map((h) => <th key={h} className="px-4 py-3 text-start font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {rows.map((r) => (
                  <tr key={r.id} className={r.status === 'new' ? 'bg-accent/[.04] hover:bg-sand-50' : 'hover:bg-sand-50'}>
                    <td className="px-4 py-3"><Link href={`/sales/${r.id}`} className="font-medium text-brand hover:underline" dir="ltr">{r.ref_no}</Link></td>
                    <td className="px-4 py-3">{s.kind[r.kind as keyof typeof s.kind]}</td>
                    <td className="px-4 py-3"><div className="font-medium">{r.full_name}</div><div className="text-xs text-stone-450" dir="ltr">{r.phone}</div></td>
                    <td className="max-w-[220px] px-4 py-3">{what(r) || '—'}</td>
                    <td className="px-4 py-3">{r.preferred_date ? `${fmtDate(r.preferred_date, locale)}${r.preferred_time ? ` · ${r.preferred_time}` : ''}` : '—'}</td>
                    <td className="px-4 py-3"><Badge className={LEAD_TONE[r.status]}>{s.status[r.status as keyof typeof s.status]}</Badge></td>
                    <td className="px-4 py-3">{r.assignee?.full_name ?? <span className="text-stone-400">{d.common.unassigned}</span>}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-stone-450">{fmtRelative(r.created_at, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
