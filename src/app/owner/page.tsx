import Link from 'next/link';
import { AlertTriangle, Building2, CalendarCheck2, ClipboardList, FolderOpen, Phone, Plus, ShieldCheck } from 'lucide-react';
import { fmt } from '@/lib/i18n';
import { NotifyToggle } from '@/components/portal-client';
import { createClient } from '@/lib/supabase/server';
import { getI18n, getSettings, requireRole } from '@/lib/session';
import { fmtDate, todayRiyadh } from '@/lib/format';
import type { RequestOverview } from '@/lib/types';
import { Card, EmptyState, LinkButton } from '@/components/ui';
import { RequestCard } from '@/components/request-card';
import { ContactButtons, SocialLinks } from '@/components/contact-links';

type UnitRow = {
  id: string; unit_number: string; floor: number; unit_type: string; image_url: string | null; handover_date: string | null;
  buildings: { name: string; projects: { name_ar: string; name_en: string | null; image_url: string | null; city: string; district: string | null } };
  warranties: { id: string; title: string; end_date: string; start_date: string }[];
};

export default async function OwnerHome() {
  const profile = await requireRole(['owner']);
  const [{ d, locale }, s, supabase] = await Promise.all([getI18n(), getSettings(), createClient()]);

  const [{ data: units }, { data: requests }, { data: me }] = await Promise.all([
    supabase.from('units')
      .select('id, unit_number, floor, unit_type, image_url, handover_date, buildings(name, projects(name_ar, name_en, image_url, city, district)), warranties(id, title, start_date, end_date)')
      .order('created_at'),
    supabase.from('request_overview').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('profiles').select('notify_external').eq('id', profile.id).maybeSingle(),
  ]);
  const list = (units ?? []) as unknown as UnitRow[];
  const reqs = (requests ?? []) as RequestOverview[];
  const current = reqs.filter((r) => !['completed', 'rejected'].includes(r.status));
  const previous = reqs.filter((r) => ['completed', 'rejected'].includes(r.status));
  const today = todayRiyadh();
  const firstName = profile.full_name.split(' ')[0];
  const soon = list.flatMap((u) => u.warranties).filter((w) => w.end_date >= today && w.end_date <= todayRiyadh(30));

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="texture-lines relative overflow-hidden rounded-[28px] bg-brand p-6 text-white sm:p-9">
        <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-white/65">{d.owner.hello}</p>
            <h1 className="mt-1 font-display text-3xl font-bold">{firstName}</h1>
            <p className="mt-2 max-w-md text-sm text-white/70">{d.owner.requestCtaSub}</p>
          </div>
          <LinkButton href="/owner/requests/new" variant="accent" size="lg" className="h-14 rounded-2xl px-7 text-base shadow-lift">
            <Plus className="h-5 w-5" /> {d.owner.requestCta}
          </LinkButton>
        </div>
        <div className="pointer-events-none absolute -bottom-24 end-8 h-64 w-44 rounded-arch border border-accent/30" />
        <div className="pointer-events-none absolute -bottom-28 end-24 h-64 w-44 rounded-arch border border-white/10" />
      </section>

      {soon.length > 0 && (
        <Link href="/owner/warranties" className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100/60">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="flex-1 font-medium">{fmt(d.portal.expiringAlert, { n: soon.length })}</span>
          <span className="text-xs underline">{d.portal.warrantyCenter}</span>
        </Link>
      )}

      {/* Units */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">{d.owner.yourUnits}</h2>
        {!list.length ? (
          <Card><EmptyState icon={<Building2 className="h-5 w-5" />} title={d.owner.noUnits} /></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {list.map((u) => {
              const p = u.buildings?.projects;
              const active = u.warranties.filter((w) => w.start_date <= today && w.end_date >= today);
              const expired = u.warranties.filter((w) => w.end_date < today);
              const nextExpiry = active.map((w) => w.end_date).sort()[0];
              const img = u.image_url || p?.image_url;
              return (
                <Card key={u.id} className="overflow-hidden">
                  <div className="relative h-36 bg-gradient-to-br from-brand to-brand/70">
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
                    <div className="absolute bottom-3 start-4 end-4 text-white">
                      <div className="text-xs text-white/75">{p ? `${p.city}${p.district ? ` · ${p.district}` : ''}` : ''}</div>
                      <div className="text-lg font-semibold">{locale === 'en' && p?.name_en ? p.name_en : p?.name_ar}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-sand-100 border-b border-sand-100 text-center rtl:divide-x-reverse">
                    <div className="px-2 py-3"><div className="text-[11px] text-stone-450">{d.owner.building}</div><div className="font-semibold">{u.buildings?.name}</div></div>
                    <div className="px-2 py-3"><div className="text-[11px] text-stone-450">{d.owner.unit}</div><div className="font-semibold">{u.unit_number}</div></div>
                    <div className="px-2 py-3"><div className="text-[11px] text-stone-450">{d.owner.floor}</div><div className="font-semibold">{u.floor}</div></div>
                  </div>
                  <div className="space-y-2.5 p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-stone-450"><CalendarCheck2 className="h-4 w-4" />{d.owner.handover}</span>
                      <span className="font-medium">{fmtDate(u.handover_date, locale)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-stone-450"><ShieldCheck className="h-4 w-4" />{d.owner.warrantyStatus}</span>
                      <span className="text-end font-medium">
                        {active.length > 0 ? (
                          <span className="text-emerald-700">{active.length} {d.owner.warrantiesActive}</span>
                        ) : (
                          <span className="text-stone-450">{d.warranty.unknown}</span>
                        )}
                        {expired.length > 0 && <span className="ms-2 text-xs text-stone-450">· {expired.length} {d.owner.warrantiesExpired}</span>}
                      </span>
                    </div>
                    {nextExpiry && <p className="text-xs text-stone-450">{d.owner.validUntil} {fmtDate(nextExpiry, locale)}</p>}
                    <Link href={`/owner/units/${u.id}`} className="flex items-center justify-center gap-2 rounded-xl bg-brand/[.06] px-3 py-2.5 text-sm font-medium text-brand transition hover:bg-brand/10">
                      <FolderOpen className="h-4 w-4" />{d.portal.viewUnit}
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Requests */}
      <section className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-semibold">{d.owner.current} <span className="text-sm font-normal text-stone-450">({current.length})</span></h2>
          {current.length ? (
            <div className="space-y-3">{current.map((r) => <RequestCard key={r.id} r={r} d={d} locale={locale} href={`/owner/requests/${r.id}`} />)}</div>
          ) : (
            <Card><EmptyState icon={<ClipboardList className="h-5 w-5" />} title={d.owner.noRequests} /></Card>
          )}
        </div>
        <div>
          <h2 className="mb-3 text-lg font-semibold">{d.owner.previous} <span className="text-sm font-normal text-stone-450">({previous.length})</span></h2>
          {previous.length ? (
            <div className="space-y-3">{previous.map((r) => <RequestCard key={r.id} r={r} d={d} locale={locale} href={`/owner/requests/${r.id}`} />)}</div>
          ) : (
            <Card><EmptyState icon={<ClipboardList className="h-5 w-5" />} title={d.owner.noRequests} /></Card>
          )}
        </div>
      </section>

      {s.notify_channels.length > 0 && (
        <Card className="p-5"><NotifyToggle on={me?.notify_external ?? true} /></Card>
      )}

      {(s.support_phone || s.support_email || s.whatsapp) && (
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-accent/15 text-accent"><Phone className="h-5 w-5" /></div>
            <div>
              <div className="font-medium">{d.owner.support}</div>
              <div className="text-sm text-stone-450" dir="ltr">{[s.support_phone, s.support_email].filter(Boolean).join(' · ')}</div>
            </div>
          </div>
          <ContactButtons s={s} d={d} className="mt-4" />
          <SocialLinks s={s} className="mt-4 border-t border-sand-100 pt-3" />
        </Card>
      )}
    </div>
  );
}
