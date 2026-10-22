import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Download, Mail, MessageCircle, Phone } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { APP_TONE } from '@/lib/sales-hr';
import { Badge, Card, CardHeader, KeyValue, PageHeader } from '@/components/ui';
import { ApplicationUpdateForm } from '../forms';

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { d, locale }, supabase] = await Promise.all([params, getI18n(), createClient()]);
  const { data: a } = await supabase.from('job_applications').select('*, job_openings(title, department)').eq('id', id).maybeSingle();
  if (!a) notFound();
  const h = d.hr;
  // short-lived private link — the storage policy only lets HR / admin read CVs
  const cvUrl = a.cv_path ? (await supabase.storage.from('cvs').createSignedUrl(a.cv_path, 600, { download: `${a.ref_no}-${a.full_name}.${a.cv_path.split('.').pop()}` })).data?.signedUrl : null;
  const opening = a.job_openings as { title: string; department: string | null } | null;
  const intl = a.phone.replace(/^0/, '966').replace(/^\+/, '');

  return (
    <div className="space-y-6">
      <Link href="/hr" className="inline-flex items-center gap-1 text-sm text-stone-450 hover:text-ink"><ChevronRight className="h-4 w-4 ltr:rotate-180" />{h.title}</Link>
      <PageHeader eyebrow={<span dir="ltr">{a.ref_no}</span>} title={a.full_name}
        subtitle={`${h.kind[a.kind as 'job' | 'training']} · ${opening?.title ?? h.general} · ${fmtDateTime(a.created_at, locale)}`}
        actions={<Badge className={APP_TONE[a.status]}>{h.status[a.status as keyof typeof h.status]}</Badge>} />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title={h.applicant} />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <KeyValue label={d.common.phone}><span dir="ltr">{a.phone}</span></KeyValue>
              <KeyValue label={d.common.email}><span dir="ltr">{a.email}</span></KeyValue>
              <KeyValue label={d.sales.city}>{a.city ?? '—'}</KeyValue>
              <KeyValue label={h.education}>{a.education ?? '—'}</KeyValue>
              <KeyValue label={h.major}>{a.major ?? '—'}</KeyValue>
              <KeyValue label={h.university}>{a.university ?? '—'}</KeyValue>
              {a.kind === 'job'
                ? <KeyValue label={h.experience}>{a.experience_years ?? '—'}</KeyValue>
                : <KeyValue label={h.trainingPeriod}>{a.training_from ? `${fmtDate(a.training_from, locale)} → ${fmtDate(a.training_to, locale)}` : '—'}</KeyValue>}
              <KeyValue label={h.linkedin}>{a.linkedin_url ? <a href={a.linkedin_url} target="_blank" rel="noreferrer" className="text-brand hover:underline" dir="ltr">LinkedIn</a> : '—'}</KeyValue>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-sand-100 p-5">
              {cvUrl ? (
                <a href={cvUrl} className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-white"><Download className="h-4 w-4" />{h.downloadCv}</a>
              ) : <span className="inline-flex h-10 items-center text-sm text-stone-450">{h.noCv}</span>}
              <a href={`tel:${a.phone}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-sand-300 bg-white px-4 text-sm font-medium"><Phone className="h-4 w-4" />{d.sales.call}</a>
              <a href={`https://wa.me/${intl}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl border border-sand-300 bg-white px-4 text-sm font-medium"><MessageCircle className="h-4 w-4" />{d.sales.whatsapp}</a>
              <a href={`mailto:${a.email}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-sand-300 bg-white px-4 text-sm font-medium"><Mail className="h-4 w-4" />{d.common.email}</a>
            </div>
          </Card>
          {a.cover_note && (
            <Card><CardHeader title={h.note} /><p className="whitespace-pre-line p-5 text-sm leading-relaxed">{a.cover_note}</p></Card>
          )}
        </div>
        <Card className="h-fit p-5">
          <h2 className="mb-4 font-semibold">{h.update}</h2>
          <ApplicationUpdateForm app={a} />
        </Card>
      </div>
    </div>
  );
}
