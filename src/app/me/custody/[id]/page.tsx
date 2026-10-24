import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { getI18n } from '@/lib/session';
import { getMyEmployee } from '@/lib/me';
import { loadCustody } from '@/lib/custody';
import { Card, CardHeader } from '@/components/ui';
import { CustodyBalance, ExpenseList } from '@/components/custody-view';
import { DeleteExpenseButton, ExpenseForm, SettlementButton } from '@/components/custody-client';

export default async function MyCustodyDetail({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { d, locale }, me] = await Promise.all([params, getI18n(), getMyEmployee()]);
  const data = await loadCustody(id);
  if (!data) notFound();
  const { custody: c, expenses } = data;
  const mine = me?.id === c.employee_id;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
  const issued = new Date(Date.parse(c.issued_at) - 7 * 864e5).toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
  const t = d.custody;
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/me/custody" className="inline-flex items-center gap-1 text-sm text-stone-450 hover:text-ink"><ChevronRight className="h-4 w-4 ltr:rotate-180" />{t.title}</Link>
      <CustodyBalance c={c} d={d} locale={locale} />
      {mine && c.status === 'active' && (
        <Card>
          <CardHeader title={t.addExpense} action={<SettlementButton id={c.id} />} />
          <div className="p-5"><ExpenseForm custodyId={c.id} employeeId={c.employee_id} remaining={Number(c.remaining)} minDate={issued} today={today} /></div>
        </Card>
      )}
      <ExpenseList rows={expenses} d={d} locale={locale}
        actions={(x) => (mine && c.status === 'active' && x.status === 'pending' ? <DeleteExpenseButton id={x.id} /> : null)} />
    </div>
  );
}
