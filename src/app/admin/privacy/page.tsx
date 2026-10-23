import { AlertTriangle, ClipboardList, FileClock, History, ScrollText, Settings2, UserX } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n, getSettings, requireRole } from '@/lib/session';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { breachPlan, processingRecord } from '@/lib/legal';
import { Badge, Card, CardHeader, PageHeader } from '@/components/ui';
import { EraseVisitorForm, HandleRequestForm, PrivacySettingsForm } from '@/components/privacy-client';

const TONE: Record<string, string> = {
  open: 'bg-sky-50 text-sky-800 ring-sky-200', in_progress: 'bg-amber-50 text-amber-800 ring-amber-200',
  completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200', rejected: 'bg-rose-50 text-rose-800 ring-rose-200',
};

/** Admin: PDPL requests, erase visitors, record of processing, breach plan, audit log, privacy settings */
export default async function PrivacyConsole({ searchParams }: { searchParams: Promise<{ table?: string }> }) {
  await requireRole(['admin']);
  const [{ d, locale }, s, supabase, sp] = await Promise.all([getI18n(), getSettings(), createClient(), searchParams]);
  const p = d.privacy;
  let auditQ = supabase.from('audit_log').select('*').order('at', { ascending: false }).limit(150);
  if (sp.table) auditQ = auditQ.eq('table_name', sp.table);
  const [{ data: reqs }, { data: audit }] = await Promise.all([
    supabase.from('data_requests').select('*, profiles!data_requests_profile_id_fkey(full_name, email, role)').order('created_at', { ascending: false }).limit(100),
    auditQ,
  ]);
  const actorIds = [...new Set((audit ?? []).map((a) => a.actor).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length ? await supabase.from('profiles').select('id, full_name').in('id', actorIds) : { data: [] };
  const actorName = new Map((actors ?? []).map((a) => [a.id, a.full_name]));
  const now = Date.now();
  const open = (reqs ?? []).filter((r) => ['open', 'in_progress'].includes(r.status));
  const closed = (reqs ?? []).filter((r) => !['open', 'in_progress'].includes(r.status));
  const tables = ['profiles', 'owners', 'units', 'warranties', 'unit_documents', 'employees', 'employee_salaries', 'employee_private', 'company_settings', 'public_subject'];

  return (
    <div className="space-y-6">
      <PageHeader title={p.console} subtitle={p.consoleSub} />

      {/* Data-subject requests */}
      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-brand" />{p.openRequests} ({open.length})</span>} />
        <div className="divide-y divide-sand-100">
          {!open.length && <p className="px-5 py-6 text-sm text-stone-450">{p.noRequests}</p>}
          {open.map((r) => {
            const u = r.profiles as { full_name: string; email: string | null; role: string } | null;
            const late = Date.parse(r.due_at) < now;
            return (
              <div key={r.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{p.types[r.type as keyof typeof p.types]} <span className="font-mono text-xs text-stone-450" dir="ltr">{r.ref_no}</span></div>
                  <div className="flex items-center gap-2">
                    {late && <Badge className="bg-rose-50 text-rose-800 ring-rose-200">{p.overdue}</Badge>}
                    <Badge className={TONE[r.status]}>{p.statuses[r.status as keyof typeof p.statuses]}</Badge>
                  </div>
                </div>
                <div className="mt-1 text-xs text-stone-450">
                  {p.subject}: {u?.full_name ?? '—'} {u?.email ? <span dir="ltr">({u.email})</span> : null} · {fmtDateTime(r.created_at, locale)} · {p.due}: {fmtDate(r.due_at, locale)}
                </div>
                {r.details && <p className="mt-2 whitespace-pre-wrap rounded-xl bg-sand-50 p-3 text-sm">{r.details}</p>}
                <HandleRequestForm id={r.id} />
              </div>
            );
          })}
        </div>
        {closed.length > 0 && (
          <details className="border-t border-sand-100 px-5 py-3 text-sm">
            <summary className="cursor-pointer text-stone-450">{p.statuses.completed} / {p.statuses.rejected} ({closed.length})</summary>
            <ul className="mt-3 space-y-2">
              {closed.map((r) => (
                <li key={r.id} className="flex flex-wrap justify-between gap-2 text-xs">
                  <span>{p.types[r.type as keyof typeof p.types]} · <span dir="ltr">{r.ref_no}</span> · {(r.profiles as { full_name: string } | null)?.full_name}</span>
                  <span className="text-stone-450">{p.statuses[r.status as keyof typeof p.statuses]} · {fmtDate(r.handled_at, locale)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><UserX className="h-4 w-4 text-brand" />{p.eraseTitle}</span>} subtitle={p.eraseBody} />
          <div className="p-5"><EraseVisitorForm /></div>
        </Card>
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-brand" />{p.settingsTitle}</span>}
            subtitle={`${p.version} ${s.privacy_version ?? '1.0'} · ${p.updatedOn}: ${fmtDate(s.privacy_updated_on ?? null, locale)}`} />
          <div className="p-5">
            <PrivacySettingsForm s={{
              dpo_name: s.dpo_name ?? null, dpo_email: s.dpo_email ?? null, region: s.data_hosting_region ?? null,
              cv: s.retention_cv_months ?? 24, leads: s.retention_leads_months ?? 24, notif: s.retention_notif_days ?? 365, mfa: !!s.require_staff_mfa,
            }} />
          </div>
        </Card>
      </div>

      {/* Record of processing activities */}
      <Card className="overflow-hidden">
        <CardHeader title={<span className="flex items-center gap-2"><ScrollText className="h-4 w-4 text-brand" />{p.ropaTitle}</span>} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-sand-50 text-xs text-stone-450">
              <tr>{Object.values(p.ropaCols).map((h) => <th key={h} className="px-4 py-2.5 text-start font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {processingRecord(locale, s).map((row) => (
                <tr key={row[0]}>{row.map((c, i) => <td key={i} className={i === 0 ? 'px-4 py-3 font-medium' : 'px-4 py-3 text-ink/80'}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Breach plan */}
      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-rose-600" />{p.breachTitle}</span>} />
        <ol className="list-decimal space-y-2 py-5 pe-5 ps-10 text-sm leading-relaxed marker:font-semibold marker:text-brand">
          {breachPlan(locale).map((x) => <li key={x}>{x}</li>)}
        </ol>
      </Card>

      {/* Audit log */}
      <Card className="overflow-hidden">
        <CardHeader title={<span className="flex items-center gap-2"><History className="h-4 w-4 text-brand" />{p.auditTitle}</span>}
          action={
            <form className="flex items-center gap-2">
              <select name="table" defaultValue={sp.table ?? ''} className="h-9 rounded-lg border border-sand-200 bg-white px-2 text-xs">
                <option value="">—</option>
                {tables.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <button className="h-9 rounded-lg border border-sand-200 px-3 text-xs"><FileClock className="h-3.5 w-3.5" /></button>
            </form>
          } />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead className="bg-sand-50 text-stone-450">
              <tr>{Object.values(p.auditCols).map((h) => <th key={h} className="px-4 py-2.5 text-start font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {!(audit ?? []).length && <tr><td colSpan={5} className="px-4 py-6 text-stone-450">{p.auditEmpty}</td></tr>}
              {(audit ?? []).map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap px-4 py-2.5">{fmtDateTime(a.at, locale)}</td>
                  <td className="px-4 py-2.5">{a.actor ? actorName.get(a.actor) ?? '—' : (locale === 'ar' ? 'النظام' : 'System')}{a.actor_role ? <span className="text-stone-450"> · {a.actor_role}</span> : null}</td>
                  <td className="px-4 py-2.5 font-mono" dir="ltr">{a.table_name}</td>
                  <td className="px-4 py-2.5">{a.action}</td>
                  <td className="max-w-[340px] truncate px-4 py-2.5 font-mono text-stone-450" dir="ltr" title={JSON.stringify(a.new_values ?? a.old_values ?? a.changed)}>{(a.changed ?? []).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
