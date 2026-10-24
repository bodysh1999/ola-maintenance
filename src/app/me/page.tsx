import Link from 'next/link';
import { ArrowUpLeft, ClipboardList, Inbox, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile, getI18n } from '@/lib/session';
import { getBalance, getMyEmployee, pendingApprovalsCount } from '@/lib/me';
import { HR_REQUEST_TYPES } from '@/lib/hr';
import { Card, CardHeader, EmptyState, LinkButton } from '@/components/ui';
import { PunchCard } from '@/components/hr-client';
import { RequestList, TYPE_ICONS, type HrRequestRow } from '@/components/hr-parts';

export default async function MeHome() {
  const [{ d, locale }, me, profile, supabase] = await Promise.all([getI18n(), getMyEmployee(), getCurrentProfile(), createClient()]);
  const m = d.me;
  if (!me) {
    return (
      <Card className="mx-auto max-w-xl">
        <EmptyState icon={<UserRound className="h-5 w-5" />} title={m.noFile}>
          {(profile?.role === 'hr' || profile?.role === 'admin') && <LinkButton href="/hr/employees" className="mt-4">{d.hrm.employees}</LinkButton>}
        </EmptyState>
      </Card>
    );
  }
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
  const [balance, approvals, { data: att }, { data: reqs }] = await Promise.all([
    getBalance(me.id), pendingApprovalsCount(),
    supabase.from('attendance').select('check_in_at, check_out_at, source').eq('employee_id', me.id).eq('work_date', today).maybeSingle(),
    supabase.from('hr_requests').select('id, ref_no, type, status, leave_type, start_date, end_date, days, work_date, hours, amount, created_at, leave_types(name_ar, name_en)')
      .eq('employee_id', me.id).order('created_at', { ascending: false }).limit(6),
  ]);
  const types = HR_REQUEST_TYPES.filter((t) => t !== 'exit_reentry' || me.nationality_type === 'resident');
  const b = m.balance;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-stone-450">{m.hello}</p>
        <h1 className="font-display text-3xl font-bold text-ink">{me.full_name.split(' ')[0]}</h1>
        <p className="mt-1 text-sm text-stone-450">{me.job_title}{me.departments ? ` · ${me.departments.name}` : ''} · <span dir="ltr">{me.emp_no}</span></p>
      </div>

      <PunchCard today={att ?? null} remote={me.remote_allowed} />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-stone-450">{b.title}</p>
              <p className="mt-1 font-display text-5xl font-bold text-brand">{balance ? balance.available.toFixed(1) : '—'} <span className="text-base font-normal text-stone-450">{b.days}</span></p>
            </div>
            <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">{balance?.yearly_rate ?? me.annual_leave_days} {b.rate}</span>
          </div>
          {balance && (
            <dl className="mt-6 grid grid-cols-4 gap-2 border-t border-sand-100 pt-4 text-center text-sm">
              {[[b.accrued, balance.accrued], [b.used, balance.used], [b.pending, balance.pending], [b.service, balance.service_years]].map(([l, v]) => (
                <div key={l as string}><dt className="text-[11px] text-stone-450">{l}</dt><dd className="mt-1 font-semibold">{Number(v).toFixed(1)}</dd></div>
              ))}
            </dl>
          )}
          <LinkButton href="/me/requests/new?type=leave" variant="accent" className="mt-5 w-full">{m.types.leave}</LinkButton>
        </Card>
        <div className="grid gap-4">
          <Link href="/me/approvals" className="group flex items-center gap-4 rounded-2xl border border-sand-200 bg-white p-5 shadow-card transition hover:border-brand/30">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-700"><Inbox className="h-6 w-6" /></span>
            <span className="flex-1"><span className="block text-sm text-stone-450">{m.approvals}</span><span className="font-display text-3xl font-bold">{approvals}</span></span>
            <ArrowUpLeft className="h-5 w-5 text-stone-400 transition group-hover:text-brand ltr:-scale-x-100" />
          </Link>
          <div className="grid grid-cols-2 gap-4">
            <Link href="/me/attendance" className="rounded-2xl border border-sand-200 bg-white p-5 text-sm font-medium shadow-card transition hover:border-brand/30">{m.attendance}</Link>
            <Link href="/me/profile" className="rounded-2xl border border-sand-200 bg-white p-5 text-sm font-medium shadow-card transition hover:border-brand/30">{m.profile}</Link>
            <Link href="/me/custody" className="rounded-2xl border border-sand-200 bg-white p-5 text-sm font-medium shadow-card transition hover:border-brand/30">{d.custody.title}</Link>
            <Link href="/me/payslips" className="rounded-2xl border border-sand-200 bg-white p-5 text-sm font-medium shadow-card transition hover:border-brand/30">{d.payroll.payslips}</Link>
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">{m.quick}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {types.map((t) => {
            const Icon = TYPE_ICONS[t];
            return (
              <Link key={t} href={`/me/requests/new?type=${t}`} className="group rounded-2xl border border-sand-200 bg-white p-4 transition hover:border-brand/30 hover:shadow-card">
                <Icon className="h-6 w-6 text-accent" strokeWidth={1.6} />
                <div className="mt-3 text-sm font-semibold leading-snug">{m.types[t]}</div>
                <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-stone-450">{m.typeHints[t]}</div>
              </Link>
            );
          })}
        </div>
      </section>

      <Card>
        <CardHeader title={m.myRequests} action={<Link href="/me/requests" className="text-sm text-brand hover:underline">{m.viewAll}</Link>} />
        {reqs?.length ? <RequestList rows={reqs as unknown as HrRequestRow[]} d={d} locale={locale} /> : <EmptyState icon={<ClipboardList className="h-5 w-5" />} title={m.noRequests} />}
      </Card>
    </div>
  );
}
