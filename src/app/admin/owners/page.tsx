import Link from 'next/link';
import { Search, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile, getI18n } from '@/lib/session';
import { Badge, Card, EmptyState, Input, PageHeader } from '@/components/ui';
import { OwnerAccountActions, OwnerCreateForm, OwnerEditForm } from './owner-forms';

const STATUS_TONE = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  active: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  disabled: 'bg-stone-100 text-stone-600 ring-stone-200',
};

export default async function OwnersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [{ d }, supabase, profile, sp] = await Promise.all([getI18n(), createClient(), getCurrentProfile(), searchParams]);
  const isAdmin = profile?.role === 'admin';
  let q = supabase.from('owners')
    .select('id, full_name, phone, email, notes, account_status, created_at, units(id, unit_number, buildings(name, projects(name_ar)))')
    .order('created_at', { ascending: false });
  if (sp.q) {
    const term = sp.q.replace(/[%,()*]/g, ' ').trim();
    if (term) q = q.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`);
  }
  const { data } = await q;
  const owners = (data ?? []) as unknown as {
    id: string; full_name: string; phone: string; email: string | null; notes: string | null; account_status: 'pending' | 'active' | 'disabled';
    units: { id: string; unit_number: string; buildings: { name: string; projects: { name_ar: string } } }[];
  }[];
  const o = d.admin.owners;

  return (
    <div>
      <PageHeader title={o.title} subtitle={`${owners.length}`} actions={isAdmin && <OwnerCreateForm />} />
      <form className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <Input name="q" defaultValue={sp.q} placeholder={`${d.common.search}: ${d.common.name} / ${d.common.phone}`} className="ps-9" />
      </form>
      <Card className="divide-y divide-sand-100">
        {!owners.length && <EmptyState icon={<Users className="h-5 w-5" />} title={d.common.noData} />}
        {owners.map((ow) => (
          <div key={ow.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{ow.full_name}</span>
                <Badge className={STATUS_TONE[ow.account_status]}>{o.accountStatus[ow.account_status]}</Badge>
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-stone-450" dir="ltr">
                <span>{ow.phone}</span>{ow.email && <span>{ow.email}</span>}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ow.units.map((u) => (
                  <Link key={u.id} href={`/admin/units/${u.id}`} className="rounded-lg bg-sand-100 px-2 py-1 text-xs hover:bg-sand-200">
                    {u.buildings?.projects?.name_ar} · {u.buildings?.name} · {u.unit_number}
                  </Link>
                ))}
                {!ow.units.length && <span className="text-xs text-amber-700">{d.errors.OWNER_NEEDS_UNIT}</span>}
              </div>
              {isAdmin && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-brand">{d.common.edit}</summary>
                  <div className="mt-3"><OwnerEditForm owner={ow} /></div>
                </details>
              )}
            </div>
            {isAdmin && (
              <div className="lg:w-72 lg:text-end">
                <OwnerAccountActions ownerId={ow.id} status={ow.account_status} />
                {ow.account_status === 'pending' && <p className="mt-1 text-[11px] text-stone-450">{o.activateHint}</p>}
              </div>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}
