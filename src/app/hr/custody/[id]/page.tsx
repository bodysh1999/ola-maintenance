import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { getI18n } from '@/lib/session';
import { loadCustody } from '@/lib/custody';
import { Alert, Card, CardHeader } from '@/components/ui';
import { CustodyBalance, ExpenseList } from '@/components/custody-view';
import { CloseCustodyForm, ReviewExpenseForm } from '@/components/custody-client';

export default async function HrCustodyDetail({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { d, locale }] = await Promise.all([params, getI18n()]);
  const data = await loadCustody(id);
  if (!data) notFound();
  const { custody: c, expenses } = data;
  const t = d.custody;
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/hr/custody" className="inline-flex items-center gap-1 text-sm text-stone-450 hover:text-ink"><ChevronRight className="h-4 w-4 ltr:rotate-180" />{t.hrTitle}</Link>
      <CustodyBalance c={c} d={d} locale={locale} />
      <ExpenseList rows={expenses} d={d} locale={locale} actions={(x) => (x.status === 'pending' && c.status !== 'closed' ? <ReviewExpenseForm id={x.id} /> : null)} />
      {c.status !== 'closed' && (
        <Card>
          <CardHeader title={t.close} />
          <div className="p-5">
            {Number(c.pending_count) > 0 ? <Alert tone="warn">{t.pendingFirst}</Alert> : <CloseCustodyForm id={c.id} remaining={Number(c.remaining)} />}
          </div>
        </Card>
      )}
    </div>
  );
}
