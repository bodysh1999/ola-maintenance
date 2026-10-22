import Link from 'next/link';
import { Building2, MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n, getCurrentProfile } from '@/lib/session';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { ProjectForm } from './forms';

export default async function ProjectsPage() {
  const [{ d, locale }, supabase, profile] = await Promise.all([getI18n(), createClient(), getCurrentProfile()]);
  const { data } = await supabase
    .from('projects')
    .select('id, name_ar, name_en, city, district, image_url, delivery_year, sales_status, buildings(id, units(id, owner_id))')
    .order('created_at', { ascending: false });
  const { data: reqs } = await supabase.from('request_overview').select('project_id, is_overdue, status');

  const projects = (data ?? []) as unknown as {
    id: string; name_ar: string; name_en: string | null; city: string; district: string | null; image_url: string | null; delivery_year: number | null; sales_status: 'sold' | 'selling' | 'construction';
    buildings: { id: string; units: { id: string; owner_id: string | null }[] }[];
  }[];
  const p = d.admin.projects;

  return (
    <div>
      <PageHeader title={p.title} actions={profile?.role === 'admin' && <ProjectForm />} />
      {!projects.length ? (
        <Card><EmptyState icon={<Building2 className="h-5 w-5" />} title={d.common.noData} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((pr) => {
            const units = pr.buildings.flatMap((b) => b.units);
            const projReqs = (reqs ?? []).filter((r) => r.project_id === pr.id);
            const open = projReqs.filter((r) => !['completed', 'rejected'].includes(r.status)).length;
            return (
              <Link key={pr.id} href={`/admin/projects/${pr.id}`} className="group overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-card transition hover:shadow-lift">
                <div className="relative h-36 bg-gradient-to-br from-brand to-brand/70">
                  {pr.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pr.image_url} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
                  <span className={`absolute end-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur ${pr.sales_status === 'sold' ? 'bg-white/90 text-brand' : pr.sales_status === 'selling' ? 'bg-accent text-white' : 'bg-ink/60 text-white'}`}>{p.stage[pr.sales_status]}</span>
                  <div className="absolute bottom-3 start-4 text-white">
                    <div className="text-lg font-semibold">{locale === 'en' && pr.name_en ? pr.name_en : pr.name_ar}</div>
                    <div className="flex items-center gap-1 text-xs text-white/75"><MapPin className="h-3 w-3" />{pr.city}{pr.district ? ` · ${pr.district}` : ''}{pr.delivery_year ? ` · ${pr.delivery_year}` : ''}</div>
                  </div>
                </div>
                <div className="grid grid-cols-4 divide-x divide-sand-100 text-center rtl:divide-x-reverse">
                  <Stat label={p.buildings} value={pr.buildings.length} />
                  <Stat label={p.units} value={units.length} />
                  <Stat label={p.occupied} value={units.filter((u) => u.owner_id).length} />
                  <Stat label={p.requests} value={open} accent={open > 0} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="px-2 py-3">
      <div className={`text-lg font-semibold tabular-nums ${accent ? 'text-accent' : ''}`}>{value}</div>
      <div className="text-[11px] text-stone-450">{label}</div>
    </div>
  );
}
