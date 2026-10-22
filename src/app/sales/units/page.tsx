import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { SALE_TONE } from '@/lib/sales-hr';
import { Badge, Card, CardHeader, PageHeader } from '@/components/ui';
import { UnitSaleForm } from '../forms';

type U = { id: string; unit_number: string; floor: number; unit_type: string; area_sqm: number | null; bedrooms: number | null; price: number | null; sale_status: string; owner_id: string | null };
type P = { id: string; name_ar: string; name_en: string | null; sales_status: string; buildings: { name: string; units: U[] }[] };

export default async function SalesUnits({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const [{ d, locale }, supabase, sp] = await Promise.all([getI18n(), createClient(), searchParams]);
  const { data } = await supabase.from('projects')
    .select('id, name_ar, name_en, sales_status, buildings(name, units(id, unit_number, floor, unit_type, area_sqm, bedrooms, price, sale_status, owner_id))')
    .neq('sales_status', 'sold').order('name_ar', { ascending: false });
  const projects = (data ?? []) as P[];
  const s = d.sales;
  return (
    <div className="space-y-6">
      <PageHeader title={s.units.title} subtitle={s.units.subtitle}
        actions={<Link href={sp.all ? '/sales/units' : '/sales/units?all=1'} className="text-sm text-brand hover:underline">{sp.all ? s.units.onlyListed : d.common.all}</Link>} />
      {projects.map((p) => {
        const units = p.buildings.flatMap((b) => b.units.map((u) => ({ ...u, building: b.name })))
          .filter((u) => !u.owner_id && (sp.all || u.sale_status !== 'not_for_sale'))
          .sort((a, b) => a.floor - b.floor || a.unit_number.localeCompare(b.unit_number, 'en', { numeric: true }));
        return (
          <Card key={p.id} className="overflow-hidden">
            <CardHeader title={locale === 'en' && p.name_en ? p.name_en : p.name_ar} subtitle={`${units.length} ${d.admin.projects.units}`}
              action={<Link href={`/projects/${p.id}`} target="_blank" className="inline-flex items-center gap-1 text-sm text-brand hover:underline">{d.site.viewOnSite}<ExternalLink className="h-3.5 w-3.5" /></Link>} />
            {units.length === 0 ? <p className="px-5 py-6 text-sm text-stone-450">{d.common.noData}</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-sand-50/70 text-xs text-stone-450">
                    <tr>{[s.unit, d.admin.projects.floor, d.admin.projects.area, d.admin.projects.bedrooms, d.common.status, `${d.site.price} / ${d.site.saleStatus}`].map((h) => <th key={h} className="px-4 py-2.5 text-start font-medium">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-sand-100">
                    {units.map((u) => (
                      <tr key={u.id}>
                        <td className="px-4 py-2.5 font-medium">{u.unit_number} <span className="text-xs text-stone-450">· {u.building}</span></td>
                        <td className="px-4 py-2.5">{u.floor}</td>
                        <td className="px-4 py-2.5">{u.area_sqm ?? '—'}</td>
                        <td className="px-4 py-2.5">{u.bedrooms ?? '—'}</td>
                        <td className="px-4 py-2.5"><Badge className={SALE_TONE[u.sale_status]}>{d.saleStatus[u.sale_status as keyof typeof d.saleStatus]}</Badge></td>
                        <td className="px-4 py-2.5"><UnitSaleForm unit={u} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
