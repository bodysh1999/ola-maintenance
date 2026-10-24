import { Inbox, UserCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile, getI18n } from '@/lib/session';
import { getMyEmployee } from '@/lib/me';
import { fmtDate } from '@/lib/format';
import { Badge, Card, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { RequestList, type HrRequestRow } from '@/components/hr-parts';
import { CancelDelegationButton, DelegationForm } from '@/components/hr-ops-client';

type Deleg = { id: string; delegator_id: string; delegate_id: string; start_date: string; end_date: string; reason: string | null;
  delegator: { full_name: string } | null; delegatee: { full_name: string } | null };

export default async function Approvals() {
  const [{ d, locale }, supabase, me, profile] = await Promise.all([getI18n(), createClient(), getMyEmployee(), getCurrentProfile()]);
  const h = d.hrops;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
  const [{ data }, { count: team }, { data: dl }] = await Promise.all([
    supabase.rpc('my_approval_queue'),
    me ? supabase.from('employees').select('id', { count: 'exact', head: true }).eq('manager_id', me.id).eq('status', 'active') : Promise.resolve({ count: 0 }),
    supabase.from('approval_delegations')
      .select('id, delegator_id, delegate_id, start_date, end_date, reason, delegator:employees!approval_delegations_delegator_id_fkey(full_name), delegatee:employees!approval_delegations_delegate_id_fkey(full_name)')
      .is('cancelled_at', null).gte('end_date', today).order('start_date'),
  ]);
  const rows = ((data ?? []) as (HrRequestRow & { employee_name: string })[]).map((r) => ({ ...r, status: 'pending' }));
  const delegs = (dl ?? []) as unknown as Deleg[];
  const given = delegs.filter((x) => x.delegator_id === me?.id);
  const received = delegs.filter((x) => x.delegate_id === me?.id);
  const isManager = (team ?? 0) > 0 || profile?.role === 'hr' || profile?.role === 'admin';
  const { data: cands } = isManager && me ? await supabase.rpc('delegation_candidates') : { data: [] };
  const state = (x: Deleg) => (x.start_date > today ? h.upcoming : h.active);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title={d.me.approvals} subtitle={`${rows.length}`} />
      {received.length > 0 && (
        <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-sky-200">
          {received.map((x) => <div key={x.id}>{h.received}: {x.delegator?.full_name} · {fmtDate(x.start_date, locale)} — {fmtDate(x.end_date, locale)}</div>)}
        </div>
      )}
      <Card>{rows.length ? <RequestList rows={rows} d={d} locale={locale} showEmployee /> : <EmptyState icon={<Inbox className="h-5 w-5" />} title={d.me.noApprovals} />}</Card>

      {isManager && me && (
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-brand" />{h.delegation}</span>} subtitle={h.delegationSub} />
          <div className="space-y-5 p-5">
            {given.length > 0 ? (
              <ul className="divide-y divide-sand-100 rounded-xl border border-sand-100">
                {given.map((x) => (
                  <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span><span className="font-medium">{x.delegatee?.full_name}</span> · {fmtDate(x.start_date, locale)} — {fmtDate(x.end_date, locale)}{x.reason ? ` · ${x.reason}` : ''}</span>
                    <span className="flex items-center gap-2"><Badge className="bg-emerald-50 text-emerald-800 ring-emerald-200">{state(x)}</Badge><CancelDelegationButton id={x.id} /></span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-stone-450">{h.noDelegations}</p>}
            <DelegationForm candidates={(cands ?? []) as { id: string; full_name: string; job_title: string | null }[]} minDate={today} />
          </div>
        </Card>
      )}
    </div>
  );
}
