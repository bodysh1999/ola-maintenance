import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile, getI18n, getSettings } from '@/lib/session';
import { siteOrigin } from '@/lib/origin';
import { todayRiyadh } from '@/lib/format';
import { LetterScale } from '@/components/hr-letter';
import { WarrantyCertificate } from '@/components/warranty-cert';
import { PrintButton } from '../../letters/[id]/print-button';

/** Printable warranty certificate — the unit's owner and company staff only (RLS) */
export default async function WarrantyCertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, supabase, origin, s, { d }, profile] = await Promise.all([params, createClient(), siteOrigin(), getSettings(), getI18n(), getCurrentProfile()]);
  const { data: w } = await supabase.from('warranties')
    .select('id, title, category, start_date, end_date, covered_items, excluded_items, responsible_party, verify_code, contractors(name), units(id, unit_number, buildings(name, projects(name_ar)), owners(full_name))')
    .eq('id', id).maybeSingle();
  if (!w) notFound();
  const u = w.units as unknown as { id: string; unit_number: string; buildings: { name: string; projects: { name_ar: string } | null } | null; owners: { full_name: string } | null };
  const back = profile?.role === 'owner' ? '/owner/warranties' : `/admin/units/${u.id}`;

  return (
    <div dir="rtl" className="min-h-screen overflow-x-hidden bg-stone-100 px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-4 print:hidden">
        <Link href={back} className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-ink"><ChevronRight className="h-4 w-4" />{d.portal.warrantyCenter}</Link>
        <PrintButton />
      </div>
      <LetterScale>
        <WarrantyCertificate
          code={w.verify_code} verifyUrl={`${origin}/verify/${w.verify_code}`} today={todayRiyadh()}
          company={{ name_ar: s.name_ar, name_en: s.name_en, logo_url: s.logo_url, phone: s.support_phone, email: s.support_email, website: s.website_url }}
          w={{
            title: w.title, category_label: w.category ? d.category[w.category as keyof typeof d.category] : null,
            start_date: w.start_date, end_date: w.end_date, covered_items: w.covered_items, excluded_items: w.excluded_items,
            responsible: (w.contractors as unknown as { name: string } | null)?.name ?? w.responsible_party,
            unit_number: u.unit_number, building: u.buildings?.name ?? null, project: u.buildings?.projects?.name_ar ?? null, owner: u.owners?.full_name ?? null,
          }} />
      </LetterScale>
    </div>
  );
}
