import Link from 'next/link';
import { Download, FileText, ScrollText } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n, getSettings, requireRole } from '@/lib/session';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { fmt } from '@/lib/i18n';
import { AppShell } from '@/components/app-shell';
import { Badge, Card, CardHeader, PageHeader, buttonClass } from '@/components/ui';
import { ConsentToggle, DataRequestForm } from '@/components/privacy-client';

const ALL = ['admin', 'supervisor', 'technician', 'owner', 'sales', 'hr', 'employee'] as const;
const TONE: Record<string, string> = {
  open: 'bg-sky-50 text-sky-800 ring-sky-200', in_progress: 'bg-amber-50 text-amber-800 ring-amber-200',
  completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200', rejected: 'bg-rose-50 text-rose-800 ring-rose-200',
};

/** PDPL rights center: copy of data, consents, correction / deletion requests */
export default async function MyDataPage() {
  const profile = await requireRole([...ALL]);
  const [{ d, locale }, s, supabase] = await Promise.all([getI18n(), getSettings(), createClient()]);
  const p = d.privacy;
  const [{ data: consents }, { data: reqs }] = await Promise.all([
    supabase.from('my_consents').select('purpose, granted'),
    supabase.from('data_requests').select('*').eq('profile_id', profile.id).order('created_at', { ascending: false }),
  ]);
  const c = new Map((consents ?? []).map((x) => [x.purpose as string, x.granted as boolean]));

  return (
    <AppShell profile={profile}>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader title={p.myData} subtitle={p.myDataSub} />

        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand/[.06] text-brand"><FileText className="h-5 w-5" /></span>
              <div>
                <div className="font-medium">{p.exportTitle}</div>
                <div className="text-sm text-stone-450">{p.exportBody}</div>
              </div>
            </div>
            <a href="/account/data/export" className={buttonClass('primary', 'md')}><Download className="h-4 w-4" />{p.exportBtn}</a>
          </div>
        </Card>

        <Card>
          <CardHeader title={p.consentsTitle} subtitle={profile.privacy_accepted_at
            ? fmt(p.acceptedPolicy, { v: profile.privacy_accepted_version ?? '', d: fmtDate(profile.privacy_accepted_at, locale) }) : undefined} />
          <div className="divide-y divide-sand-100 px-5">
            <ConsentToggle purpose="whatsapp_updates" granted={c.get('whatsapp_updates') ?? (profile.notify_external ?? true)} />
            <ConsentToggle purpose="marketing" granted={c.get('marketing') ?? false} />
          </div>
          <div className="flex flex-wrap gap-4 border-t border-sand-100 px-5 py-3 text-sm">
            <Link href="/privacy" target="_blank" className="inline-flex items-center gap-1.5 text-brand hover:underline"><ScrollText className="h-4 w-4" />{p.policy}</Link>
            <Link href="/terms" target="_blank" className="inline-flex items-center gap-1.5 text-brand hover:underline"><ScrollText className="h-4 w-4" />{p.terms}</Link>
          </div>
        </Card>

        <Card>
          <CardHeader title={p.requestsTitle} />
          <div className="space-y-5 p-5">
            {(reqs ?? []).length === 0 ? <p className="text-sm text-stone-450">{p.noRequests}</p> : (
              <ul className="space-y-3">
                {(reqs ?? []).map((r) => (
                  <li key={r.id} className="rounded-2xl border border-sand-100 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">{p.types[r.type as keyof typeof p.types]} <span className="font-mono text-xs text-stone-450" dir="ltr">{r.ref_no}</span></div>
                      <Badge className={TONE[r.status]}>{p.statuses[r.status as keyof typeof p.statuses]}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-stone-450">{fmtDateTime(r.created_at, locale)}{['open', 'in_progress'].includes(r.status) ? ` · ${p.due}: ${fmtDate(r.due_at, locale)}` : ''}</div>
                    {r.details && <p className="mt-2 whitespace-pre-wrap text-sm">{r.details}</p>}
                    {r.response && <p className="mt-2 rounded-xl bg-sand-50 p-3 text-sm"><span className="text-stone-450">{p.response}: </span>{r.response}</p>}
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-sand-100 pt-5">
              <div className="mb-3 font-medium">{p.newRequest}</div>
              <DataRequestForm />
            </div>
            <p className="text-xs text-stone-450">{p.complaint}{s.dpo_email ? ` · ${s.dpo_email}` : ''}</p>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
