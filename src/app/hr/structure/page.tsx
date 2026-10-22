import { MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n, getSettings } from '@/lib/session';
import { Card, CardHeader, PageHeader } from '@/components/ui';
import { DepartmentForm, HrSettingsForm, LeaveTypeRow, LocationForm } from '../employee-forms';

export default async function Structure() {
  const [{ d }, supabase, s] = await Promise.all([getI18n(), createClient(), getSettings()]);
  const [{ data: locs }, { data: deps }, { data: emps }, { data: lts }] = await Promise.all([
    supabase.from('work_locations').select('*').order('name'),
    supabase.from('departments').select('*').order('name'),
    supabase.from('employees').select('id, full_name, job_title').eq('status', 'active').order('full_name'),
    supabase.from('leave_types').select('code, name_ar, name_en, max_days, is_active, note_ar').order('sort'),
  ]);
  const h = d.hrm;
  const depOpts = (deps ?? []).map((x) => ({ id: x.id, label: x.name }));
  const mgrOpts = (emps ?? []).map((x) => ({ id: x.id, label: `${x.full_name} — ${x.job_title}` }));
  return (
    <div className="space-y-6">
      <PageHeader title={h.structure} />
      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-accent" />{h.locations.title}</span>} subtitle={h.locations.hint} />
        <div className="space-y-4 p-5">
          {(locs ?? []).map((l) => (
            <div key={l.id} className="rounded-xl border border-sand-100 p-3">
              <LocationForm loc={l} />
              <a href={`https://www.google.com/maps?q=${l.lat},${l.lng}`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-brand hover:underline">Google Maps ↗</a>
            </div>
          ))}
          <div className="rounded-xl bg-sand-50 p-3"><LocationForm /></div>
        </div>
      </Card>
      <Card>
        <CardHeader title={h.departments.title} />
        <div className="space-y-3 p-5">
          {(deps ?? []).map((dep) => <DepartmentForm key={dep.id} dep={dep} departments={depOpts} managers={mgrOpts} />)}
          <div className="rounded-xl bg-sand-50 p-3"><DepartmentForm departments={depOpts} managers={mgrOpts} /></div>
        </div>
      </Card>
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title={h.leaveTypes.title} />
          <div className="divide-y divide-sand-100 px-5">{(lts ?? []).map((lt) => <LeaveTypeRow key={lt.code} lt={lt} />)}</div>
        </Card>
        <Card className="h-fit"><CardHeader title={h.settings.title} /><div className="p-5"><HrSettingsForm s={s} /></div></Card>
      </div>
    </div>
  );
}
