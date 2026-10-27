import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { Alert, Card, PageHeader } from '@/components/ui';
import { NewPurchaseForm } from '@/components/procurement-client';

export default async function NewPurchasePage() {
  const [{ d, locale }, supabase] = await Promise.all([getI18n(), createClient()]);
  const [{ data: projects }, { data: members }, { data: settings }, { data: today }] = await Promise.all([
    supabase.from('projects').select('id, name_ar, name_en').order('name_ar'),
    supabase.rpc('procurement_reps'),
    supabase.from('procurement_settings').select('quotes_required').eq('id', 1).maybeSingle(),
    supabase.rpc('today_riyadh'),
  ]);
  const reps = ((members ?? []) as { id: string; full_name: string | null }[]).map((m) => ({ id: m.id, name: m.full_name ?? '—' }));
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={d.proc.newTitle} subtitle={d.proc.subtitle} eyebrow={<Link href="/procurement" className="hover:underline">{d.proc.title}</Link>} />
      {!reps.length && <Alert tone="warn" className="mb-4">{d.proc.noReps}</Alert>}
      <Card className="p-5 sm:p-6">
        <NewPurchaseForm
          projects={(projects ?? []).map((x) => ({ id: x.id, name: locale === 'en' && x.name_en ? x.name_en : x.name_ar }))}
          reps={reps}
          defaultQuotes={settings?.quotes_required ?? 3}
          today={String(today ?? new Date().toISOString().slice(0, 10))}
        />
      </Card>
    </div>
  );
}
