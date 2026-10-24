import Link from 'next/link';
import { FileText, Wallet } from 'lucide-react';
import type { Dict } from '@/lib/i18n';
import type { Locale } from '@/lib/types';
import { fmtDate } from '@/lib/format';
import { sar } from '@/lib/hr';
import { Badge, Card, CardHeader, cx } from './ui';

export type CustodyRow = {
  id: string; ref_no: string; employee_id: string; employee_name: string; job_title: string | null; amount: number; purpose: string | null;
  status: 'active' | 'settlement_requested' | 'closed'; issued_at: string; returned_amount: number | null; closed_at: string | null; close_note: string | null;
  spent_approved: number; spent_pending: number; pending_count: number; remaining: number;
};
export type ExpenseRow = {
  id: string; kind: 'invoice' | 'no_invoice'; category: string; description: string | null; vendor: string | null; invoice_no: string | null;
  amount: number; expense_date: string; attachment_path: string | null; status: 'pending' | 'approved' | 'rejected'; review_note: string | null; url?: string | null;
};

export const CUSTODY_TONE = {
  active: 'bg-emerald-50 text-emerald-800 ring-emerald-200', settlement_requested: 'bg-amber-50 text-amber-800 ring-amber-200', closed: 'bg-stone-100 text-stone-600 ring-stone-200',
} as const;
const EXP_TONE = { pending: 'bg-amber-50 text-amber-800 ring-amber-200', approved: 'bg-emerald-50 text-emerald-800 ring-emerald-200', rejected: 'bg-rose-50 text-rose-800 ring-rose-200' } as const;

/** Balance card: amount → spent (approved / pending) → remaining, with a bar */
export function CustodyBalance({ c, d, locale }: { c: CustodyRow; d: Dict; locale: Locale }) {
  const t = d.custody;
  const n = (v: number) => Number(v ?? 0);
  const pa = Math.min(100, (n(c.spent_approved) / n(c.amount)) * 100);
  const pp = Math.min(100 - pa, (n(c.spent_pending) / n(c.amount)) * 100);
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand text-accent"><Wallet className="h-6 w-6" /></span>
          <div>
            <div className="font-mono text-xs text-stone-450" dir="ltr">{c.ref_no}</div>
            <div className="font-semibold">{c.purpose}</div>
            <div className="text-xs text-stone-450">{c.employee_name} · {t.issued}: {fmtDate(c.issued_at, locale)}</div>
          </div>
        </div>
        <Badge className={CUSTODY_TONE[c.status]}>{t.status[c.status]}</Badge>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[[t.amount, c.amount, 'text-ink'], [t.approvedSpent, c.spent_approved, 'text-emerald-700'], [t.pendingSpent, c.spent_pending, 'text-amber-700'],
          [c.status === 'closed' ? t.returned : t.remaining, c.status === 'closed' ? c.returned_amount ?? 0 : c.remaining, 'text-brand']].map(([l, v, cls]) => (
          <div key={l as string}>
            <div className="text-xs text-stone-450">{l as string}</div>
            <div className={cx('mt-1 font-display text-2xl font-bold tabular-nums', cls as string)}>{sar(v as number)} <span className="text-xs font-normal text-stone-450">{d.common.sar}</span></div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-sand-100" aria-hidden>
        <span className="bg-emerald-500" style={{ width: `${pa}%` }} />
        <span className="bg-amber-300" style={{ width: `${pp}%` }} />
      </div>
      {c.close_note && <p className="mt-3 text-sm text-stone-450">{c.close_note}</p>}
    </Card>
  );
}

export function ExpenseList({ rows, d, locale, actions }: { rows: ExpenseRow[]; d: Dict; locale: Locale; actions?: (x: ExpenseRow) => React.ReactNode }) {
  const t = d.custody;
  return (
    <Card>
      <CardHeader title={`${t.expenses} (${rows.length})`} />
      {!rows.length ? <p className="px-5 py-6 text-sm text-stone-450">{t.noExpenses}</p> : (
        <ul className="divide-y divide-sand-100">
          {rows.map((x) => (
            <li key={x.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{t.categories[x.category as keyof typeof t.categories]}</span>
                  <Badge className="bg-sand-100 text-ink/70 ring-sand-200">{t.kinds[x.kind]}</Badge>
                  <Badge className={EXP_TONE[x.status]}>{t.expStatus[x.status]}</Badge>
                </div>
                <div className="mt-0.5 text-xs text-stone-450">
                  {fmtDate(x.expense_date, locale)}{x.description ? ` · ${x.description}` : ''}{x.vendor ? ` · ${x.vendor}` : ''}{x.invoice_no ? ` · #${x.invoice_no}` : ''}
                </div>
                {x.status === 'rejected' && x.review_note && <div className="mt-1 text-xs text-rose-700">{t.rejectReason}: {x.review_note}</div>}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold tabular-nums">{sar(x.amount)} <span className="text-xs font-normal text-stone-450">{d.common.sar}</span></span>
                {x.url && <a href={x.url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-lg border border-sand-200 px-2 text-xs hover:border-brand/40"><FileText className="h-3.5 w-3.5" />{t.viewFile}</a>}
                {actions?.(x)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function CustodyCards({ rows, d, locale, base }: { rows: CustodyRow[]; d: Dict; locale: Locale; base: string }) {
  const t = d.custody;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {rows.map((c) => {
        const pct = Math.min(100, ((Number(c.amount) - Number(c.remaining)) / Number(c.amount)) * 100);
        return (
          <Link key={c.id} href={`${base}/${c.id}`} className="rounded-2xl border border-sand-200 bg-white p-4 shadow-card transition hover:border-brand/30">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-medium">{c.purpose}</div>
                <div className="text-xs text-stone-450"><span dir="ltr">{c.ref_no}</span> · {c.employee_name} · {fmtDate(c.issued_at, locale)}</div>
              </div>
              <Badge className={CUSTODY_TONE[c.status]}>{t.status[c.status]}</Badge>
            </div>
            <div className="mt-3 flex items-end justify-between text-sm">
              <span className="text-stone-450">{t.remaining}</span>
              <span className="font-display text-xl font-bold text-brand tabular-nums">{sar(c.remaining)} <span className="text-xs font-normal text-stone-450">/ {sar(c.amount)}</span></span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-sand-100"><span className="block h-full bg-brand" style={{ width: `${pct}%` }} /></div>
            {Number(c.pending_count) > 0 && <div className="mt-2 text-xs text-amber-700">{t.pendingSpent}: {c.pending_count}</div>}
          </Link>
        );
      })}
    </div>
  );
}
