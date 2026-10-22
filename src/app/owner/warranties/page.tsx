import Link from 'next/link';
import { AlertTriangle, Building2, FolderOpen, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n, requireRole } from '@/lib/session';
import { todayRiyadh } from '@/lib/format';
import { fmt } from '@/lib/i18n';
import type { WarrantyRow } from '@/lib/portal';
import { Alert, Card, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { WarrantyTimeline } from '@/components/portal';

type Unit = { id: string; unit_number: string; buildings: { name: string; projects: { name_ar: string; name_en: string | null } | null } | null };

/** Warranty center: every warranty of every unit the owner has, with time left and a certificate */
export default async function WarrantyCenter() {
  await requireRole(['owner']);
  const [{ d, locale }, supabase] = await Promise.all([getI18n(), createClient()]);
  await supabase.rpc('queue_warranty_alerts'); // reminders even without a scheduler
  const { data: units } = await supabase.from('units').select('id, unit_number, buildings(name, projects(name_ar, name_en))').order('created_at');
  const list = (units ?? []) as unknown as Unit[];
  const { data: ws } = list.length
    ? await supabase.from('warranties').select('*, contractors(name)').in('unit_id', list.map((u) => u.id))
    : { data: [] };
  const warranties = (ws ?? []) as WarrantyRow[];
  const today = todayRiyadh();
  const soon = warranties.filter((w) => w.end_date >= today && w.end_date <= todayRiyadh(30));

  return (
    <div className="space-y-6">
      <PageHeader title={d.portal.warrantyCenter} subtitle={d.portal.warrantyCenterSub} />
      {soon.length > 0 && (
        <Alert tone="warn"><span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{fmt(d.portal.expiringAlert, { n: soon.length })}</span></Alert>
      )}
      {!list.length && <Card><EmptyState icon={<Building2 className="h-5 w-5" />} title={d.owner.noUnits} /></Card>}
      {list.map((u) => {
        const p = u.buildings?.projects;
        const mine = warranties.filter((w) => w.unit_id === u.id);
        return (
          <Card key={u.id}>
            <CardHeader
              title={<span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand" />{locale === 'en' && p?.name_en ? p.name_en : p?.name_ar} · {d.owner.unit} {u.unit_number}</span>}
              subtitle={u.buildings?.name}
              action={<Link href={`/owner/units/${u.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"><FolderOpen className="h-4 w-4" />{d.portal.unitFile}</Link>}
            />
            <div className="p-5">
              <WarrantyTimeline warranties={mine} today={today} d={d} locale={locale} certHref={(id) => `/warranty-certificate/${id}`} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
