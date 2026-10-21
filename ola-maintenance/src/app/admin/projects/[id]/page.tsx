import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Layers } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile, getI18n } from '@/lib/session';
import { fmtDate, todayRiyadh } from '@/lib/format';
import { Badge, Card, CardHeader, PageHeader } from '@/components/ui';
import { BuildingForm, ProjectSiteForm, UnitCreateForm } from '../forms';
import { SALE_TONE } from '@/lib/sales-hr';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { d, locale }, supabase, profile] = await Promise.all([params, getI18n(), createClient(), getCurrentProfile()]);
  const { data: project } = await supabase
    .from('projects')
    .select('*, buildings(id, name, floors_count, units(id, unit_number, floor, unit_type, area_sqm, handover_date, owner_id, price, sale_status, owners(full_name), warranties(end_date)))')
    .eq('id', id).maybeSingle();
  if (!project) notFound();
  const isAdmin = profile?.role === 'admin';
  const { data: owners } = isAdmin ? await supabase.from('owners').select('id, full_name, phone').order('full_name') : { data: [] };
  const { data: openReqs } = await supabase.from('request_overview').select('unit_id').eq('project_id', id).not('status', 'in', '(completed,rejected)');
  const openByUnit = new Map<string, number>();
  (openReqs ?? []).forEach((r) => openByUnit.set(r.unit_id, (openByUnit.get(r.unit_id) ?? 0) + 1));

  type U = { id: string; unit_number: string; floor: number; unit_type: string; area_sqm: number | null; handover_date: string | null; owner_id: string | null; price: number | null; sale_status: string | null; owners: { full_name: string } | null; warranties: { end_date: string }[] };
  const buildings = ((project.buildings ?? []) as { id: string; name: string; floors_count: number; units: U[] }[]).sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true }));
  const today = todayRiyadh();
  const p = d.admin.projects;

  return (
    <div className="space-y-6">
      <Link href="/admin/projects" className="inline-flex items-center gap-1 text-sm text-stone-450 hover:text-ink"><ChevronRight className="h-4 w-4 ltr:rotate-180" />{p.title}</Link>
      <PageHeader
        title={locale === 'en' && project.name_en ? project.name_en : project.name_ar}
        subtitle={`${project.city}${project.district ? ` · ${project.district}` : ''} · ${buildings.length} ${p.buildings} · ${buildings.reduce((s, b) => s + b.units.length, 0)} ${p.units}`}
      />

      {isAdmin && (
        <div className="flex flex-col gap-4">
          <ProjectSiteForm project={project} />
          <Card className="p-5"><BuildingForm projectId={project.id} /></Card>
          {buildings.length > 0 && (
            <UnitCreateForm
              buildings={buildings.map((b) => ({ id: b.id, label: b.name }))}
              owners={(owners ?? []).map((o) => ({ id: o.id, label: `${o.full_name} — ${o.phone}` }))}
            />
          )}
        </div>
      )}

      {buildings.map((b) => (
        <Card key={b.id} className="overflow-hidden">
          <CardHeader title={<span className="flex items-center gap-2"><Layers className="h-4 w-4 text-brand" />{d.owner.building} {b.name}</span>} subtitle={`${b.floors_count} ${p.floors} · ${b.units.length} ${p.units}`} />
          {b.units.length === 0 ? <p className="px-5 py-6 text-sm text-stone-450">{d.common.noData}</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-sand-50/70 text-xs text-stone-450">
                  <tr>
                    <th className="px-4 py-2.5 text-start font-medium">{p.unitNo}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{p.floor}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{p.type}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{p.owner}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{p.handover}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{d.owner.warrantyStatus}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{p.requests}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{d.site.saleStatus}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-100">
                  {b.units.sort((x, y) => x.unit_number.localeCompare(y.unit_number, 'en', { numeric: true })).map((u) => {
                    const active = u.warranties.filter((w) => w.end_date >= today).length;
                    const open = openByUnit.get(u.id) ?? 0;
                    return (
                      <tr key={u.id} className="hover:bg-sand-50">
                        <td className="px-4 py-2.5"><Link href={`/admin/units/${u.id}`} className="font-medium text-brand hover:underline">{u.unit_number}</Link></td>
                        <td className="px-4 py-2.5">{u.floor}</td>
                        <td className="px-4 py-2.5">{d.unitType[u.unit_type as keyof typeof d.unitType]}{u.area_sqm ? ` · ${u.area_sqm} m²` : ''}</td>
                        <td className="px-4 py-2.5">{u.owners?.full_name ?? <span className="text-stone-400">{p.noOwner}</span>}</td>
                        <td className="px-4 py-2.5">{fmtDate(u.handover_date, locale)}</td>
                        <td className="px-4 py-2.5">
                          {u.warranties.length === 0 ? <span className="text-xs text-stone-400">—</span>
                            : active ? <Badge className="bg-emerald-50 text-emerald-800 ring-emerald-200">{active} {d.admin.unit.active}</Badge>
                              : <Badge className="bg-rose-50 text-rose-800 ring-rose-200">{d.admin.unit.expired}</Badge>}
                        </td>
                        <td className="px-4 py-2.5">{open ? <Badge className="bg-amber-50 text-amber-800 ring-amber-200">{open}</Badge> : <span className="text-stone-400">0</span>}</td>
                        <td className="px-4 py-2.5">
                          {u.sale_status && u.sale_status !== 'not_for_sale' ? (
                            <span className="flex items-center gap-1.5">
                              <Badge className={SALE_TONE[u.sale_status]}>{d.saleStatus[u.sale_status as keyof typeof d.saleStatus]}</Badge>
                              {u.price && u.sale_status !== 'sold' && <span className="text-xs text-stone-450">{Number(u.price).toLocaleString('en-US')}</span>}
                            </span>
                          ) : <span className="text-xs text-stone-400">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
