import type { Metadata } from 'next';
import { Building, ClipboardCheck, Compass, HardHat, LineChart, Megaphone, MessagesSquare, SearchCheck, Check } from 'lucide-react';
import { SERVICE_KEYS, type ServiceKey } from '@/lib/site-pages';
import { LeadForm } from '@/components/site-forms';
import { DEEP, getSiteChrome, PageHero, SiteFrame } from '@/components/site-frame';

export async function generateMetadata(): Promise<Metadata> {
  const c = await getSiteChrome();
  return { title: c.pg.services.title, description: c.pg.services.body };
}

const ICONS: Record<ServiceKey, typeof Compass> = {
  design_build: Compass, construction: HardHat, supervision: ClipboardCheck, consulting: MessagesSquare,
  property_management: Building, marketing: Megaphone, feasibility: LineChart, inspection: SearchCheck,
};
const MAIN: ServiceKey[] = ['design_build', 'construction', 'supervision', 'consulting'];

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const [c, sp] = await Promise.all([getSiteChrome(), searchParams]);
  const { pg, t, ar } = c;
  const sv = pg.services;
  const pre = SERVICE_KEYS.includes(sp.s as ServiceKey) ? sp.s : undefined;
  const more = SERVICE_KEYS.filter((k) => !MAIN.includes(k));

  return (
    <SiteFrame c={c}>
      <PageHero title={sv.title} body={sv.body} crumbs={[{ href: '/', label: t.nav.home }, { href: '/services', label: t.nav.services }]}>
        <a href="#request" className="inline-flex h-12 items-center rounded-full bg-accent px-6 text-sm font-semibold text-white transition hover:bg-accent/90">{sv.request}</a>
      </PageHero>

      {/* core services */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <h2 className="font-display text-4xl font-bold text-brand">{sv.main}</h2>
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {MAIN.map((k, i) => {
              const it = sv.items[k];
              const Icon = ICONS[k];
              return (
                <article key={k} id={k} className="group relative scroll-mt-28 overflow-hidden rounded-[28px] border border-sand-200 bg-white p-8 transition hover:border-brand/25 hover:shadow-lift sm:p-10">
                  <span className="pointer-events-none absolute -end-4 -top-8 font-display text-[140px] font-bold leading-none text-brand/[.05]" aria-hidden>{(ar ? '١٢٣٤' : '1234')[i]}</span>
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand text-white"><Icon className="h-7 w-7" strokeWidth={1.5} /></div>
                  <p className="mt-7 text-sm font-medium text-accent">{it.short}</p>
                  <h3 className="mt-1 font-display text-3xl font-bold text-ink">{it.title}</h3>
                  <p className="mt-4 leading-loose text-ink/70">{it.body}</p>
                  <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                    {it.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-[15px] text-ink/80"><Check className="mt-1 h-4 w-4 shrink-0 text-accent" />{b}</li>
                    ))}
                  </ul>
                  <a href={`?s=${k}#request`} className="mt-8 inline-flex h-11 items-center rounded-full border border-brand/20 px-5 text-sm font-medium text-brand transition hover:bg-brand hover:text-white">{sv.request}</a>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* more services */}
      <section className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <h2 className="font-display text-3xl font-bold text-brand sm:text-4xl">{sv.more}</h2>
          <ul className="mt-10 grid gap-px overflow-hidden rounded-[28px] border border-sand-200 bg-sand-200 sm:grid-cols-2 lg:grid-cols-4">
            {more.map((k) => {
              const it = sv.items[k];
              const Icon = ICONS[k];
              return (
                <li key={k} id={k} className="flex scroll-mt-28 flex-col bg-white p-7">
                  <Icon className="h-7 w-7 text-accent" strokeWidth={1.5} />
                  <h3 className="mt-5 text-lg font-semibold text-ink">{it.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-ink/65">{it.body}</p>
                  <a href={`?s=${k}#request`} className="mt-5 text-sm font-medium text-brand underline-offset-4 hover:underline">{sv.request}</a>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* process */}
      <section className={`${DEEP} py-20 text-white sm:py-24`}>
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">{sv.process}</h2>
          <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {sv.steps.map(([title, body], i) => (
              <li key={title} className="relative border-t border-white/15 pt-6">
                <span className="absolute -top-px start-0 h-px w-16 bg-accent" />
                <span className="font-display text-4xl font-bold text-accent">{(ar ? '١٢٣٤' : '1234')[i]}</span>
                <div className="mt-3 text-lg font-semibold">{title}</div>
                <p className="mt-1 text-sm leading-relaxed text-white/60">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* request */}
      <section id="request" className="scroll-mt-24 py-20 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <div>
            <h2 className="font-display text-4xl font-bold text-brand">{sv.formTitle}</h2>
            <p className="mt-4 max-w-md text-lg leading-loose text-ink/70">{sv.formBody}</p>
          </div>
          <div className="rounded-[28px] border border-sand-200 bg-white p-6 shadow-card sm:p-8">
            <LeadForm key={pre ?? 'none'} kind="service" f={pg.form} unitLabel={sv.choose} defaultService={pre}
              services={SERVICE_KEYS.map((k) => ({ key: k, title: sv.items[k].title }))} cta={sv.request} />
          </div>
        </div>
      </section>
    </SiteFrame>
  );
}
