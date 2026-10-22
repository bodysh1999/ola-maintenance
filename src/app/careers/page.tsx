import type { Metadata } from 'next';
import { Briefcase, ChevronDown, GraduationCap, MapPin, Sparkles, TrendingUp, Users } from 'lucide-react';
import { getOpenings } from '@/lib/public-data';
import { ApplicationForm, ApplyButton } from '@/components/site-forms';
import { DEEP, getSiteChrome, PageHero, SiteFrame } from '@/components/site-frame';

export async function generateMetadata(): Promise<Metadata> {
  const c = await getSiteChrome();
  return { title: c.pg.careers.title, description: c.pg.careers.body };
}

export default async function CareersPage() {
  const [c, openings] = await Promise.all([getSiteChrome(), getOpenings()]);
  const { pg, t } = c;
  const cr = pg.careers;
  const jobs = openings.filter((o) => o.employment !== 'training');
  const trainings = openings.filter((o) => o.employment === 'training');
  const whyIcons = [Sparkles, Users, TrendingUp];

  return (
    <SiteFrame c={c}>
      <PageHero title={cr.title} body={cr.body} crumbs={[{ href: '/', label: t.nav.home }, { href: '/careers', label: t.nav.careers }]}>
        <div className="flex flex-wrap gap-3">
          <a href="#openings" className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-white transition hover:bg-accent/90"><Briefcase className="h-4 w-4" />{cr.openings}</a>
          <a href="#training" className="inline-flex h-12 items-center gap-2 rounded-full border border-white/30 px-6 text-sm font-medium transition hover:bg-white/10"><GraduationCap className="h-4 w-4" />{cr.training}</a>
        </div>
      </PageHero>

      {/* why */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <h2 className="font-display text-3xl font-bold text-brand sm:text-4xl">{cr.why}</h2>
          <ul className="mt-10 grid gap-6 md:grid-cols-3">
            {cr.whyItems.map(([title, body], i) => {
              const Icon = whyIcons[i];
              return (
                <li key={title} className="rounded-[28px] border border-sand-200 bg-white p-8">
                  <Icon className="h-8 w-8 text-accent" strokeWidth={1.5} />
                  <h3 className="mt-5 text-xl font-semibold">{title}</h3>
                  <p className="mt-2 leading-relaxed text-ink/65">{body}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* openings */}
      <section id="openings" className="scroll-mt-24 bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <h2 className="font-display text-4xl font-bold text-brand">{cr.openings}</h2>
          {jobs.length === 0 ? (
            <p className="mt-8 rounded-2xl border border-dashed border-sand-300 bg-sand-50 p-8 text-ink/70">{cr.noOpenings}</p>
          ) : (
            <ul className="mt-10 divide-y divide-sand-200 border-y border-sand-200">
              {jobs.map((o) => (
                <li key={o.id}>
                  <details className="group py-6">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-6 gap-y-2 [&::-webkit-details-marker]:hidden">
                      <span className="font-display text-2xl font-bold text-ink">{o.title}</span>
                      <span className="flex flex-wrap items-center gap-2 text-sm text-stone-450">
                        {o.department && <span className="rounded-full bg-sand-100 px-3 py-1">{o.department}</span>}
                        <span className="rounded-full bg-sand-100 px-3 py-1">{cr.employment[o.employment]}</span>
                        <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{o.location}</span>
                      </span>
                      <span className="ms-auto inline-flex items-center gap-1 text-sm font-medium text-brand">{cr.apply}<ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></span>
                    </summary>
                    <div className="mt-5 grid gap-6 md:grid-cols-[1.4fr_1fr]">
                      <div className="space-y-4 leading-loose text-ink/75">
                        {o.description && <p className="whitespace-pre-line">{o.description}</p>}
                        {o.requirements && (
                          <div>
                            <div className="text-sm font-semibold text-ink">{cr.requirements}</div>
                            <ul className="mt-2 list-inside list-disc space-y-1 text-[15px]">{o.requirements.split(/\s*[·\n]\s*/).filter(Boolean).map((r) => <li key={r}>{r}</li>)}</ul>
                          </div>
                        )}
                      </div>
                      <div className="md:text-end">
                        <ApplyButton kind="job" opening={o.id} className="inline-flex h-12 items-center rounded-full bg-brand px-6 text-sm font-semibold text-white transition hover:bg-brand/90">{cr.apply}</ApplyButton>
                      </div>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* training */}
      <section id="training" className={`relative isolate scroll-mt-24 overflow-hidden ${DEEP} py-20 text-white sm:py-24`}>
        <div className="texture-lines absolute inset-0 -z-10 opacity-40" />
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <GraduationCap className="h-10 w-10 text-accent" strokeWidth={1.5} />
            <h2 className="mt-5 font-display text-4xl font-bold">{cr.training}</h2>
            <p className="mt-4 max-w-xl text-lg leading-loose text-white/70">{cr.trainingBody}</p>
            {trainings.length > 0 && (
              <ul className="mt-6 flex flex-wrap gap-2">
                {trainings.map((o) => <li key={o.id} className="rounded-full border border-white/20 px-4 py-1.5 text-sm text-white/80">{o.title}</li>)}
              </ul>
            )}
          </div>
          <div className="lg:text-end">
            <ApplyButton kind="training" className="inline-flex h-14 items-center gap-2 rounded-full bg-accent px-8 font-semibold text-white transition hover:bg-accent/90">{cr.trainingCta}</ApplyButton>
          </div>
        </div>
      </section>

      {/* application */}
      <section id="apply" className="scroll-mt-24 py-20 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
          <div>
            <h2 className="font-display text-4xl font-bold text-brand">{cr.formJob} / {cr.formTraining}</h2>
            <p className="mt-4 max-w-md text-lg leading-loose text-ink/70">{cr.body}</p>
          </div>
          <div className="rounded-[28px] border border-sand-200 bg-white p-6 shadow-card sm:p-8">
            <ApplicationForm openings={openings} pg={pg} />
          </div>
        </div>
      </section>
    </SiteFrame>
  );
}
