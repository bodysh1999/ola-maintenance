import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarCheck2, ChevronRight, FolderOpen, Plus, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n, requireRole } from '@/lib/session';
import { fmtDate, todayRiyadh } from '@/lib/format';
import { loadUnitDocs, type WarrantyRow } from '@/lib/portal';
import type { RequestOverview } from '@/lib/types';
import { Card, CardHeader, KeyValue, LinkButton } from '@/components/ui';
import { UnitDocsList, WarrantyTimeline } from '@/components/portal';
import { RequestCard } from '@/components/request-card';

/** The owner's digital unit file: documents, warranties and maintenance history of one unit */
export default async function OwnerUnitPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(['owner']);
  const [{ id }, { d, locale }, supabase] = await Promise.all([params, getI18n(), createClient()]);
  const { data: unit } = await supabase.from('units')
    .select('id, unit_number, floor, unit_type, area_sqm, bedrooms, handover_date, image_url, buildings(name, projects(name_ar, name_en, image_url, city, district))')
    .eq('id', id).maybeSingle();
  if (!unit) notFound();
  const [docs, { data: ws }, { data: reqs }] = await Promise.all([
    loadUnitDocs(supabase, [id]),
    supabase.from('warranties').select('*, contractors(name)').eq('unit_id', id),
    supabase.from('request_overview').select('*').eq('unit_id', id).order('created_at', { ascending: false }).limit(20),
  ]);
  const b = unit.buildings as unknown as { name: string; projects: { name_ar: string; name_en: string | null; image_url: string | null; city: string; district: string | null } | null } | null;
  const p = b?.projects;
  const img = unit.image_url || p?.image_url;

  return (
    <div className="space-y-6">
      <Link href="/owner" className="inline-flex items-center gap-1 text-sm text-stone-450 hover:text-ink"><ChevronRight className="h-4 w-4 ltr:rotate-180" />{d.nav.home}</Link>

      <Card className="overflow-hidden">
        <div className="relative h-44 bg-gradient-to-br from-brand to-brand/70">
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/10 to-transparent" />
          <div className="absolute bottom-4 start-5 end-5 flex flex-wrap items-end justify-between gap-3 text-white">
            <div>
              <div className="text-xs text-white/75">{p ? `${p.city}${p.district ? ` · ${p.district}` : ''}` : ''}</div>
              <h1 className="font-display text-2xl font-bold">{locale === 'en' && p?.name_en ? p.name_en : p?.name_ar} · {d.owner.unit} {unit.unit_number}</h1>
              <div className="text-sm text-white/80">{d.owner.building} {b?.name} · {d.owner.floor} {unit.floor}</div>
            </div>
            <LinkButton href="/owner/requests/new" variant="accent" size="sm"><Plus className="h-4 w-4" />{d.owner.requestCta}</LinkButton>
          </div>
        </div>
        <div className="grid divide-y divide-sand-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0 rtl:sm:divide-x-reverse">
          <div className="px-5"><KeyValue label={<span className="flex items-center gap-1.5"><CalendarCheck2 className="h-3.5 w-3.5" />{d.owner.handover}</span>}>{fmtDate(unit.handover_date, locale)}</KeyValue></div>
          <div className="px-5"><KeyValue label={d.unitType[unit.unit_type as keyof typeof d.unitType] ?? unit.unit_type}>{unit.area_sqm ? `${unit.area_sqm} m²` : '—'}</KeyValue></div>
          <div className="px-5"><KeyValue label={d.portal.documents}>{docs.length}</KeyValue></div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><FolderOpen className="h-4 w-4 text-brand" />{d.portal.unitFile}</span>} />
          <div className="p-5"><UnitDocsList docs={docs} d={d} locale={locale} /></div>
        </Card>
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand" />{d.owner.warranties}</span>} />
          <div className="p-5">
            <WarrantyTimeline warranties={(ws ?? []) as WarrantyRow[]} today={todayRiyadh()} d={d} locale={locale} certHref={(wid) => `/warranty-certificate/${wid}`} />
          </div>
        </Card>
      </div>

      {!!reqs?.length && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">{d.admin.projects.requests}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {(reqs as RequestOverview[]).map((r) => <RequestCard key={r.id} r={r} d={d} locale={locale} href={`/owner/requests/${r.id}`} />)}
          </div>
        </section>
      )}
    </div>
  );
}
