import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CalendarCheck, Clock, MapPin, Navigation } from 'lucide-react';
import { getI18n } from '@/lib/session';
import { getProject, mapEmbed, mapLink } from '@/lib/public-data';
import { ProjectSales } from '@/components/site-forms';
import { getSiteChrome, PageHero, SiteFrame } from '@/components/site-frame';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProject((await params).id);
  if (!p) return {};
  return { title: p.name_ar, description: p.description ?? undefined, openGraph: p.image_url ? { images: [p.image_url] } : undefined };
}

export default async function PublicProjectPage({ params }: Props) {
  const [{ id }, c, { d }] = await Promise.all([params, getSiteChrome(), getI18n()]);
  const p = await getProject(id);
  if (!p) notFound();
  const { pg, t, locale } = c;
  const pp = pg.project;
  const name = locale === 'en' && p.name_en ? p.name_en : p.name_ar;
  const embed = mapEmbed(p.map_query);
  const link = mapLink(p);
  const prices = p.units.filter((u) => u.sale_status === 'available' && u.price).map((u) => u.price!);
  const from = prices.length ? Math.min(...prices) : null;
  const available = p.units.filter((u) => u.sale_status === 'available').length;
  const place = [p.district, p.city].filter(Boolean).join('، ');

  return (
    <SiteFrame c={c}>
      <PageHero
        eyebrow={t.projects.stage[p.sales_status]}
        title={name}
        body={place || undefined}
        crumbs={[{ href: '/', label: t.nav.home }, { href: '/projects', label: t.nav.projects }]}
      >
        <div className="flex flex-wrap gap-3">
          {p.sales_status !== 'sold' && available > 0 && (
            <a href="#units" className="inline-flex h-12 items-center rounded-full bg-accent px-6 text-sm font-semibold text-white transition hover:bg-accent/90">{pp.book}</a>
          )}
          {p.sales_status !== 'sold' && (
            <a href="#book" className="inline-flex h-12 items-center gap-2 rounded-full border border-white/30 px-6 text-sm font-medium transition hover:bg-white/10"><CalendarCheck className="h-4 w-4" />{pp.visitCta}</a>
          )}
        </div>
      </PageHero>

      {/* overview */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
          <div className="mx-auto w-full max-w-md lg:max-w-none">
            <div className="relative">
              <div className="absolute -inset-3 rounded-arch border border-accent/40" />
              <div className="relative aspect-[4/5] overflow-hidden rounded-arch bg-brand shadow-lift">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.image_url && <img src={p.image_url} alt={name} className="h-full w-full object-cover" />}
              </div>
            </div>
          </div>
          <div className="lg:pt-6">
            <h2 className="font-display text-4xl font-bold text-brand">{pp.overview}</h2>
            <p className="mt-6 whitespace-pre-line text-lg leading-[2] text-ink/75">{p.description || (p.sales_status === 'sold' ? pp.soldOut : t.featured.body)}</p>
            <dl className="mt-10 flex flex-wrap gap-px overflow-hidden rounded-3xl border border-sand-200 bg-sand-200 [&>div]:min-w-[45%] [&>div]:flex-1 sm:[&>div]:min-w-[30%]">
              <div className="bg-white p-5"><dt className="text-xs text-stone-450">{pp.stage}</dt><dd className="mt-1 font-semibold">{t.projects.stage[p.sales_status]}</dd></div>
              {from && <div className="bg-white p-5"><dt className="text-xs text-stone-450">{pp.from}</dt><dd className="mt-1 font-display text-lg font-bold text-brand">{Number(from).toLocaleString('en-US')} <span className="text-xs font-normal text-stone-450">{pp.sar}</span></dd></div>}
              {available > 0 && <div className="bg-white p-5"><dt className="text-xs text-stone-450">{pp.units}</dt><dd className="mt-1 font-semibold">{available}</dd></div>}
              {p.delivery_year && <div className="bg-white p-5"><dt className="text-xs text-stone-450">{pp.delivery}</dt><dd className="mt-1 font-semibold">{p.delivery_year}</dd></div>}
              {place && <div className="bg-white p-5"><dt className="text-xs text-stone-450">{pp.location}</dt><dd className="mt-1 font-semibold">{place}</dd></div>}
            </dl>
          </div>
        </div>
      </section>

      <ProjectSales projectId={p.id} units={p.units} pg={pg} locale={locale} unitTypes={d.unitType} stage={p.sales_status} />

      {/* location */}
      {(embed || p.address_text || p.visit_hours) && (
        <section className="bg-white py-20 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[1fr_1.6fr] lg:gap-14">
            <div>
              <h2 className="font-display text-4xl font-bold text-brand">{pp.location}</h2>
              <ul className="mt-8 space-y-6">
                {p.address_text && (
                  <li className="flex gap-4"><MapPin className="mt-1 h-5 w-5 shrink-0 text-accent" /><div><div className="text-sm text-stone-450">{pp.address}</div><div className="mt-1 text-lg">{p.address_text}</div></div></li>
                )}
                {p.visit_hours && (
                  <li className="flex gap-4"><Clock className="mt-1 h-5 w-5 shrink-0 text-accent" /><div><div className="text-sm text-stone-450">{pp.visitHours}</div><div className="mt-1 text-lg">{p.visit_hours}</div></div></li>
                )}
              </ul>
              {link && (
                <a href={link} target="_blank" rel="noreferrer" className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-brand px-6 text-sm font-semibold text-white transition hover:bg-brand/90">
                  <Navigation className="h-4 w-4" />{pp.openMaps}
                </a>
              )}
            </div>
            {embed && (
              <div className="overflow-hidden rounded-[28px] border border-sand-200 bg-sand-100">
                <iframe src={embed} title={`${pp.location} — ${name}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-[380px] w-full sm:h-[440px]" />
              </div>
            )}
          </div>
        </section>
      )}
    </SiteFrame>
  );
}
