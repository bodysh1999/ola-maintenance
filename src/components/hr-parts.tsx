import Link from 'next/link';
import { Wallet, Briefcase, CalendarDays, CalendarClock, Clock3, FileBadge, Fingerprint, HandCoins, MapPinned, Plane, ScrollText } from 'lucide-react';
import type { Dict } from '@/lib/i18n';
import type { Locale } from '@/lib/types';
import { fmtDate, fmtRelative } from '@/lib/format';
import { HR_STATUS_TONE, sar, type HrRequestType } from '@/lib/hr';
import { Badge } from './ui';

export const TYPE_ICONS: Record<HrRequestType, typeof CalendarDays> = {
  leave: CalendarDays, attendance_correction: Fingerprint, presence: MapPinned, overtime: Clock3, business_trip: Plane,
  salary_certificate: FileBadge, salary_advance: HandCoins, exit_reentry: Briefcase, experience_letter: ScrollText, custody: Wallet,
};

export type HrRequestRow = {
  id: string; ref_no: string; type: HrRequestType; status: string; leave_type: string | null; start_date: string | null; end_date: string | null;
  days: number | null; work_date: string | null; hours: number | null; amount: number | null; created_at: string;
  employee_name?: string; leave_types?: { name_ar: string; name_en: string } | null;
};

export function requestSummary(r: HrRequestRow, d: Dict, locale: Locale, leaveName?: string | null) {
  const range = r.start_date ? `${fmtDate(r.start_date, locale)} → ${fmtDate(r.end_date, locale)}` : null;
  switch (r.type) {
    case 'leave': return [leaveName, range, r.days ? `${r.days} ${d.me.balance.days}` : null].filter(Boolean).join(' · ');
    case 'business_trip': case 'exit_reentry': return [range, r.days ? `${r.days} ${d.me.balance.days}` : null].filter(Boolean).join(' · ');
    case 'overtime': return `${fmtDate(r.work_date, locale)} · ${r.hours} ${d.common.hours}`;
    case 'attendance_correction': case 'presence': return fmtDate(r.work_date, locale);
    case 'salary_advance': case 'custody': return `${sar(r.amount)} ${d.common.sar}`;
    default: return '';
  }
}

export function RequestList({ rows, d, locale, showEmployee }: { rows: HrRequestRow[]; d: Dict; locale: Locale; showEmployee?: boolean }) {
  return (
    <ul className="divide-y divide-sand-100">
      {rows.map((r) => {
        const Icon = TYPE_ICONS[r.type] ?? CalendarClock;
        const lname = r.leave_types ? (locale === 'en' ? r.leave_types.name_en : r.leave_types.name_ar) : null;
        return (
          <li key={r.id}>
            <Link href={`/me/requests/${r.id}`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-sand-50">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/[.07] text-brand"><Icon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{showEmployee && r.employee_name ? `${r.employee_name} — ` : ''}{d.me.types[r.type]}</span>
                <span className="block truncate text-xs text-stone-450">{requestSummary(r, d, locale, lname) || r.ref_no}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <Badge className={HR_STATUS_TONE[r.status]}>{d.me.status[r.status as keyof typeof d.me.status]}</Badge>
                <span className="text-[11px] text-stone-450">{fmtRelative(r.created_at, locale)}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
