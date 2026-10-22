import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n, getSettings } from '@/lib/session';
import { getBalance } from '@/lib/me';
import type { Salary } from '@/lib/hr';
import { Badge, Card, CardHeader, PageHeader } from '@/components/ui';
import { RequestList, type HrRequestRow } from '@/components/hr-parts';
import { AccountForms, EmployeeForm, PrivateForm, SalaryForm, type EmployeeRow } from '../../employee-forms';

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { d, locale }, supabase, s] = await Promise.all([params, getI18n(), createClient(), getSettings()]);
  const isNew = id === 'new';
  const [{ data: e }, { data: deps }, { data: emps }, { data: locs }] = await Promise.all([
    isNew ? Promise.resolve({ data: null }) : supabase.from('employees').select('*').eq('id', id).maybeSingle(),
    supabase.from('departments').select('id, name').order('name'),
    supabase.from('employees').select('id, full_name, job_title').neq('status', 'terminated').order('full_name'),
    supabase.from('work_locations').select('id, name').eq('is_active', true).order('name'),
  ]);
  if (!isNew && !e) notFound();
  const opts = {
    departments: (deps ?? []).map((x) => ({ id: x.id, label: x.name })),
    managers: (emps ?? []).map((x) => ({ id: x.id, label: `${x.full_name} — ${x.job_title}` })),
    locations: (locs ?? []).map((x) => ({ id: x.id, label: x.name })),
  };
  const h = d.hrm;
  const back = <Link href="/hr/employees" className="inline-flex items-center gap-1 text-sm text-stone-450 hover:text-ink"><ChevronRight className="h-4 w-4 ltr:rotate-180" />{h.employees}</Link>;
  if (isNew) {
    return (
      <div className="mx-auto max-w-4xl space-y-5">{back}<PageHeader title={h.addEmployee} />
        <Card className="p-5 sm:p-7"><EmployeeForm e={{}} {...opts} /></Card>
      </div>
    );
  }
  const [{ data: sal }, { data: priv }, balance, { data: reqs }, { data: profile }, { data: freeProfiles }, { data: linked }] = await Promise.all([
    supabase.from('employee_salaries').select('*').eq('employee_id', id).maybeSingle(),
    supabase.from('employee_private').select('*').eq('employee_id', id).maybeSingle(),
    getBalance(id),
    supabase.from('hr_requests').select('id, ref_no, type, status, leave_type, start_date, end_date, days, work_date, hours, amount, created_at, leave_types(name_ar, name_en)').eq('employee_id', id).order('created_at', { ascending: false }).limit(10),
    e!.profile_id ? supabase.from('profiles').select('email, role, is_active').eq('id', e!.profile_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('profiles').select('id, full_name, email, role').neq('role', 'owner').eq('is_active', true).order('full_name'),
    supabase.from('employees').select('profile_id').not('profile_id', 'is', null),
  ]);
  const taken = new Set((linked ?? []).map((x) => x.profile_id));
  const free = (freeProfiles ?? []).filter((p) => !taken.has(p.id)).map((p) => ({ id: p.id, label: `${p.full_name} — ${p.email ?? ''} (${d.roles[p.role as keyof typeof d.roles] ?? p.role})` }));
  const rates = { saudi: Number(s.gosi_saudi_rate ?? 9.75), resident: Number(s.gosi_resident_rate ?? 0) };

  return (
    <div className="space-y-6">
      {back}
      <PageHeader eyebrow={<span dir="ltr">{e!.emp_no}</span>} title={e!.full_name} subtitle={e!.job_title}
        actions={balance && <Badge className="bg-accent/10 text-accent ring-accent/20">{d.me.balance.available}: {balance.available.toFixed(1)} {d.me.balance.days}</Badge>} />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card className="p-5 sm:p-7"><EmployeeForm e={e as EmployeeRow} {...opts} /></Card>
        <div className="space-y-6">
          <Card><CardHeader title={h.sections.salary} /><div className="p-5"><SalaryForm employeeId={id} salary={sal as Salary | null} nationality={e!.nationality_type} rates={rates} /></div></Card>
          <Card><CardHeader title={h.sections.private} /><div className="p-5"><PrivateForm employeeId={id} p={priv} /></div></Card>
          <Card>
            <CardHeader title={h.sections.account} />
            <div className="p-5">
              {profile ? (
                <p className="text-sm">{h.account.linked}: <span dir="ltr" className="font-medium">{profile.email}</span> · {d.roles[profile.role as keyof typeof d.roles]}</p>
              ) : <AccountForms employeeId={id} hasEmail={!!e!.email} profiles={free} />}
            </div>
          </Card>
          <Card>
            <CardHeader title={d.me.myRequests} />
            {reqs?.length ? <RequestList rows={reqs as unknown as HrRequestRow[]} d={d} locale={locale} /> : <p className="p-5 text-sm text-stone-450">{d.me.noRequests}</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
