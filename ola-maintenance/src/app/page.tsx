import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient as createPlainClient } from '@supabase/supabase-js';
import { ChevronDown, Mail, MessageCircle, Phone, ShieldCheck, Gem, Handshake, Lightbulb, Eye, Sparkles } from 'lucide-react';
import { getCurrentProfile, getI18n, getSettings, homeFor } from '@/lib/session';
import { FALLBACK_PROJECTS, SITE_ASSETS, siteContent, type SiteProject } from '@/lib/site-content';
import { DEFAULT_LOGO } from '@/components/brand';
import { SocialLinks } from '@/components/contact-links';
import { CountUp, ProjectsGrid, SiteHeader } from '@/components/site';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: { absolute: s.name_ar },
    description: 'عُلا التميز شركة تطوير عقارية وطنية تأسست عام ١٤٢٤هـ — مشاريع سكنية وتجارية وخدمة ما بعد البيع.',
    openGraph: { images: [SITE_ASSETS.about] },
  };
}

/** Public list of projects (anon read — migration 5); falls back to the built-in list */
async function getProjects(): Promise<SiteProject[]> {
  try {
    const anon = createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { data, error } = await anon.from('projects').select('name_ar, name_en, image_url, sales_status').order('name_ar', { ascending: false });
    if (error || !data?.length) return FALLBACK_PROJECTS;
    return data as SiteProject[];
  } catch {
    return FALLBACK_PROJECTS;
  }
}

