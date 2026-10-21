import Link from 'next/link';
import { CalendarClock, ChevronLeft } from 'lucide-react';
import type { Dict } from '@/lib/i18n';
import { fmtDate, fmtVisit } from '@/lib/format';
import type { Locale, RequestOverview } from '@/lib/types';
import { StatusBadge } from './badges';
import { CategoryIcon } from './category-icon';

export function RequestCard({ r, d, locale, href }: { r: RequestOverview; d: Dict; locale: Locale; href: string }) {
  return (
    <Link href={href} className="group flex items-center gap-4 rounded-2xl border border-sand-200 bg-white p-4 shadow-card transition hover:border-brand/30 hover:shadow-lift">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand/[.07] text-brand">
        <CategoryIcon category={r.category} className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-ink">{d.category[r.category]}</span>
          <StatusBadge status={r.status} d={d} />
        </div>
        <p className="mt-0.5 truncate text-sm text-stone-450">{r.location_in_unit} — {r.description}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-450">
          <span className="font-mono" dir="ltr">{r.ref_no}</span>
          <span>{fmtDate(r.created_at, locale)}</span>
          {r.visit_at && !['completed', 'rejected'].includes(r.status) && (
            <span className="inline-flex items-center gap-1 text-brand"><CalendarClock className="h-3.5 w-3.5" />{fmtVisit(r.visit_at, locale)}</span>
          )}
        </div>
      </div>
      <ChevronLeft className="h-5 w-5 shrink-0 text-stone-400 transition group-hover:text-brand ltr:rotate-180" />
    </Link>
  );
}
