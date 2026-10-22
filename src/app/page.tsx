import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpLeft, Briefcase, CalendarCheck, ClipboardCheck, Compass, Gem, GraduationCap, Handshake, HardHat, Lightbulb, Mail, MessageCircle, MessagesSquare, Phone, ShieldCheck, Eye } from 'lucide-react';
import { getSettings } from '@/lib/session';
import { SITE_ASSETS, waLink, type SiteProject } from '@/lib/site-content';
import { getProjects } from '@/lib/public-data';
import { CountUp, Faq, PartnersMarquee, ProjectsGrid } from '@/components/site';
import { DEEP, getSiteChrome, SiteFrame } from '@/components/site-frame';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: { absolute: s.name_ar },
    description: 'عُلا التميز شركة تطوير عقارية وطنية تأسست عام ١٤٢٤هـ — مشاريع سكنية وتجارية وخدمة ما بعد البيع.',
    openGraph: { images: [SITE_ASSETS.about] },
  };
}

export default async function HomePage() {
  const [c, projects] = await Promise.all([getSiteChrome(), getProjects()]);
  const { t, pg, s, locale, ar, name, logo, loggedIn, portalHref } = c;
  const featured = projects.find((p) => p.sales_status === 'selling');
  const nm = (p: SiteProject) => (!ar && p.name_en ? p.name_en : p.name_ar);
  const valueIcons = [Gem, ShieldCheck, Lightbulb, Eye, Handshake];
  const [sProjects, sUnits, sLand, sBuilt, sPeople] = t.stats;

  return (
    <SiteFrame c={c}>

      {/* ================= HERO — the arch window ================= */}
      <section className={`relative isolate overflow-hidden ${DEEP} text-white`}>
        <div className="texture-lines absolute inset-0 -z-10 opacity-50" />
        <div className="absolute -start-40 top-0 -z-10 h-[620px] w-[620px] rounded-full bg-brand blur-3xl" />
        <div className="mx-auto grid max-w-7xl items-end gap-12 px-5 pb-16 pt-28 sm:px-8 md:pt-36 lg:min-h-[100svh] lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-20 lg:pt-44">
          <div className="lg:pb-10">
            <p className="rise-in text-sm text-accent">{t.hero.eyebrow}</p>
            <h1 className="rise-in mt-4 font-display text-[56px] font-bold leading-[1.15] sm:text-[84px] lg:text-[104px]">{t.hero.title}</h1>
            <p className="rise-in-2 mt-6 max-w-xl text-lg leading-relaxed text-white/75 sm:text-xl">{t.hero.subtitle}</p>
            <div className="rise-in-3 mt-10 flex flex-wrap gap-3">
              <a href="#projects" className="inline-flex h-14 items-center rounded-full bg-accent px-8 text-[15px] font-semibold text-white transition hover:bg-accent/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{t.hero.cta1}</a>
              <Link href={portalHref} className="inline-flex h-14 items-center rounded-full border border-white/30 px-8 text-[15px] font-medium transition hover:bg-white/10">{t.hero.cta2}</Link>
            </div>
            <dl className="rise-in-3 mt-14 grid max-w-xl grid-cols-3 divide-x divide-white/15 border-t border-white/15 pt-6 rtl:divide-x-reverse">
              {[sProjects, sUnits, sPeople].map((st) => (
                <div key={st.label} className="flex flex-col-reverse px-4 first:ps-0">
                  <dt className="text-xs text-white/55 sm:text-sm">{st.label}</dt>
                  <dd className="font-display text-2xl font-bold sm:text-3xl"><CountUp to={st.to} prefix={st.suffix} /></dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mx-auto w-full max-w-[300px] pb-6 sm:max-w-[400px] lg:max-w-none lg:pb-0">
            <div className="relative">
              <div className="absolute -inset-3 rounded-arch border border-accent/40 sm:-inset-4" />
              <div className="relative aspect-[4/5] overflow-hidden rounded-arch bg-brand shadow-lift lg:aspect-[5/6]">
                <video className="h-full w-full object-cover" autoPlay muted loop playsInline preload="metadata" poster={SITE_ASSETS.heroPoster} aria-label={name}>
                  <source src={SITE_ASSETS.heroVideo} type="video/mp4" />
                </video>
                <div className="absolute inset-0 bg-gradient-to-t from-[#2A1F3A]/50 to-transparent" />
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} alt="" className="absolute -bottom-6 start-1/2 h-16 w-auto -translate-x-1/2 drop-shadow-lg rtl:translate-x-1/2" />
            </div>
          </div>
        </div>
      </section>

      {/* ================= ABOUT ================= */}
      <section id="about" className="scroll-mt-20 py-24 sm:py-32">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[1fr_1.3fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <div className="font-display text-[88px] font-bold leading-none text-brand/10 sm:text-[120px]" aria-hidden>١٤٢٤</div>
            <h2 className="-mt-8 font-display text-4xl font-bold leading-tight text-brand sm:-mt-12 sm:text-5xl">{t.about.title}</h2>
            <p className="mt-4 text-stone-450">{t.about.badge}</p>
          </div>
          <div>
            <p className="text-xl leading-[2.1] text-ink/80 sm:text-2xl sm:leading-[2.1]">{t.about.body}</p>
            <div className="mt-12 grid gap-6 sm:grid-cols-[1.4fr_1fr]">
              <div className="aspect-[4/3] overflow-hidden rounded-[28px] bg-brand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={SITE_ASSETS.about} alt="" loading="lazy" className="h-full w-full object-cover" />
              </div>
              <dl className="flex flex-col justify-center gap-8 border-s-2 border-accent ps-6">
                {[sLand, sBuilt].map((st) => (
                  <div key={st.label} className="flex flex-col-reverse">
                    <dt className="mt-1 text-sm text-stone-450">{st.label}</dt>
                    <dd className="font-display text-3xl font-bold text-brand"><CountUp to={st.to} prefix={st.suffix} /></dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* ================= PROJECTS ================= */}
      <section id="projects" className="scroll-mt-20 bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <h2 className="font-display text-4xl font-bold text-brand sm:text-5xl">{t.projects.title}</h2>

          {featured && (
            <article className="mt-12 grid items-center gap-10 overflow-hidden rounded-[32px] bg-sand-50 p-6 sm:p-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
              <div className="mx-auto aspect-[4/5] w-full max-w-[240px] overflow-hidden rounded-arch bg-brand shadow-lift sm:max-w-sm">
                {featured.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={featured.image_url} alt={nm(featured)} className="h-full w-full object-cover" />
                )}
              </div>
              <div>
                <span className="inline-flex rounded-full bg-accent px-3.5 py-1 text-sm font-medium text-white">{t.featured.label}</span>
                <h3 className="mt-5 font-display text-5xl font-bold text-brand sm:text-6xl">{nm(featured)}</h3>
                <p className="mt-5 max-w-md text-lg leading-loose text-ink/70">{t.featured.body}</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  {featured.id && (
                    <>
                      <Link href={`/projects/${featured.id}#units`} className="inline-flex h-14 items-center gap-2 rounded-full bg-brand px-7 font-semibold text-white transition hover:bg-brand/90">
                        {t.featured.units}<ArrowUpLeft className="h-4 w-4 ltr:-scale-x-100" />
                      </Link>
                      <Link href={`/projects/${featured.id}#book`} className="inline-flex h-14 items-center gap-2 rounded-full border border-brand/25 px-7 font-medium text-brand transition hover:bg-brand/5">
                        <CalendarCheck className="h-5 w-5" />{t.featured.visit}
                      </Link>
                    </>
                  )}
                  {s.whatsapp && (
                    <a href={waLink(s.whatsapp, `${t.featured.message} ${nm(featured)}`)} target="_blank" rel="noreferrer"
                      className="inline-flex h-14 items-center gap-2 rounded-full bg-emerald-600 px-7 font-medium text-white transition hover:bg-emerald-700">
                      <MessageCircle className="h-5 w-5" />{t.featured.cta}
                    </a>
                  )}
                </div>
              </div>
            </article>
          )}

          <div className="mt-20"><ProjectsGrid projects={projects} t={t} locale={locale} whatsapp={s.whatsapp} /></div>
        </div>
      </section>

      {/* ================= SERVICES TEASER ================= */}
      <section className={`relative isolate overflow-hidden ${DEEP} py-24 text-white sm:py-28`}>
        <div className="texture-lines absolute inset-0 -z-10 opacity-40" />
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <h2 className="font-display text-4xl font-bold sm:text-5xl">{pg.teasers.servicesTitle}</h2>
              <p className="mt-5 text-lg leading-loose text-white/70">{pg.teasers.servicesBody}</p>
            </div>
            <Link href="/services" className="inline-flex h-12 items-center gap-2 rounded-full border border-white/25 px-6 text-sm font-medium transition hover:bg-white/10">
              {pg.teasers.allServices}<ArrowUpLeft className="h-4 w-4 ltr:-scale-x-100" />
            </Link>
          </div>
          <ul className="mt-14 grid gap-px overflow-hidden rounded-[28px] bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
            {(['design_build', 'construction', 'supervision', 'consulting'] as const).map((k, i) => {
              const Icon = [Compass, HardHat, ClipboardCheck, MessagesSquare][i];
              const it = pg.services.items[k];
              return (
                <li key={k} className={`group relative ${DEEP} p-8 transition hover:bg-[#33264A]`}>
                  <Icon className="h-8 w-8 text-accent" strokeWidth={1.5} />
                  <h3 className="mt-6 text-xl font-semibold">
                    <Link href={`/services#${k}`} className="after:absolute after:inset-0 after:content-['']">{it.title}</Link>
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">{it.short}</p>
                  <ArrowUpLeft className="mt-6 h-5 w-5 text-white/30 transition group-hover:text-accent ltr:-scale-x-100" />
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ================= VISION / MISSION / VALUES ================= */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-16 lg:grid-cols-2">
            {[[t.identity.vision, SITE_ASSETS.vision], [t.identity.mission, SITE_ASSETS.mission]].map(([block, img]) => {
              const b = block as { title: string; body: string };
              return (
                <article key={b.title} className="grid grid-cols-[96px_1fr] gap-6 sm:grid-cols-[132px_1fr]">
                  <div className="aspect-[3/4] overflow-hidden rounded-arch bg-brand">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img as string} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </div>
                  <div>
                    <h2 className="font-display text-3xl font-bold text-brand">{b.title}</h2>
                    <p className="mt-4 text-lg leading-loose text-ink/75">{b.body}</p>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-24">
            <h2 className="font-display text-3xl font-bold text-brand">{t.identity.values.title}</h2>
            <ul className="mt-8 grid gap-px overflow-hidden rounded-[28px] border border-sand-200 bg-sand-200 sm:grid-cols-2 lg:grid-cols-5">
              {t.identity.values.items.map(([title, body], i) => {
                const Icon = valueIcons[i] ?? Gem;
                return (
                  <li key={title} className="bg-white p-7">
                    <Icon className="h-6 w-6 text-accent" strokeWidth={1.6} />
                    <div className="mt-5 text-lg font-semibold text-ink">{title}</div>
                    <p className="mt-2 text-[15px] leading-relaxed text-ink/60">{body}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* ================= AFTER-SALES → THE SYSTEM ================= */}
      <section id="after-sales" className={`relative isolate scroll-mt-20 overflow-hidden ${DEEP} py-24 text-white sm:py-32`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={SITE_ASSETS.afterSales} alt="" loading="lazy" className="absolute inset-y-0 end-0 -z-20 hidden h-full w-1/2 object-cover opacity-30 lg:block" />
        <div className={`absolute inset-y-0 end-0 -z-10 hidden w-1/2 bg-gradient-to-l from-transparent to-[#2A1F3A] lg:block rtl:bg-gradient-to-r`} />
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-2xl">
            <h2 className="font-display text-4xl font-bold sm:text-5xl">{t.afterSales.title}</h2>
            <p className="mt-6 text-lg leading-loose text-white/80">{t.afterSales.body}</p>
            <p className="mt-4 leading-loose text-white/55">{t.afterSales.body2}</p>
          </div>

          <ol className="mt-14 grid gap-px overflow-hidden rounded-[28px] bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
            {t.afterSales.steps.map(([title, body], i) => (
              <li key={title} className={`${DEEP} p-7`}>
                <span className="font-display text-4xl font-bold text-accent">{(ar ? '١٢٣٤' : '1234')[i]}</span>
                <span className="mt-4 block text-lg font-semibold">{title}</span>
                <span className="mt-1 block text-sm leading-relaxed text-white/60">{body}</span>
              </li>
            ))}
          </ol>

          <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link href={portalHref} className="inline-flex h-14 items-center gap-2 rounded-full bg-accent px-8 text-[15px] font-semibold text-white shadow-lift transition hover:bg-accent/90">
              <ShieldCheck className="h-5 w-5" />{loggedIn ? t.nav.dashboard : t.afterSales.cta}
            </Link>
            {s.whatsapp && !loggedIn && (
              <a href={`https://wa.me/${s.whatsapp}`} target="_blank" rel="noreferrer" className="text-sm text-white/70 underline-offset-4 hover:text-white hover:underline">{t.afterSales.cta2}</a>
            )}
          </div>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section className="py-24 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[1fr_2fr] lg:gap-20">
          <h2 className="font-display text-3xl font-bold leading-snug text-brand sm:text-4xl">{t.faq.title}</h2>
          <Faq items={t.faq.items} />
        </div>
      </section>

      {/* ================= PARTNERS (marquee) ================= */}
      <section className="overflow-hidden border-y border-sand-200 bg-white py-20">
        <div className="mx-auto max-w-7xl px-5 text-center sm:px-8">
          <h2 className="font-display text-3xl font-bold text-brand sm:text-4xl">{t.partners.title}</h2>
          <p className="mt-3 text-stone-450">{t.partners.body}</p>
        </div>
        <div className="mt-12"><PartnersMarquee logos={SITE_ASSETS.partners} label={t.partners.title} /></div>
      </section>

      {/* ================= CAREERS TEASER ================= */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid items-center gap-8 overflow-hidden rounded-[32px] bg-brand p-8 text-white sm:p-12 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <h2 className="font-display text-3xl font-bold sm:text-4xl">{pg.teasers.careersTitle}</h2>
              <p className="mt-4 max-w-xl leading-loose text-white/75">{pg.teasers.careersBody}</p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Link href="/careers" className="inline-flex h-14 items-center gap-2 rounded-full bg-accent px-7 font-semibold text-white transition hover:bg-accent/90"><Briefcase className="h-5 w-5" />{pg.careers.openings}</Link>
              <Link href="/careers#training" className="inline-flex h-14 items-center gap-2 rounded-full border border-white/30 px-7 font-medium transition hover:bg-white/10"><GraduationCap className="h-5 w-5" />{pg.careers.training}</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ================= CONTACT ================= */}
      <section id="contact" className="scroll-mt-20 py-24 sm:py-32">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <div>
            <h2 className="font-display text-4xl font-bold text-brand sm:text-5xl">{t.contact.title}</h2>
            <p className="mt-5 max-w-xl text-lg leading-loose text-ink/70">{t.contact.body}</p>
            {s.support_phone && (
              <a href={`tel:${s.support_phone}`} className="mt-10 block w-fit">
                <span className="block text-sm text-stone-450">{t.contact.phone}</span>
                <span className="font-display text-5xl font-bold tracking-tight text-brand transition hover:text-accent sm:text-6xl" dir="ltr">{s.support_phone}</span>
              </a>
            )}
          </div>
          <div className="flex flex-col gap-3">
            {s.whatsapp && (
              <a href={`https://wa.me/${s.whatsapp}`} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-4 rounded-2xl bg-emerald-600 px-6 py-5 text-white transition hover:bg-emerald-700">
                <span className="flex items-center gap-3"><MessageCircle className="h-5 w-5" />{t.contact.whatsapp}</span>
                <span dir="ltr" className="text-sm text-white/85">+{s.whatsapp}</span>
              </a>
            )}
            {s.support_email && (
              <a href={`mailto:${s.support_email}`} className="flex items-center justify-between gap-4 rounded-2xl border border-sand-200 bg-white px-6 py-5 transition hover:border-brand/30">
                <span className="flex items-center gap-3 text-ink"><Mail className="h-5 w-5 text-accent" />{t.contact.email}</span>
                <span dir="ltr" className="text-sm text-stone-450">{s.support_email}</span>
              </a>
            )}
            {s.support_phone && (
              <a href={`tel:${s.support_phone}`} className="flex items-center justify-between gap-4 rounded-2xl border border-sand-200 bg-white px-6 py-5 transition hover:border-brand/30 sm:hidden">
                <span className="flex items-center gap-3 text-ink"><Phone className="h-5 w-5 text-accent" />{t.contact.call}</span>
              </a>
            )}
          </div>
        </div>
      </section>

    </SiteFrame>
  );
}