export default async function HomePage() {
  const [{ locale }, s, profile, projects] = await Promise.all([getI18n(), getSettings(), getCurrentProfile(), getProjects()]);
  const t = siteContent(locale);
  const name = locale === 'ar' ? s.name_ar : s.name_en;
  const logo = s.logo_url || DEFAULT_LOGO;
  const loggedIn = !!profile?.is_active;
  const portalHref = loggedIn ? homeFor(profile!.role) : '/login';
  const valueIcons = [Gem, ShieldCheck, Lightbulb, Eye, Handshake];

  return (
    <div id="top" className="overflow-x-clip bg-sand-50 text-ink">
      <SiteHeader t={t} logo={logo} name={name} portalHref={portalHref} loggedIn={loggedIn} />

      {/* ================= HERO ================= */}
      <section className="relative isolate flex min-h-[100svh] items-end overflow-hidden bg-brand text-white">
        <video className="absolute inset-0 -z-20 h-full w-full object-cover" autoPlay muted loop playsInline preload="metadata" poster={SITE_ASSETS.heroPoster}>
          <source src={SITE_ASSETS.heroVideo} type="video/mp4" />
        </video>
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-brand via-brand/55 to-brand/30" />
        <div className="texture-lines absolute inset-0 -z-10 opacity-40" />
        <div className="mx-auto w-full max-w-7xl px-5 pb-20 pt-40 sm:px-8 lg:pb-28">
          <div className="rise-in mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-accent" />{t.hero.eyebrow}
          </div>
          <h1 className="rise-in text-5xl font-bold leading-[1.2] sm:text-7xl lg:text-8xl">{t.hero.title}</h1>
          <p className="rise-in-2 mt-6 max-w-2xl text-lg leading-relaxed text-white/80 sm:text-xl">{t.hero.subtitle}</p>
          <div className="rise-in-3 mt-10 flex flex-wrap gap-3">
            <a href="#projects" className="inline-flex h-14 items-center rounded-full bg-white px-8 text-[15px] font-semibold text-brand shadow-lift transition hover:bg-sand-100">{t.hero.cta1}</a>
            <a href="#after-sales" className="inline-flex h-14 items-center rounded-full border border-white/40 px-8 text-[15px] font-medium text-white backdrop-blur transition hover:bg-white/10">{t.hero.cta2}</a>
          </div>
        </div>
        <a href="#about" aria-label="scroll" className="absolute bottom-6 start-1/2 hidden -translate-x-1/2 animate-bounce text-white/60 rtl:translate-x-1/2 sm:block"><ChevronDown className="h-6 w-6" /></a>
      </section>

      {/* ================= ABOUT + STATS ================= */}
      <section id="about" className="scroll-mt-20 py-24 sm:py-32">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-2">
          <div>
            <SectionEyebrow>{t.about.eyebrow}</SectionEyebrow>
            <h2 className="text-4xl font-bold leading-tight text-brand sm:text-5xl">{t.about.title}</h2>
            <p className="mt-6 text-lg leading-loose text-ink/75">{t.about.body}</p>
            <div className="mt-8 inline-flex items-center gap-3 rounded-2xl border border-sand-200 bg-white px-5 py-3 shadow-card">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-accent"><ShieldCheck className="h-5 w-5" /></span>
              <span className="font-medium">{t.about.badge}</span>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-3 -z-0 translate-x-3 translate-y-3 rounded-[32px] border-2 border-accent/40 rtl:-translate-x-3" />
            <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-brand shadow-lift">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={SITE_ASSETS.about} alt="" loading="lazy" className="h-full w-full object-cover" />
            </div>
          </div>
        </div>

        <div className="mx-auto mt-20 max-w-7xl px-5 sm:px-8">
          <div className="texture-lines grid grid-cols-2 gap-px overflow-hidden rounded-[28px] bg-brand/90 shadow-lift sm:grid-cols-3 lg:grid-cols-5">
            {t.stats.map((st) => (
              <div key={st.label} className="bg-brand px-6 py-8 text-center text-white last:col-span-2 sm:last:col-span-1">
                <div className="text-3xl font-bold sm:text-4xl"><CountUp to={st.to} suffix={st.suffix} /></div>
                <div className="mt-2 text-sm text-white/65">{st.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= PROJECTS ================= */}
      <section id="projects" className="scroll-mt-20 bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mb-10 text-center">
            <SectionEyebrow center>{t.projects.eyebrow}</SectionEyebrow>
            <h2 className="text-4xl font-bold text-brand sm:text-5xl">{t.projects.title}</h2>
          </div>
          <ProjectsGrid projects={projects} t={t} locale={locale} />
        </div>
      </section>

      {/* ================= VISION / MISSION / VALUES ================= */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mb-12 text-center">
            <SectionEyebrow center>{t.identity.eyebrow}</SectionEyebrow>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {[[t.identity.vision, SITE_ASSETS.vision], [t.identity.mission, SITE_ASSETS.mission]].map(([block, img]) => {
              const b = block as { title: string; body: string };
              return (
                <article key={b.title} className="group overflow-hidden rounded-[28px] border border-sand-200 bg-white shadow-card">
                  <div className="relative h-56 overflow-hidden bg-brand">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img as string} alt="" loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-brand/80 to-transparent" />
                    <h3 className="absolute bottom-5 start-6 text-3xl font-bold text-white">{b.title}</h3>
                  </div>
                  <p className="p-7 text-[17px] leading-loose text-ink/75">{b.body}</p>
                </article>
              );
            })}
          </div>

          <div className="mt-6 overflow-hidden rounded-[28px] bg-brand text-white shadow-lift lg:grid lg:grid-cols-[1fr_2fr]">
            <div className="relative min-h-[220px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={SITE_ASSETS.values} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-80" />
              <div className="absolute inset-0 bg-gradient-to-t from-brand to-brand/10 lg:bg-gradient-to-l rtl:lg:bg-gradient-to-r" />
              <h3 className="absolute bottom-6 start-7 text-3xl font-bold">{t.identity.values.title}</h3>
            </div>
            <ul className="grid gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
              {t.identity.values.items.map(([title, body], i) => {
                const Icon = valueIcons[i] ?? Gem;
                return (
                  <li key={title} className="bg-brand p-6">
                    <Icon className="h-6 w-6 text-accent" />
                    <div className="mt-3 text-lg font-semibold">{title}</div>
                    <p className="mt-1 text-sm leading-relaxed text-white/65">{body}</p>
                  </li>
                );
              })}
              <li className="texture-lines hidden place-items-center bg-brand p-6 lg:grid">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo} alt="" className="h-14 w-auto opacity-30" />
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ================= AFTER-SALES → SYSTEM ================= */}
      <section id="after-sales" className="relative isolate scroll-mt-20 overflow-hidden bg-brand py-24 text-white sm:py-32">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={SITE_ASSETS.afterSales} alt="" loading="lazy" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-25" />
        <div className="texture-lines absolute inset-0 -z-10" />
        <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <SectionEyebrow light>{t.afterSales.eyebrow}</SectionEyebrow>
            <h2 className="text-4xl font-bold sm:text-5xl">{t.afterSales.title}</h2>
            <p className="mt-6 text-lg leading-loose text-white/80">{t.afterSales.body}</p>
            <p className="mt-4 leading-loose text-white/65">{t.afterSales.body2}</p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link href={portalHref} className="inline-flex h-14 items-center gap-2 rounded-full bg-accent px-8 text-[15px] font-semibold text-white shadow-lift transition hover:bg-accent/90">
                <ShieldCheck className="h-5 w-5" />{loggedIn ? t.nav.dashboard : t.afterSales.cta}
              </Link>
              {s.whatsapp && !loggedIn && (
                <a href={`https://wa.me/${s.whatsapp}`} target="_blank" rel="noreferrer" className="text-sm text-white/75 underline-offset-4 hover:text-white hover:underline">{t.afterSales.cta2}</a>
              )}
            </div>
          </div>
          <ol className="relative space-y-4">
            {t.afterSales.steps.map(([title, body], i) => (
              <li key={title} className="flex items-start gap-5 rounded-2xl bg-white/[.07] p-5 ring-1 ring-white/10 backdrop-blur">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent text-lg font-bold text-white">{i + 1}</span>
                <span>
                  <span className="block text-lg font-semibold">{title}</span>
                  <span className="text-sm text-white/65">{body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ================= PARTNERS ================= */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mb-10 text-center">
            <SectionEyebrow center>{t.partners.eyebrow}</SectionEyebrow>
            <h2 className="text-3xl font-bold text-brand sm:text-4xl">{t.partners.title}</h2>
          </div>
          <div className="grid grid-cols-2 items-center gap-6 sm:grid-cols-3 lg:grid-cols-6">
            {SITE_ASSETS.partners.map((src) => (
              <div key={src} className="grid h-28 place-items-center rounded-2xl border border-sand-200 bg-sand-50 p-5 transition hover:border-accent/50 hover:bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" loading="lazy" className="max-h-16 w-auto object-contain opacity-75 grayscale transition hover:opacity-100 hover:grayscale-0" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CONTACT ================= */}
      <section id="contact" className="scroll-mt-20 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <SectionEyebrow center>{t.contact.eyebrow}</SectionEyebrow>
            <h2 className="text-4xl font-bold text-brand sm:text-5xl">{t.contact.title}</h2>
            <p className="mt-5 text-lg leading-loose text-ink/70">{t.contact.body}</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {s.support_phone && (
              <ContactCard icon={<Phone className="h-6 w-6" />} label={t.contact.phone} value={s.support_phone} href={`tel:${s.support_phone}`} cta={t.contact.call} />
            )}
            {s.whatsapp && (
              <ContactCard icon={<MessageCircle className="h-6 w-6" />} label={t.contact.whatsapp} value={`+${s.whatsapp}`} href={`https://wa.me/${s.whatsapp}`} cta={t.contact.whatsappCta} accent />
            )}
            {s.support_email && (
              <ContactCard icon={<Mail className="h-6 w-6" />} label={t.contact.email} value={s.support_email} href={`mailto:${s.support_email}`} cta={t.contact.write} />
            )}
          </div>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="texture-lines bg-brand text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt={name} className="h-14 w-auto" />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/60">{t.about.body.slice(0, 140)}…</p>
          </div>
          <div>
            <div className="mb-4 text-sm font-semibold text-accent">{t.footer.quick}</div>
            <ul className="space-y-2.5 text-sm text-white/70">
              <li><a href="#about" className="hover:text-white">{t.nav.about}</a></li>
              <li><a href="#projects" className="hover:text-white">{t.nav.projects}</a></li>
              <li><Link href={portalHref} className="hover:text-white">{t.nav.afterSales}</Link></li>
              <li><a href="#contact" className="hover:text-white">{t.nav.contact}</a></li>
            </ul>
          </div>
          <div>
            <div className="mb-4 text-sm font-semibold text-accent">{t.footer.follow}</div>
            <SocialLinks s={s} light className="flex-col items-start gap-y-2.5 text-sm" />
            {s.support_phone && <a href={`tel:${s.support_phone}`} dir="ltr" className="mt-5 block text-lg font-semibold">{s.support_phone}</a>}
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto max-w-7xl px-5 py-5 text-center text-xs text-white/50 sm:px-8">
            © {new Date().getFullYear()} {name} — {t.footer.rights}
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionEyebrow({ children, center, light }: { children: React.ReactNode; center?: boolean; light?: boolean }) {
  return (
    <div className={`mb-4 flex items-center gap-3 text-sm font-medium ${center ? 'justify-center' : ''} ${light ? 'text-accent' : 'text-accent'}`}>
      <span className="h-px w-8 bg-accent" />{children}{center && <span className="h-px w-8 bg-accent" />}
    </div>
  );
}

function ContactCard({ icon, label, value, href, cta, accent }: { icon: React.ReactNode; label: string; value: string; href: string; cta: string; accent?: boolean }) {
  return (
    <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer"
      className={`group flex flex-col rounded-[24px] border p-7 shadow-card transition hover:-translate-y-1 hover:shadow-lift ${accent ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-sand-200 bg-white'}`}>
      <span className={`grid h-14 w-14 place-items-center rounded-2xl ${accent ? 'bg-white/15' : 'bg-brand text-accent'}`}>{icon}</span>
      <span className={`mt-6 text-sm ${accent ? 'text-white/75' : 'text-stone-450'}`}>{label}</span>
      <span className="mt-1 text-xl font-semibold" dir="ltr">{value}</span>
      <span className={`mt-5 text-sm font-medium ${accent ? 'text-white' : 'text-brand'} group-hover:underline`}>{cta} <span className="inline-block ltr:rotate-180">←</span></span>
    </a>
  );
}
