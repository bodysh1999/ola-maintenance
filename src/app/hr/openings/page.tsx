import { MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { Badge, Card, PageHeader } from '@/components/ui';
import { OpeningForm, ToggleOpening } from '../forms';

export default async function OpeningsPage() {
  const [{ d }, supabase] = await Promise.all([getI18n(), createClient()]);
  const [{ data }, { data: apps }] = await Promise.all([
    supabase.from('job_openings').select('*').order('is_open', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('job_applications').select('opening_id'),
  ]);
  const counts = new Map<string, number>();
  (apps ?? []).forEach((a) => a.opening_id && counts.set(a.opening_id, (counts.get(a.opening_id) ?? 0) + 1));
  const o = d.hr.openings;
  return (
    <div className="space-y-6">
      <PageHeader title={o.title} actions={<a href="/careers" target="_blank" className="text-sm text-brand hover:underline">{d.site.viewOnSite}</a>} />
      <OpeningForm />
      <div className="grid gap-4 md:grid-cols-2">
        {(data ?? []).map((j) => (
          <Card key={j.id} className={j.is_open ? 'p-5' : 'p-5 opacity-60'}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">{j.title}</h3>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-450">
                  {j.department && <span>{j.department}</span>}
                  <span>· {d.hr.employment[j.employment as keyof typeof d.hr.employment]}</span>
                  <span className="inline-flex items-center gap-1">· <MapPin className="h-3 w-3" />{j.location}</span>
                </p>
              </div>
              <Badge className={j.is_open ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-stone-100 text-stone-600 ring-stone-200'}>{j.is_open ? o.open : o.closed}</Badge>
            </div>
            {j.description && <p className="mt-3 line-clamp-3 text-sm text-ink/70">{j.description}</p>}
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-stone-450">{counts.get(j.id) ?? 0} {o.applicants}</span>
              <ToggleOpening id={j.id} open={j.is_open} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
