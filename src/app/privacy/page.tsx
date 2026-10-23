import type { Metadata } from 'next';
import { getSiteChrome, PageHero, SiteFrame } from '@/components/site-frame';
import { LegalBody } from '@/components/legal';
import { privacyPolicy } from '@/lib/legal';
import { fmtDate } from '@/lib/format';
import { getDict } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const c = await getSiteChrome();
  return { title: `${getDict(c.locale).privacy.policy} — ${c.name}` };
}

export default async function Page() {
  const c = await getSiteChrome();
  const p = getDict(c.locale).privacy;
  return (
    <SiteFrame c={c} solidHeader>
      <PageHero title={p.policy} crumbs={[{ href: '/', label: c.t.nav.home }, { href: '/privacy', label: p.policy }]} />
      <LegalBody sections={privacyPolicy(c.locale, c.s)}
        meta={`${p.version} ${c.s.privacy_version ?? '1.0'} · ${p.updatedOn}: ${fmtDate(c.s.privacy_updated_on ?? null, c.locale)}`} />
    </SiteFrame>
  );
}
