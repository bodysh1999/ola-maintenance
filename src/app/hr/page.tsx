import Link from 'next/link';
import { Briefcase, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { fmtRelative, todayRiyadh } from '@/lib/format';
import { APPLICATION_STATUSES, APP_TONE } from '@/lib/sales-hr';
import { Badge, Card, EmptyState, Input, PageHeader, Select, buttonClass } from '@/components/ui';
import { ExportExcelButton } from '@/components/export-button';

type SP = { q?: string; kind?: string; status?: string; opening?: string };
type Row = {
  id: string; ref_no: string; kind: 'job' | 'training'; full_name: string; phone: string; email: string; city: string | null;
  education: string | null; major: string | null; experience_years: number | null; status: string; created_at: string; cv_path: string | null;
  job_openings: { title: string } | null;
};

export default async function HrInbox({ searchParams }: { searchParams: Promise<SP> }) {
  const [{ d, locale }, supabase, sp] = await Promise.all([getI18n(), createClient(), searchParams]);
  const h = d.hr;
  let q = supabase.from('job_applications')
    .select('id, ref_no, kind, full_name, phone, email, city, education, major, experience_years, status, created_at, cv_path, job_openings(title)')
    .order('created_at', { ascending: false }).limit(300);
  if (sp.kind === 'job' || sp.kind === 'training') q = q.eq('kind', sp.kind);
  if (sp.status && (APPLICATION_STATUSES as readonly string[]).includes(sp.status)) q = q.eq('status', sp.status);
  if (sp.opening) q = q.eq('opening_id', sp.opening);
  if (sp.q) {
    const term = sp.q.replace(/[%,()*]/g, ' ').trim();
    if (term) q = q.or(`ref_no.ilike.%${term}%,full_name.ilike.%${term}%,email.ilike.%${term}%,major.ilike.%${term}%`);
  }
  const [{ data, error }, { data: openings }] = await Promise.all([q, supabase.from('job_openings').select('id, title').order('created_at')]);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div>
      <PageHeader title={h.title} subtitle={h.subtitle}
        actions={<ExportExcelButton filename={`applications-${todayRiyadh()}`} sheets={[{ name: h.title, rows: rows.map((r) => ({
          [d.sales.ref]: r.ref_no, [d.sales.type]: h.kind[r.kind], [h.applicant]: r.full_name, [d.common.phone]: r.phone, [d.common.email]: r.email,
          [h.opening]: r.job_openings?.title ?? h.general, [h.education]: r.education ?? '', [h.major]: r.major ?? '', [h.experience]: r.experience_years ?? '',
          [d.common.status]: h.status[r.status as keyof typeof h.status], [d.common.date]: r.created_at.slice(0, 10),
        })) }]} />} />

      {error && <p className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{/(does not exist|Could not find the table)/i.test(error.message) ? 'شغّل ملفات SQL رقم 6 و 7 في Supabase أولًا.' : error.message}</p>}

      <Card className="mb-4 p-4">
        <form className="grid gap-3 md:grid-cols-5">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input name="q" defaultValue={sp.q} placeholder={`${d.common.name} / ${d.common.email} / ${h.major}`} className="ps-9" />
          </div>
          <Select name="kind" defaultValue={sp.kind ?? ''}>
            <option value="">{d.common.all}</option>
            <option value="job">{h.kind.job}</option>
            <option value="training">{h.kind.training}</option>
          </Select>
          <Select name="status" defaultValue={sp.status ?? ''}>
            <option value="">{d.sales.allStatuses}</option>
            {APPLICATION_STATUSES.map((k) => <option key={k} value={k}>{h.status[k]}</option>)}
          </Select>
          <div className="flex gap-2">
            <Select name="opening" defaultValue={sp.opening ?? ''} className="min-w-0 flex-1">
              <option value="">{h.opening}: {d.common.all}</option>
              {(openings ?? []).map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
            </Select>
            <button className={buttonClass('primary', 'md')}>{d.common.apply}</button>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        {!rows.length ? <EmptyState icon={<Briefcase className="h-5 w-5" />} title={h.empty} /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-sand-50/70 text-xs text-stone-450">
                <tr>{[d.sales.ref, d.sales.type, h.applicant, h.opening, h.major, h.experience, d.common.status, d.sales.received].map((x) => <th key={x} className="px-4 py-3 text-start font-medium">{x}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {rows.map((r) => (
                  <tr key={r.id} className={r.status === 'new' ? 'bg-accent/[.04] hover:bg-sand-50' : 'hover:bg-sand-50'}>
                    <td className="px-4 py-3"><Link href={`/hr/${r.id}`} className="font-medium text-brand hover:underline" dir="ltr">{r.ref_no}</Link></td>
                    <td className="px-4 py-3">{h.kind[r.kind]}</td>
                    <td className="px-4 py-3"><div className="font-medium">{r.full_name}</div><div className="text-xs text-stone-450" dir="ltr">{r.email}</div></td>
                    <td className="px-4 py-3">{r.job_openings?.title ?? <span className="text-stone-450">{h.general}</span>}</td>
                    <td className="px-4 py-3">{[r.education, r.major].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="px-4 py-3">{r.experience_years ?? '—'}</td>
                    <td className="px-4 py-3"><Badge className={APP_TONE[r.status]}>{h.status[r.status as keyof typeof h.status]}</Badge></td>
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
