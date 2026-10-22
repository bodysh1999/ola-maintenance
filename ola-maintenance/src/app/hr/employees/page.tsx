import Link from 'next/link';
import { AlertTriangle, CalendarOff, Inbox, Search, UserCheck, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { fmtDate } from '@/lib/format';
import { Badge, Card, CardHeader, EmptyState, Input, LinkButton, PageHeader, StatCard, buttonClass } from '@/components/ui';

type E = { id: string; emp_no: string; full_name: string; job_title: string; email: string | null; nationality_type: string; hire_date: string; status: string;
  contract_end: string | null; profile_id: string | null; departments: { name: string } | null; manager: { full_name: string } | null; employee_private: { id_expiry: string | null } | null };

export default async function Employees({ searchParams }: { searchParams: Promise<{ q?: string; all?: string }> }) {
  const [{ d, locale }, supabase, sp] = await Promise.all([getI18n(), createClient(), searchParams]);
  const h = d.hrm;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
  const in60 = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);
  let q = supabase.from('employees')
    .select('id, emp_no, full_name, job_title, email, nationality_type, hire_date, status, contract_end, profile_id, departments!employees_department_id_fkey(name), manager:manager_id(full_name), employee_private(id_expiry)')
    .order('full_name');
  if (!sp.all) q = q.neq('status', 'terminated');
  if (sp.q) { const t = sp.q.replace(/[%,()*]/g, ' ').trim(); if (t) q = q.or(`full_name.ilike.%${t}%,emp_no.ilike.%${t}%,job_title.ilike.%${t}%,email.ilike.%${t}%`); }
  const [{ data, error }, { count: present }, { data: onLeave }, { data: queue }] = await Promise.all([
    q,
    supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('work_date', today),
    supabase.from('hr_requests').select('id, employees!hr_requests_employee_id_fkey(full_name)').eq('status', 'approved').in('type', ['leave', 'business_trip']).lte('start_date', today).gte('end_date', today),
    supabase.rpc('my_approval_queue'),
  ]);
  const rows = (data ?? []) as unknown as E[];
  const expiring = rows.filter((e) => (e.employee_private?.id_expiry && e.employee_private.id_expiry <= in60) || (e.contract_end && e.contract_end <= in60));
  const i = d.me.info;

  return (
    <div className="space-y-6">
      <PageHeader title={h.employees} subtitle={`${rows.length}`} actions={<LinkButton href="/hr/employees/new">{h.addEmployee}</LinkButton>} />
      {error && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{/(does not exist|Could not find the table)/i.test(error.message) ? 'شغّل ملفات SQL رقم 8 و 9 في Supabase أولًا.' : error.message}</p>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={h.employees} value={rows.filter((e) => e.status === 'active').length} icon={<Users className="h-5 w-5" />} tone="brand" />
        <StatCard label={h.presentToday} value={present ?? 0} icon={<UserCheck className="h-5 w-5" />} tone="good" />
        <StatCard label={h.onLeaveToday} value={onLeave?.length ?? 0} icon={<CalendarOff className="h-5 w-5" />} />
        <Link href="/me/approvals"><StatCard label={h.pendingRequests} value={(queue as unknown[] | null)?.length ?? 0} icon={<Inbox className="h-5 w-5" />} tone="warn" /></Link>
      </div>

      {expiring.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader title={<span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" />{h.expiring}</span>} />
          <ul className="divide-y divide-sand-100 text-sm">
            {expiring.map((e) => (
              <li key={e.id} className="flex flex-wrap justify-between gap-2 px-5 py-3">
                <Link href={`/hr/employees/${e.id}`} className="font-medium text-brand hover:underline">{e.full_name}</Link>
                <span className="text-stone-450">
                  {e.employee_private?.id_expiry && e.employee_private.id_expiry <= in60 && `${i.idExpiry}: ${fmtDate(e.employee_private.id_expiry, locale)}`}
                  {e.contract_end && e.contract_end <= in60 && ` · ${i.contractEnd}: ${fmtDate(e.contract_end, locale)}`}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-4">
        <form className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input name="q" defaultValue={sp.q} placeholder={`${d.common.name} / ${i.empNo} / ${i.jobTitle}`} className="ps-9" />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="all" value="1" defaultChecked={!!sp.all} className="h-4 w-4 accent-brand" />{h.fields.terminated}</label>
          <button className={buttonClass('primary')}>{d.common.search}</button>
        </form>
      </Card>

      <Card className="overflow-hidden">
        {!rows.length ? <EmptyState icon={<Users className="h-5 w-5" />} title={h.noEmployees} /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-sand-50/70 text-xs text-stone-450">
                <tr>{[i.empNo, d.common.name, i.jobTitle, i.department, i.manager, i.type, i.hireDate, d.hrm.sections.account].map((x) => <th key={x} className="px-4 py-3 text-start font-medium">{x}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {rows.map((e) => (
                  <tr key={e.id} className="hover:bg-sand-50">
                    <td className="px-4 py-3 text-stone-450" dir="ltr">{e.emp_no}</td>
                    <td className="px-4 py-3"><Link href={`/hr/employees/${e.id}`} className="font-medium text-brand hover:underline">{e.full_name}</Link>{e.status !== 'active' && <Badge className="ms-2 bg-stone-100 text-stone-600 ring-stone-200">{h.fields[e.status as 'suspended' | 'terminated']}</Badge>}</td>
                    <td className="px-4 py-3">{e.job_title}</td>
                    <td className="px-4 py-3">{e.departments?.name ?? '—'}</td>
                    <td className="px-4 py-3">{e.manager?.full_name ?? '—'}</td>
                    <td className="px-4 py-3">{e.nationality_type === 'saudi' ? i.saudi : i.resident}</td>
                    <td className="px-4 py-3">{fmtDate(e.hire_date, locale)}</td>
                    <td className="px-4 py-3">{e.profile_id ? <Badge className="bg-emerald-50 text-emerald-800 ring-emerald-200">✓</Badge> : <span className="text-xs text-stone-400">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
