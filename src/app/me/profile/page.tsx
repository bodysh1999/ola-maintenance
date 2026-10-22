import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getI18n, getSettings } from '@/lib/session';
import { getMyEmployee, getSalary } from '@/lib/me';
import { fmtDate } from '@/lib/format';
import { salaryBreakdown, sar } from '@/lib/hr';
import { Card, CardHeader, KeyValue, PageHeader } from '@/components/ui';

export default async function MyProfile() {
  const [{ d, locale }, me, s, supabase] = await Promise.all([getI18n(), getMyEmployee(), getSettings(), createClient()]);
  if (!me) notFound();
  const [salary, { data: priv }] = await Promise.all([getSalary(me.id), supabase.from('employee_private').select('*').eq('employee_id', me.id).maybeSingle()]);
  const i = d.me.info; const sl = d.me.salary;
  const br = salary ? salaryBreakdown(salary, me.nationality_type, { saudi: Number(s.gosi_saudi_rate ?? 9.75), resident: Number(s.gosi_resident_rate ?? 0) }) : null;
  const line = (label: string, v: number, neg = false) => (
    <div className="flex items-center justify-between py-2.5 text-sm"><span className="text-ink/70">{label}</span><span className={neg ? 'text-rose-700' : ''} dir="ltr">{neg ? '− ' : ''}{sar(v)} {d.common.sar}</span></div>
  );
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={me.full_name} subtitle={`${me.job_title} · ${me.emp_no}`} />
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader title={i.title} />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <KeyValue label={i.empNo}><span dir="ltr">{me.emp_no}</span></KeyValue>
            <KeyValue label={i.jobTitle}>{me.job_title}</KeyValue>
            <KeyValue label={i.department}>{me.departments?.name ?? '—'}</KeyValue>
            <KeyValue label={i.manager}>{me.manager?.full_name ?? '—'}</KeyValue>
            <KeyValue label={i.hireDate}>{fmtDate(me.hire_date, locale)}</KeyValue>
            <KeyValue label={i.type}>{me.nationality_type === 'saudi' ? i.saudi : i.resident}{me.nationality ? ` · ${me.nationality}` : ''}</KeyValue>
            <KeyValue label={i.contract}>{me.contract_type === 'fixed' ? i.fixed : i.unlimited}</KeyValue>
            {me.contract_end && <KeyValue label={i.contractEnd}>{fmtDate(me.contract_end, locale)}</KeyValue>}
            <KeyValue label={i.leaveDays}>{me.annual_leave_days}</KeyValue>
            <KeyValue label={i.workHours}><span dir="ltr">{me.work_start.slice(0, 5)} – {me.work_end.slice(0, 5)}</span></KeyValue>
            <KeyValue label={i.location}>{me.work_locations?.name ?? '—'}</KeyValue>
            <KeyValue label={d.common.email}><span dir="ltr" className="break-all">{me.email ?? '—'}</span></KeyValue>
            <KeyValue label={d.common.phone}><span dir="ltr">{me.phone ?? '—'}</span></KeyValue>
            {priv?.id_number && <KeyValue label={i.idNumber}><span dir="ltr">{priv.id_number}</span></KeyValue>}
            {priv?.id_expiry && <KeyValue label={i.idExpiry}>{fmtDate(priv.id_expiry, locale)}</KeyValue>}
            {priv?.iban && <KeyValue label={i.iban}><span dir="ltr" className="break-all">{priv.iban}</span>{priv.bank_name ? ` · ${priv.bank_name}` : ''}</KeyValue>}
          </div>
        </Card>
        <Card className="h-fit">
          <CardHeader title={sl.title} />
          {!salary || !br ? <p className="p-5 text-sm text-stone-450">{sl.notSet}</p> : (
            <div className="divide-y divide-sand-100 px-5 pb-3">
              {line(sl.basic, Number(salary.basic))}
              {line(sl.housing, Number(salary.housing))}
              {line(sl.transport, Number(salary.transport))}
              {Number(salary.other_allowances) > 0 && line(sl.other, Number(salary.other_allowances))}
              <div className="flex justify-between py-3 font-semibold"><span>{sl.gross}</span><span dir="ltr">{sar(br.gross)} {d.common.sar}</span></div>
              {line(`${sl.gosi} ${br.rate}%`, br.gosi, true)}
              {Number(salary.other_deductions) > 0 && line(sl.otherDed, Number(salary.other_deductions), true)}
              <div className="-mx-5 mt-2 flex justify-between bg-brand px-5 py-4 text-white"><span className="font-semibold">{sl.net}</span><span className="font-display text-xl font-bold" dir="ltr">{sar(br.net)} {d.common.sar}</span></div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
