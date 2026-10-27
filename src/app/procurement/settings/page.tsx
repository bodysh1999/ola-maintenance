import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getI18n, requireRole } from '@/lib/session';
import { saveProcSettings, setMember } from '@/app/actions/procurement';
import { ActionForm, SubmitButton } from '@/components/client';
import { Badge, Card, CardHeader, Field, Input, PageHeader, Select } from '@/components/ui';
import { MemberForm } from '@/components/procurement-client';

export default async function ProcurementSettings() {
  await requireRole(['admin']);
  const [{ d }, supabase] = await Promise.all([getI18n(), createClient()]);
  const p = d.proc;
  const [{ data: members }, { data: settings }, { data: people }] = await Promise.all([
    supabase.from('procurement_members').select('profile_id, role, profiles!procurement_members_profile_id_fkey(full_name, email)').order('created_at'),
    supabase.from('procurement_settings').select('quotes_required, admin_threshold').eq('id', 1).maybeSingle(),
    supabase.from('profiles').select('id, full_name, email, role').eq('is_active', true).neq('role', 'owner').order('full_name'),
  ]);
  type M = { profile_id: string; role: 'rep' | 'approver'; profiles: { full_name: string | null; email: string | null } | null };
  const list = (members ?? []) as unknown as M[];
  const taken = new Set(list.map((m) => m.profile_id));
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow={<Link href="/procurement" className="hover:underline">{p.title}</Link>} title={p.settings} />
      <div className="grid gap-6">
        <Card>
          <CardHeader title={p.members} subtitle={p.membersHint} />
          <ul className="divide-y divide-sand-100 px-5">
            {list.map((m) => (
              <li key={m.profile_id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{m.profiles?.full_name ?? m.profiles?.email}</div>
                  <Badge className={m.role === 'approver' ? 'bg-violet-50 text-violet-800 ring-violet-200' : 'bg-sky-50 text-sky-800 ring-sky-200'}>{p.memberRoles[m.role]}</Badge>
                </div>
                <ActionForm action={setMember}>
                  <input type="hidden" name="profile" value={m.profile_id} />
                  <input type="hidden" name="role" value="" />
                  <SubmitButton variant="ghost" size="sm" className="text-rose-700">{p.removeMember}</SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
          <div className="border-t border-sand-100 p-5">
            <MemberForm people={(people ?? []).filter((x) => !taken.has(x.id)).map((x) => ({ id: x.id, name: `${x.full_name ?? x.email} — ${d.roles[x.role as keyof typeof d.roles] ?? x.role}` }))} />
          </div>
        </Card>
        <Card className="p-5">
          <ActionForm action={saveProcSettings} className="grid gap-4 sm:grid-cols-2">
            <Field label={p.quotesRequired} required>
              <Select name="quotes" defaultValue={String(settings?.quotes_required ?? 3)}>
                {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </Field>
            <Field label={p.adminThreshold} hint={p.adminThresholdHint}>
              <Input name="threshold" type="number" min={1} step="1" dir="ltr" inputMode="numeric" defaultValue={settings?.admin_threshold ?? ''} />
            </Field>
            <div className="sm:col-span-2"><SubmitButton>{p.saveSettings}</SubmitButton></div>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
