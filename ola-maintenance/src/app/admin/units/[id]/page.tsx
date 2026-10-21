import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile, getI18n } from '@/lib/session';
import { fmtDate, todayRiyadh } from '@/lib/format';
import type { RequestOverview } from '@/lib/types';
import { Badge, Card, CardHeader, KeyValue, PageHeader } from '@/components/ui';
import { RequestsTable } from '@/components/requests-table';
import { StandardWarrantyButton, UnitEditForm, WarrantyForm } from '../../projects/forms';
import { DeleteWarrantyButton } from './delete-warranty';

export default async function UnitPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { d, locale }, supabase, profile] = await Promise.all([params, getI18n(), createClient(), getCurrentProfile()]);
  const { data: unit } = await supabase
    .from('units')
    .select('*, owners(id, full_name, phone, email), buildings(id, name, projects(id, name_ar, name_en))')
    .eq('id', id).maybeSingle();
  if (!unit) notFound();
  const isAdmin = profile?.role === 'admin';

  const [{ data: warranties }, { data: reqs }, { data: owners }, { data: contractors }] = await Promise.all([
    supabase.from('warranties').select('*, contractors(name)').eq('unit_id', id).order('end_date'),
    supabase.from('request_overview').select('*').eq('unit_id', id).order('created_at', { ascending: false }),
    isAdmin ? supabase.from('owners').select('id, full_name, phone').order('full_name') : Promise.resolve({ data: [] as { id: string; full_name: string; phone: string }[] }),
    isAdmin ? supabase.from('contractors').select('id, name').eq('is_active', true).order('name') : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const today = todayRiyadh();
  const u = d.admin.unit;
  const project = unit.buildings?.projects;

  return (
    <div className="space-y-6">
      <Link href={`/admin/projects/${project?.id}`} className="inline-flex items-center gap-1 text-sm text-stone-450 hover:text-ink">
        <ChevronRight className="h-4 w-4 ltr:rotate-180" />{locale === 'en' && project?.name_en ? project.name_en : project?.name_ar}
      </Link>
      <PageHeader eyebrow={u.title} title={`${d.owner.building} ${unit.buildings?.name} · ${d.owner.unit} ${unit.unit_number}`}
        subtitle={`${d.unitType[unit.unit_type as keyof typeof d.unitType]} · ${d.owner.floor} ${unit.floor}${unit.area_sqm ? ` · ${unit.area_sqm} m²` : ''}`} />

      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand" />{u.warranties}</span>} subtitle={`${d.owner.handover}: ${fmtDate(unit.handover_date, locale)}`} />
            <div className="divide-y divide-sand-100">
              {(warranties ?? []).map((w) => {
                const active = w.start_date <= today && w.end_date >= today;
                return (
                  <div key={w.id} className="flex items-start gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{w.title}</span>
                        <Badge className={active ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-stone-100 text-stone-600 ring-stone-200'}>{active ? u.active : u.expired}</Badge>
                        <span className="text-xs text-stone-450">{w.category ? d.category[w.category as keyof typeof d.category] : u.anyCategory}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-stone-450">{fmtDate(w.start_date, locale)} — {fmtDate(w.end_date, locale)}{(w.contractors?.name || w.responsible_party) && ` · ${w.contractors?.name ?? w.responsible_party}`}</div>
                      {w.covered_items && <p className="mt-1.5 text-xs"><span className="text-emerald-700">{u.covered}:</span> {w.covered_items}</p>}
                      {w.excluded_items && <p className="mt-0.5 text-xs"><span className="text-rose-700">{u.excluded}:</span> {w.excluded_items}</p>}
                    </div>
                    {isAdmin && <DeleteWarrantyButton id={w.id} />}
                  </div>
                );
              })}
              {!warranties?.length && <p className="px-5 py-6 text-sm text-stone-450">{d.common.noData}</p>}
            </div>
            {isAdmin && (
              <div className="flex flex-col gap-4 border-t border-sand-100 p-5">
                {!warranties?.length && <StandardWarrantyButton unitId={unit.id} />}
                <WarrantyForm unitId={unit.id} handover={unit.handover_date} contractors={(contractors ?? []).map((c) => ({ id: c.id, label: c.name }))} />
              </div>
            )}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title={d.admin.projects.requests} subtitle={`${reqs?.length ?? 0}`} />
            <RequestsTable rows={(reqs ?? []) as RequestOverview[]} d={d} locale={locale} compact />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={d.admin.detail.owner} />
            <div className="divide-y divide-sand-100 px-5">
              <KeyValue label={d.common.name}>{unit.owners?.full_name ?? '—'}</KeyValue>
              <KeyValue label={d.common.phone}><span dir="ltr">{unit.owners?.phone ?? '—'}</span></KeyValue>
              <KeyValue label={d.common.email}><span dir="ltr">{unit.owners?.email ?? '—'}</span></KeyValue>
            </div>
          </Card>
          {isAdmin && (
            <Card>
              <CardHeader title={u.linkOwner} />
              <div className="p-5">
                <UnitEditForm id={unit.id} owners={(owners ?? []).map((o) => ({ id: o.id, label: `${o.full_name} — ${o.phone}` }))}
                  unit={{ unit_number: unit.unit_number, floor: unit.floor, unit_type: unit.unit_type, area_sqm: unit.area_sqm, bedrooms: unit.bedrooms, owner_id: unit.owner_id, handover_date: unit.handover_date, image_url: unit.image_url }} />
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
