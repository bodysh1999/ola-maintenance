import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Mail, MessageCircle, Phone } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { fmtDate, fmtDateTime, fmtMoney } from '@/lib/format';
import { pagesContent, type ServiceKey } from '@/lib/site-pages';
import { LEAD_TONE, SALE_TONE } from '@/lib/sales-hr';
import { waLink } from '@/lib/site-content';
import { Badge, Card, CardHeader, KeyValue, PageHeader } from '@/components/ui';
import { LeadUpdateForm, ReserveUnitButton } from '../forms';

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { d, locale }, supabase] = await Promise.all([params, getI18n(), createClient()]);
  const { data: lead } = await supabase.from('leads')
    .select('*, projects(id, name_ar, name_en), units(id, unit_number, floor, area_sqm, price, sale_status)')
    .eq('id', id).maybeSingle();
  if (!lead) notFound();
  const { data: team } = await supabase.from('profiles').select('id, full_name, role').in('role', ['admin', 'sales']).eq('is_active', true).order('full_name');
  const s = d.sales;
  const svc = pagesContent(locale).services.items;
  const intl = lead.phone.replace(/^0/, '966').replace(/^\+/, '');
  const project = lead.projects as { id: string; name_ar: string; name_en: string | null } | null;
  const unit = lead.units as { id: string; unit_number: string; floor: number; area_sqm: number | null; price: number | null; sale_status: string } | null;

  return (
    <div className="space-y-6">
      <Link href="/sales" className="inline-flex items-center gap-1 text-sm text-stone-450 hover:text-ink"><ChevronRight className="h-4 w-4 ltr:rotate-180" />{s.title}</Link>
      <PageHeader
        eyebrow={<span dir="ltr">{lead.ref_no}</span>}
        title={`${s.kind[lead.kind as keyof typeof s.kind]} — ${lead.full_name}`}
        subtitle={fmtDateTime(lead.created_at, locale)}
        actions={<Badge className={LEAD_TONE[lead.status]}>{s.status[lead.status as keyof typeof s.status]}</Badge>}
      />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title={s.customer} />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <KeyValue label={d.common.name}>{lead.full_name}</KeyValue>
              <KeyValue label={d.common.phone}><span dir="ltr">{lead.phone}</span></KeyValue>
              <KeyValue label={d.common.email}>{lead.email ? <span dir="ltr">{lead.email}</span> : '—'}</KeyValue>
              <KeyValue label={s.city}>{lead.city ?? '—'}</KeyValue>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-sand-100 p-5">
              <a href={`tel:${lead.phone}`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-white"><Phone className="h-4 w-4" />{s.call}</a>
              <a href={waLink(intl, `${lead.full_name}، ${locale === 'ar' ? 'معك فريق مبيعات علا التميز بخصوص طلبك' : 'this is the Ola sales team about your request'} ${lead.ref_no}`)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white"><MessageCircle className="h-4 w-4" />{s.whatsapp}</a>
              {lead.email && <a href={`mailto:${lead.email}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-sand-300 bg-white px-4 text-sm font-medium"><Mail className="h-4 w-4" />{d.common.email}</a>}
            </div>
          </Card>

          <Card>
            <CardHeader title={d.common.details} />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {lead.kind === 'service'
                ? <KeyValue label={s.service}>{svc[lead.service as ServiceKey]?.title ?? lead.service}</KeyValue>
                : <KeyValue label={s.project}>{project ? <Link href={`/projects/${project.id}`} target="_blank" className="text-brand hover:underline">{locale === 'en' && project.name_en ? project.name_en : project.name_ar}</Link> : '—'}</KeyValue>}
              {lead.preferred_date && <KeyValue label={s.preferred}>{fmtDate(lead.preferred_date, locale)}{lead.preferred_time ? ` · ${lead.preferred_time}` : ''}</KeyValue>}
              {unit && (
                <KeyValue label={s.unit}>
                  <span className="flex flex-wrap items-center gap-2">
                    {unit.unit_number} · {d.owner.floor} {unit.floor}{unit.area_sqm ? ` · ${unit.area_sqm} m²` : ''}
                    <Badge className={SALE_TONE[unit.sale_status]}>{d.saleStatus[unit.sale_status as keyof typeof d.saleStatus]}</Badge>
                  </span>
                </KeyValue>
              )}
              {unit?.price && <KeyValue label={s.price}>{fmtMoney(unit.price, locale)}</KeyValue>}
            </div>
            {lead.message && <div className="border-t border-sand-100 p-5"><div className="mb-1 text-xs text-stone-450">{s.message}</div><p className="whitespace-pre-line text-sm leading-relaxed">{lead.message}</p></div>}
            {lead.kind === 'booking' && unit?.sale_status === 'available' && (
              <div className="border-t border-sand-100 p-5"><ReserveUnitButton id={lead.id} /></div>
            )}
          </Card>
        </div>
        <Card className="h-fit p-5">
          <h2 className="mb-4 font-semibold">{s.update}</h2>
          <LeadUpdateForm lead={lead} team={(team ?? []).map((m) => ({ id: m.id, name: m.full_name }))} />
        </Card>
      </div>
    </div>
  );
}
