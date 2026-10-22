import { HardHat } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile, getI18n } from '@/lib/session';
import type { Category } from '@/lib/types';
import { Badge, Card, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { CategoryIcon } from '@/components/category-icon';
import { TechPhotoForm } from '@/components/portal-client';
import { ContractorCreateForm, StaffCreateForm, TechnicianCreateForm, ToggleActive } from './team-forms';

export default async function TeamPage() {
  const [{ d }, supabase, profile] = await Promise.all([getI18n(), createClient(), getCurrentProfile()]);
  const isAdmin = profile?.role === 'admin';
  const [{ data: techs }, { data: contractors }, { data: openWos }, { data: staff }] = await Promise.all([
    supabase.from('technicians').select('id, full_name, phone, photo_url, specialties, is_active, contractors(name), profiles(email)').order('full_name'),
    supabase.from('contractors').select('*').order('name'),
    supabase.from('work_orders').select('technician_id').in('status', ['assigned', 'in_progress', 'awaiting_parts', 'returned', 'submitted']),
    supabase.from('profiles').select('id, full_name, email, phone, role, is_active').in('role', ['admin', 'supervisor', 'sales', 'hr']).order('full_name'),
  ]);
  const open = new Map<string, number>();
  (openWos ?? []).forEach((w) => open.set(w.technician_id, (open.get(w.technician_id) ?? 0) + 1));
  const t = d.admin.team;
  const technicians = (techs ?? []) as unknown as { id: string; full_name: string; phone: string | null; photo_url: string | null; specialties: Category[]; is_active: boolean; contractors: { name: string } | null; profiles: { email: string } | null }[];

  return (
    <div className="space-y-6">
      <PageHeader title={d.nav.team} />

      <Card className="overflow-hidden">
        <CardHeader title={t.technicians} subtitle={`${technicians.length}`} />
        {isAdmin && <div className="border-b border-sand-100 p-5"><TechnicianCreateForm contractors={(contractors ?? []).map((c) => ({ id: c.id, name: c.name }))} /></div>}
        {!technicians.length ? <EmptyState icon={<HardHat className="h-5 w-5" />} title={d.common.noData} /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-sand-50/70 text-xs text-stone-450">
                <tr>
                  <th className="px-5 py-2.5 text-start font-medium">{d.common.name}</th>
                  <th className="px-5 py-2.5 text-start font-medium">{t.contractor}</th>
                  <th className="px-5 py-2.5 text-start font-medium">{t.specialties}</th>
                  <th className="px-5 py-2.5 text-start font-medium">{t.openTasks}</th>
                  <th className="px-5 py-2.5 text-start font-medium">{d.common.status}</th>
                  {isAdmin && <th />}
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {technicians.map((tc) => (
                  <tr key={tc.id} className={tc.is_active ? '' : 'opacity-60'}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {isAdmin ? <TechPhotoForm technicianId={tc.id} photo={tc.photo_url} name={tc.full_name} /> : null}
                        <div>
                          <div className="font-medium">{tc.full_name}</div>
                          <div className="text-xs text-stone-450" dir="ltr">{[tc.phone, tc.profiles?.email].filter(Boolean).join(' · ')}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">{tc.contractors?.name ?? t.inHouse}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {tc.specialties.map((s) => <span key={s} title={d.category[s]} className="grid h-7 w-7 place-items-center rounded-lg bg-brand/[.07] text-brand"><CategoryIcon category={s} className="h-3.5 w-3.5" /></span>)}
                      </div>
                    </td>
                    <td className="px-5 py-3 tabular-nums">{open.get(tc.id) ?? 0}</td>
                    <td className="px-5 py-3"><Badge className={tc.is_active ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-stone-100 text-stone-600 ring-stone-200'}>{tc.is_active ? d.common.active : d.common.inactive}</Badge></td>
                    {isAdmin && <td className="px-3"><ToggleActive kind="technician" id={tc.id} active={tc.is_active} /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title={t.contractors} subtitle={`${contractors?.length ?? 0}`} />
        {isAdmin && <div className="border-b border-sand-100 p-5"><ContractorCreateForm /></div>}
        <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
          {(contractors ?? []).map((c) => (
            <div key={c.id} className="rounded-xl border border-sand-200 p-4">
              <div className="font-medium">{c.name}</div>
              <div className="mt-0.5 text-xs text-stone-450">{[c.contact_name, c.phone].filter(Boolean).join(' · ')}{c.cr_number ? ` · ${t.cr} ${c.cr_number}` : ''}</div>
              <div className="mt-2 flex flex-wrap gap-1">{(c.specialties as Category[]).map((s) => <Badge key={s} className="bg-sand-100 text-ink/70 ring-sand-200">{d.category[s]}</Badge>)}</div>
            </div>
          ))}
          {!contractors?.length && <p className="text-sm text-stone-450">{d.common.noData}</p>}
        </div>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader title={t.staff} />
          <div className="border-b border-sand-100 p-5"><StaffCreateForm /></div>
          <ul className="divide-y divide-sand-100">
            {(staff ?? []).map((s) => (
              <li key={s.id} className={`flex items-center justify-between gap-3 px-5 py-3 ${s.is_active ? '' : 'opacity-60'}`}>
                <div>
                  <div className="font-medium">{s.full_name}</div>
                  <div className="text-xs text-stone-450" dir="ltr">{s.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-brand/10 text-brand ring-brand/20">{d.roles[s.role as 'admin' | 'supervisor' | 'sales' | 'hr']}</Badge>
                  {s.id !== profile?.id && <ToggleActive kind="staff" id={s.id} active={s.is_active} />}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
