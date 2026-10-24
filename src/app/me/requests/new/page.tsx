import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n, getSettings } from '@/lib/session';
import { getBalance, getMyEmployee, getSalary } from '@/lib/me';
import { HR_REQUEST_TYPES, type HrRequestType } from '@/lib/hr';
import { Card, PageHeader } from '@/components/ui';
import { HrRequestForm } from '@/components/hr-client';
import { TYPE_ICONS } from '@/components/hr-parts';

export default async function NewHrRequest({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const [{ type }, { d }, me, s, supabase] = await Promise.all([searchParams, getI18n(), getMyEmployee(), getSettings(), createClient()]);
  if (!me) notFound();
  const t = (HR_REQUEST_TYPES as readonly string[]).includes(type ?? '') ? (type as HrRequestType) : 'leave';
  const [balance, salary, { data: leaveTypes }, { data: holidays }] = await Promise.all([
    getBalance(me.id), getSalary(me.id),
    supabase.from('leave_types').select('code, name_ar, name_en, max_days, requires_attachment, uses_balance, note_ar, gender').eq('is_active', true).order('sort'),
    supabase.from('public_holidays').select('start_date, end_date').gte('end_date', new Date().toISOString().slice(0, 10)),
  ]);
  const Icon = TYPE_ICONS[t];
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/me" className="inline-flex items-center gap-1 text-sm text-stone-450 hover:text-ink"><ChevronRight className="h-4 w-4 ltr:rotate-180" />{d.me.title}</Link>
      <PageHeader title={<span className="flex items-center gap-3"><Icon className="h-7 w-7 text-accent" />{d.me.types[t]}</span>} subtitle={d.me.typeHints[t]} />
      <div className="flex flex-wrap gap-2">
        {HR_REQUEST_TYPES.filter((x) => x !== 'exit_reentry' || me.nationality_type === 'resident').map((x) => (
          <Link key={x} href={`?type=${x}`} className={x === t ? 'rounded-full bg-brand px-3.5 py-1.5 text-xs font-medium text-white' : 'rounded-full border border-sand-200 bg-white px-3.5 py-1.5 text-xs text-ink/70 hover:border-brand/30'}>{d.me.types[x]}</Link>
        ))}
      </div>
      <Card className="p-5 sm:p-7">
        <HrRequestForm key={t} type={t} employeeId={me.id} leaveTypes={leaveTypes ?? []} available={balance?.available ?? null}
          salary={salary} perDiem={Number(s.trip_per_diem ?? 500)} gender={me.gender} holidays={holidays ?? []} />
      </Card>
    </div>
  );
}
