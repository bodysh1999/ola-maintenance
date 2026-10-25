import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { EmptyState } from './ui';
import type { Dict } from '@/lib/i18n';
import { fmtDate, fmtVisit } from '@/lib/format';
import type { Locale, RequestOverview } from '@/lib/types';
import { OverdueBadge, PriorityBadge, StatusBadge } from './badges';
import { CategoryIcon } from './category-icon';
import { WaitingOnText, whoOf, ageLabel } from './waiting';

export function RequestsTable({ rows, d, locale, compact }: { rows: RequestOverview[]; d: Dict; locale: Locale; compact?: boolean }) {
  const t = d.admin.table;
  if (!rows.length) return <EmptyState icon={<ClipboardList className="h-6 w-6" />} title={d.ops.emptyTitle}>{!compact && d.ops.emptyHint}</EmptyState>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-sand-200 bg-sand-50/70 text-start text-xs text-stone-450">
            <th className="px-4 py-3 text-start font-medium">{t.ref}</th>
            <th className="px-4 py-3 text-start font-medium">{t.owner}</th>
            <th className="px-4 py-3 text-start font-medium">{t.project} / {t.unit}</th>
            <th className="px-4 py-3 text-start font-medium">{compact ? t.type : `${t.type} / ${t.description}`}</th>
            <th className="px-4 py-3 text-start font-medium">{t.date}</th>
            <th className="px-4 py-3 text-start font-medium">{t.priority}</th>
            <th className="px-4 py-3 text-start font-medium">{t.status}</th>
            <th className="px-4 py-3 text-start font-medium">{d.ops.waitingCol}</th>
            <th className="px-4 py-3 text-start font-medium">{compact ? t.technician : `${t.technician} / ${t.visit}`}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-sand-100">
          {rows.map((r) => (
            <tr key={r.id} className="group transition hover:bg-sand-50">
              <td className="px-4 py-3">
                <Link href={`/admin/requests/${r.id}`} className="whitespace-nowrap font-mono text-[13px] font-medium text-brand group-hover:underline" dir="ltr">{r.ref_no}</Link>
              </td>
              <td className="min-w-[140px] px-4 py-3">
                <div className="font-medium">{r.owner_name}</div>
                <div className="text-xs text-stone-450" dir="ltr">{r.owner_phone}</div>
              </td>
              <td className="min-w-[140px] px-4 py-3">
                <div className="whitespace-nowrap">{locale === 'en' && r.project_name_en ? r.project_name_en : r.project_name_ar}</div>
                <div className="text-xs text-stone-450">{r.building_name} · {r.unit_number}</div>
              </td>
              <td className="min-w-[160px] max-w-[240px] px-4 py-3">
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><CategoryIcon category={r.category} className="h-3.5 w-3.5 text-brand" />{d.category[r.category]}</span>
                {!compact && r.description && <p className="mt-0.5 line-clamp-1 text-xs text-ink/60" title={r.description}>{r.description}</p>}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-xs">{fmtDate(r.created_at, locale)}</td>
              <td className="whitespace-nowrap px-4 py-3"><PriorityBadge priority={r.priority} d={d} /></td>
              <td className="px-4 py-3">
                <div className="flex flex-col items-start gap-1 whitespace-nowrap">
                  <StatusBadge status={r.status} d={d} />
                  {r.is_overdue && <OverdueBadge d={d} />}
                </div>
              </td>
              <td className="min-w-[150px] px-4 py-3"><WaitingOnText r={r} d={d} /></td>
              <td className="min-w-[130px] px-4 py-3 text-xs">
                <div>{r.technician_name ?? <span className="text-stone-400">{d.common.unassigned}</span>}</div>
                {!compact && r.visit_at && <div className="mt-0.5 whitespace-nowrap text-stone-450">{d.ops.visitShort}: {fmtVisit(r.visit_at, locale)}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function requestsToSheet(rows: RequestOverview[], d: Dict, locale: Locale) {
  const t = d.admin.table;
  return rows.map((r) => ({
    [t.ref]: r.ref_no,
    [t.owner]: r.owner_name,
    [d.common.phone]: r.owner_phone,
    [t.project]: locale === 'en' && r.project_name_en ? r.project_name_en : r.project_name_ar,
    [d.owner.building]: r.building_name,
    [t.unit]: r.unit_number,
    [t.type]: d.category[r.category],
    [d.req.location]: r.location_in_unit,
    [t.description]: r.description,
    [t.date]: r.created_at.slice(0, 16).replace('T', ' '),
    [t.priority]: d.priority[r.priority],
    [t.status]: d.status[r.status],
    [d.ops.waitingCol]: r.waiting_on ? `${d.ops.who[whoOf(r.waiting_on)]} — ${d.ops.waiting[r.waiting_on]} (${ageLabel(r.waiting_since, d)})` : '',
    [d.owner.warrantyStatus]: d.warranty[r.warranty_state],
    [t.technician]: r.technician_name,
    [t.visit]: r.visit_at ? r.visit_at.slice(0, 16).replace('T', ' ') : null,
    [d.common.overdue]: r.is_overdue ? d.common.yes : d.common.no,
    [d.admin.reports.rating]: r.rating_score,
  }));
}
