import { Activity, AlertTriangle, CheckCircle2, Clock, Database, DatabaseBackup, Mail, XCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n, requireRole } from '@/lib/session';
import { fmtDateTime } from '@/lib/format';
import { Badge, Card, CardHeader, PageHeader, StatCard } from '@/components/ui';
import { ResolveButton } from './resolve-button';

type Job = { name: string; schedule: string; active: boolean; last_at: string | null; status: string | null; message: string | null };
type Health = { jobs: Job[]; outbox_pending: number; outbox_failed_24h: number; errors_24h: number; db_size: string; checked_at: string };
type Err = { fingerprint: string; source: string; message: string; path: string | null; digest: string | null; count: number; first_at: string; last_at: string; last_role: string | null; resolved_at: string | null };

/** Admin: scheduled jobs, errors reported by browsers / the server, message queue, backup status */
export default async function SystemPage() {
  await requireRole(['admin']);
  const [{ d, locale }, supabase] = await Promise.all([getI18n(), createClient()]);
  const y = d.system;
  const [{ data: h }, { data: errs }] = await Promise.all([
    supabase.rpc('system_health'),
    supabase.from('error_events').select('*').order('last_at', { ascending: false }).limit(60),
  ]);
  const health = h as Health | null;
  const open = ((errs ?? []) as Err[]).filter((e) => !e.resolved_at);
  const closed = ((errs ?? []) as Err[]).filter((e) => e.resolved_at);
  const jobName = (n: string) => (y.jobs as Record<string, string>)[n] ?? n;

  return (
    <div className="space-y-6">
      <PageHeader title={y.title} subtitle={health ? `${y.checked}: ${fmtDateTime(health.checked_at, locale)}` : undefined} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={y.errors24} value={health?.errors_24h ?? '—'} icon={<AlertTriangle className="h-5 w-5" />} tone={health?.errors_24h ? 'warn' : 'good'} />
        <StatCard label={y.outboxPending} value={health?.outbox_pending ?? '—'} icon={<Mail className="h-5 w-5" />} />
        <StatCard label={y.outboxFailed} value={health?.outbox_failed_24h ?? '—'} icon={<XCircle className="h-5 w-5" />} tone={health?.outbox_failed_24h ? 'warn' : undefined} />
        <StatCard label={y.dbSize} value={health?.db_size ?? '—'} icon={<Database className="h-5 w-5" />} />
      </div>

      <Card className="overflow-hidden">
        <CardHeader title={<span className="flex items-center gap-2"><Clock className="h-4 w-4 text-brand" />{y.scheduled}</span>} subtitle={y.scheduledSub} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-sand-50/70 text-xs text-stone-450">
              <tr>{[y.job, y.schedule, y.lastRun, d.common.status].map((t) => <th key={t} className="px-5 py-2.5 text-start font-medium">{t}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {!health?.jobs?.length && <tr><td colSpan={4} className="px-5 py-6 text-stone-450">{y.noCron}</td></tr>}
              {(health?.jobs ?? []).map((j) => (
                <tr key={j.name}>
                  <td className="px-5 py-3 font-medium">{jobName(j.name)}</td>
                  <td className="px-5 py-3 font-mono text-xs" dir="ltr">{j.schedule} UTC</td>
                  <td className="px-5 py-3 text-xs">{j.last_at ? fmtDateTime(j.last_at, locale) : <span className="text-stone-400">{y.notYet}</span>}</td>
                  <td className="px-5 py-3">
                    {!j.status ? <Badge className="bg-sand-100 text-ink/60 ring-sand-200">{y.waiting}</Badge>
                      : j.status === 'succeeded' ? <Badge className="bg-emerald-50 text-emerald-800 ring-emerald-200"><CheckCircle2 className="h-3 w-3" />{y.ok}</Badge>
                        : <span title={j.message ?? ''}><Badge className="bg-rose-50 text-rose-800 ring-rose-200"><XCircle className="h-3 w-3" />{j.status}</Badge></span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><Activity className="h-4 w-4 text-brand" />{y.errorsTitle} ({open.length})</span>} subtitle={y.errorsSub} />
        {!open.length ? <p className="flex items-center gap-2 px-5 py-6 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />{y.noErrors}</p> : (
          <ul className="divide-y divide-sand-100">
            {open.map((e) => (
              <li key={e.fingerprint} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="break-words font-mono text-xs text-rose-800" dir="ltr">{e.message}</div>
                  <div className="mt-1 text-xs text-stone-450">
                    <Badge className="me-2 bg-sand-100 text-ink/70 ring-sand-200">{e.source === 'server' ? y.server : y.browser}</Badge>
                    <span dir="ltr">{e.path}</span> · ×{e.count} · {fmtDateTime(e.last_at, locale)}{e.last_role ? ` · ${d.roles[e.last_role as keyof typeof d.roles] ?? e.last_role}` : ''}
                    {e.digest && <span className="ms-2 font-mono" dir="ltr">#{e.digest}</span>}
                  </div>
                </div>
                <ResolveButton fp={e.fingerprint} />
              </li>
            ))}
          </ul>
        )}
        {closed.length > 0 && <p className="border-t border-sand-100 px-5 py-3 text-xs text-stone-450">{y.resolvedCount}: {closed.length}</p>}
      </Card>

      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><DatabaseBackup className="h-4 w-4 text-brand" />{y.backupTitle}</span>} />
        <div className="space-y-2 p-5 text-sm leading-relaxed text-ink/80">
          {y.backupBody.map((line) => <p key={line}>{line}</p>)}
        </div>
      </Card>
    </div>
  );
}
