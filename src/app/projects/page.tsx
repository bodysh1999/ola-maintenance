import type { Metadata } from 'next';
import { getProjects } from '@/lib/public-data';
import { ProjectsGrid } from '@/components/site';
import { getSiteChrome, PageHero, SiteFrame } from '@/components/site-frame';

export async function generateMetadata(): Promise<Metadata> {
  const c = await getSiteChrome();
  return { title: c.pg.projectsPage.title, description: c.pg.projectsPage.body };
}

export default async function ProjectsPage() {
  const [c, projects] = await Promise.all([getSiteChrome(), getProjects()]);
  return (
    <SiteFrame c={c}>
      <PageHero title={c.pg.projectsPage.title} body={c.pg.projectsPage.body} crumbs={[{ href: '/', label: c.t.nav.home }, { href: '/projects', label: c.t.nav.projects }]} />
      <section className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <ProjectsGrid projects={projects} t={c.t} locale={c.locale} whatsapp={c.s.whatsapp} />
        </div>
      </section>
    </SiteFrame>
  );
}
