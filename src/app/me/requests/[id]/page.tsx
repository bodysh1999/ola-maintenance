import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2, ChevronRight, Circle, FileText, Printer, XCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile, getI18n } from '@/lib/session';
import { getMyEmployee } from '@/lib/me';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { HR_STATUS_TONE, sar } from '@/lib/hr';
import { Badge, Card, CardHeader, KeyValue, LinkButton, PageHeader, cx } from '@/components/ui';
import { CancelRequestButton, DecisionForm } from '@/components/hr-client';
import { requestSummary, TYPE_ICONS, type HrRequestRow } from '@/components/hr-parts';

type Step = { step: number; approver_kind: 'manager' | 'hr'; decision: string; comment: string | null; decided_at: string | null; approver: { full_name: string; job_title: string } | null };

export default async function HrRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { d, locale }, supabase, me, profile] = await Promise.all([params, getI18n(), createClient(), getMyEmployee(), getCurrentProfile()]);
  const { data: r } = await supabase.from('hr_requests')
    .select('*, leave_types(name_ar, name_en), employee:employees!hr_requests_employee_id_fkey(full_name, job_title, emp_no), hr_request_steps(step, approver_kind, decision, comment, decided_at, approver:employees!hr_request_steps_approver_employee_id_fkey(full_name, job_title))')
    .eq('id', id).maybeSingle();
  if (!r) notFound();
  const steps = ((r.hr_request_steps ?? []) as Step[]).sort((a, b) => a.step - b.step);
  const cur = steps.find((s) => s.step === r.current_step);
  const mine = me?.id === r.employee_id;
  // the database decides (manager, their active delegate, HR, admin)
  const myTurn = r.status === 'pending' && !!cur && !!(await supabase.rpc('can_decide_hr_request', { p_id: id })).data;
  const attachmentUrl = r.attachment_path ? (await supabase.storage.from('hr-docs').createSignedUrl(r.attachment_path, 600)).data?.signedUrl : null;
  const m = d.me;
  const Icon = TYPE_ICONS[r.type as keyof typeof TYPE_ICONS];
  const emp = r.employee as { full_name: string; job_title: string; emp_no: string } | null;
  const lname = r.leave_types ? (locale === 'en' ? r.leave_types.name_en : r.leave_types.name_ar) : null;
  const letter = r.status === 'approved' && ['salary_certificate', 'experience_letter'].includes(r.type);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href={mine ? '/me/requests' : '/me/approvals'} className="inline-flex items-center gap-1 text-sm text-stone-450 hover:text-ink"><ChevronRight className="h-4 w-4 ltr:rotate-180" />{mine ? m.myRequests : m.approvals}</Link>
      <PageHeader eyebrow={<span dir="ltr">{r.ref_no}</span>}
        title={<span className="flex items-center gap-3"><Icon className="h-7 w-7 text-accent" />{m.types[r.type as keyof typeof m.types]}</span>}
        subtitle={fmtDateTime(r.created_at, locale)}
        actions={<Badge className={HR_STATUS_TONE[r.status]}>{m.status[r.status as keyof typeof m.status]}</Badge>} />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title={d.common.details} />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            {emp && <KeyValue label={m.detail.employee}>{emp.full_name} <span className="text-xs text-stone-450">· {emp.job_title}</span></KeyValue>}
            {lname && <KeyValue label={m.form.leaveType}>{lname}</KeyValue>}
            {r.start_date && <KeyValue label={m.form.from}>{fmtDate(r.start_date, locale)}</KeyValue>}
            {r.end_date && <KeyValue label={m.form.to}>{fmtDate(r.end_date, locale)}</KeyValue>}
            {r.days != null && <KeyValue label={m.form.days}>{Number(r.days)}</KeyValue>}
            {r.work_date && <KeyValue label={m.form.workDate}>{fmtDate(r.work_date, locale)}</KeyValue>}
            {r.time_in && <KeyValue label={m.form.timeIn}><span dir="ltr">{r.time_in.slice(0, 5)}</span></KeyValue>}
            {r.time_out && <KeyValue label={m.form.timeOut}><span dir="ltr">{r.time_out.slice(0, 5)}</span></KeyValue>}
            {r.hours != null && <KeyValue label={m.form.hours}>{Number(r.hours)}</KeyValue>}
            {r.destination && <KeyValue label={m.form.destination}>{r.destination}</KeyValue>}
            {r.amount != null && <KeyValue label={r.type === 'business_trip' ? m.form.perDiem : m.form.amount}>{sar(r.amount)} {d.common.sar}</KeyValue>}
            {r.addressed_to && <KeyValue label={m.form.addressedTo}>{r.addressed_to}</KeyValue>}
            {r.lat != null && <KeyValue label={d.me.punch.title}><a className="text-brand hover:underline" dir="ltr" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${r.lat},${r.lng}`}>{Number(r.lat).toFixed(5)}, {Number(r.lng).toFixed(5)}{r.accuracy_m ? ` ±${r.accuracy_m}m` : ''}</a></KeyValue>}
          </div>
          {r.reason && <div className="border-t border-sand-100 p-5"><div className="mb-1 text-xs text-stone-450">{m.form.reason}</div><p className="whitespace-pre-line text-sm">{r.reason}</p></div>}
          {(attachmentUrl || letter || (mine && r.status === 'pending')) && (
            <div className="flex flex-wrap gap-2 border-t border-sand-100 p-5">
              {attachmentUrl && <a href={attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl border border-sand-300 bg-white px-4 text-sm"><FileText className="h-4 w-4" />{m.detail.attachment}</a>}
              {letter && <LinkButton href={`/letters/${r.id}`} target="_blank"><Printer className="h-4 w-4" />{m.detail.letter}</LinkButton>}
              {mine && r.status === 'pending' && <CancelRequestButton id={r.id} />}
            </div>
          )}
          <p className="sr-only">{requestSummary(r as HrRequestRow, d, locale, lname)}</p>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title={m.detail.timeline} />
            <ol className="space-y-4 p-5">
              {steps.map((s) => {
                const done = s.decision === 'approved'; const bad = s.decision === 'rejected';
                return (
                  <li key={s.step} className="flex gap-3">
                    {done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : bad ? <XCircle className="h-5 w-5 shrink-0 text-rose-600" /> : <Circle className={cx('h-5 w-5 shrink-0', s.step === r.current_step && r.status === 'pending' ? 'text-amber-500' : 'text-stone-300')} />}
                    <div className="min-w-0 text-sm">
                      <div className="font-medium">{s.approver_kind === 'hr' ? m.step.hr : s.approver?.full_name ?? m.step.manager}
                        {s.approver_kind === 'manager' && s.approver && <span className="text-xs font-normal text-stone-450"> · {s.approver.job_title}</span>}</div>
                      <div className="text-xs text-stone-450">{m.step[s.decision as keyof typeof m.step] ?? s.decision}{s.decided_at ? ` · ${fmtDateTime(s.decided_at, locale)}` : ''}</div>
                      {s.comment && <p className="mt-1 rounded-lg bg-sand-50 px-3 py-2 text-xs">{s.comment}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>
          {myTurn && <Card className="p-5"><DecisionForm id={r.id} /></Card>}
        </div>
      </div>
    </div>
  );
}
