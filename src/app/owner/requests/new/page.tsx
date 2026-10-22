import { createClient } from '@/lib/supabase/server';
import { getI18n, requireRole } from '@/lib/session';
import { todayRiyadh } from '@/lib/format';
import { PageHeader } from '@/components/ui';
import { NewRequestForm, type UnitOption } from './new-request-form';

export default async function NewRequestPage({ searchParams }: { searchParams: Promise<{ unit?: string }> }) {
  await requireRole(['owner']);
  const [{ d, locale }, supabase, sp] = await Promise.all([getI18n(), createClient(), searchParams]);
  const { data } = await supabase
    .from('units')
    .select('id, unit_number, floor, buildings(name, projects(name_ar, name_en)), warranties(category, start_date, end_date)')
    .order('created_at');

  const today = todayRiyadh();
  const units: UnitOption[] = ((data ?? []) as unknown as {
    id: string; unit_number: string; floor: number;
    buildings: { name: string; projects: { name_ar: string; name_en: string | null } };
    warranties: { category: string | null; start_date: string; end_date: string }[];
  }[]).map((u) => ({
    id: u.id,
    label: `${locale === 'en' && u.buildings.projects.name_en ? u.buildings.projects.name_en : u.buildings.projects.name_ar}`,
    sub: `${d.owner.building} ${u.buildings.name} · ${d.owner.unit} ${u.unit_number} · ${d.owner.floor} ${u.floor}`,
    // categories with an active warranty (null = all categories) — shown as a hint only; the DB decides
    covered: u.warranties.filter((w) => w.start_date <= today && w.end_date >= today).map((w) => w.category ?? '*'),
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={d.newReq.title} />
      <NewRequestForm units={units} initialUnit={sp.unit} minDate={todayRiyadh(1)} />
    </div>
  );
}
