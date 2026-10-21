import Link from 'next/link';
import type { Dict } from '@/lib/i18n';
import { fmtDate, fmtVisit } from '@/lib/format';
import type { Locale, RequestOverview } from '@/lib/types';
import { OverdueBadge, PriorityBadge, StatusBadge } from './badges';
import { CategoryIcon } from './category-icon';

export function RequestsTable({ rows, d, locale, compact }: { rows: RequestOverview[]; d: Dict; locale: Locale; compact?: boolean }) {
  const t = d.admin.table;
  if (!rows.length) return <p className="px-5 py-10 text-center text-sm text-stone-450">{d.common.noData}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] text-sm">
        <thead>
          <tr className="border-b border-sand-200 bg-sand-50/70 text-start text-xs text-stone-450">
            <th className="px-4 py-3 text-start font-medium">{t.ref}</th>
            <th className="px-4 py-3 text-start font-medium">{t.owner}</th>
            <th className="px-4 py-3 text-start font-medium">{t.project} / {t.unit}</th>
            <th className="px-4 py-3 text-start font-medium">{t.type}</th>
            {!compact && <th className="px-4 py-3 text-start font-medium">{t.description}</th>}
            <th className="px-4 py-3 text-start font-medium">{t.date}</th>
            <th className="px-4 py-3 text-start font-medium">{t.priority}</th>
            <th className="px-4 py-3 text-start font-medium">{t.status}</th>
            <th className="px-4 py-3 text-start font-medium">{t.technician}</th>
            {!compact && <th className="px-4 py-3 text-start font-medium">{t.visit}</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-sand-100">
          {rows.map((r) => (
            <tr key={r.id} className="group transition hover:bg-sand-50">
              <td className="px-4 py-3">
                <Link href={`/admin/requests/${r.id}`} className="font-mono text-[13px] font-medium text-brand group-hover:underline" dir="ltr">{r.ref_no}</Link>
              </td>
              <td className="px-4 py-3">
                <div className="font-medium">{r.owner_name}</div>
                <div className="text-xs text-stone-450" dir="ltr">{r.owner_phone}</div>
              </td>
              <td className="px-4 py-3">
                <div>{locale === 'en' && r.project_name_en ? r.project_name_en : r.project_name_ar}</div>
                <div className="text-xs text-stone-450">{r.building_name} · {r.unit_number}</div>
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1.5"><CategoryIcon category={r.category} className="h-3.5 w-3.5 text-brand" />{d.category[r.category]}</span>
              </td>
              {!compact && <td className="max-w-[220px] px-4 py-3"><p className="line-clamp-2 text-xs text-ink/70">{r.description}</p></td>}
              <td className="whitespace-nowrap px-4 py-3 text-xs">{fmtDate(r.created_at, locale)}</td>
              <td className="px-4 py-3"><PriorityBadge priority={r.priority} d={d} /></td>
              <td className="px-4 py-3">
                <div className="flex flex-col items-start gap-1">
                  <StatusBadge status={r.status} d={d} />
                  {r.is_overdue && <OverdueBadge d={d} />}
                </div>
              </td>
              <td className="px-4 py-3 text-xs">{r.technician_name ?? <span className="text-stone-400">{d.common.unassigned}</span>}</td>
              {!compact && <td className="whitespace-nowrap px-4 py-3 text-xs">{r.visit_at ? fmtVisit(r.visit_at, locale) : '—'}</td>}
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
    [d.owner.warrantyStatus]: d.warranty[r.warranty_state],
    [t.technician]: r.technician_name,
    [t.visit]: r.visit_at ? r.visit_at.slice(0, 16).replace('T', ' ') : null,
    [d.common.overdue]: r.is_overdue ? d.common.yes : d.common.no,
    [d.admin.reports.rating]: r.rating_score,
  }));
}
