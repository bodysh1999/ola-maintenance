import Link from 'next/link';
import { Award, BookOpen, Download, FileSignature, FileText, Files, Image as ImageIcon, Landmark, Ruler, ShieldCheck } from 'lucide-react';
import { fmt, type Dict } from '@/lib/i18n';
import type { Locale } from '@/lib/types';
import { fmtDate } from '@/lib/format';
import { DOC_KINDS, warrantyState, type UnitDoc, type WarrantyRow } from '@/lib/portal';
import { cx } from './ui';
import { DeleteDocButton } from './portal-client';

const KIND_ICON = {
  sale_contract: FileSignature, title_deed: Landmark, handover_report: FileText, drawings: Ruler,
  manual: BookOpen, warranty_cert: Award, other: Files,
} as const;

const size = (b: number | null) => (!b ? '' : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** The unit's digital file: documents grouped by type, each downloadable */
export function UnitDocsList({ docs, d, locale, canDelete = false }: { docs: UnitDoc[]; d: Dict; locale: Locale; canDelete?: boolean }) {
  if (!docs.length) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-sand-200 px-4 py-6 text-sm text-stone-450">
        <Files className="h-5 w-5" /> {d.portal.noDocs}
      </div>
    );
  }
  return (
    <div className="space-y-5">
      {DOC_KINDS.filter((k) => docs.some((x) => x.kind === k)).map((k) => {
        const Icon = KIND_ICON[k];
        return (
          <div key={k}>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-stone-450"><Icon className="h-3.5 w-3.5" />{d.portal.docKinds[k]}</div>
            <ul className="divide-y divide-sand-100 overflow-hidden rounded-2xl border border-sand-100 bg-white">
              {docs.filter((x) => x.kind === k).map((x) => (
                <li key={x.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/[.06] text-brand">
                    {x.mime_type?.startsWith('image/') ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{x.title}</div>
                    <div className="text-xs text-stone-450">{fmtDate(x.created_at, locale)}{x.size_bytes ? ` · ${size(x.size_bytes)}` : ''}</div>
                  </div>
                  {x.url && (
                    <a href={x.url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-sand-200 px-3 text-xs font-medium text-ink/80 hover:border-brand/40 hover:text-brand">
                      <Download className="h-3.5 w-3.5" />{d.portal.download}
                    </a>
                  )}
                  {canDelete && <DeleteDocButton id={x.id} />}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

const TONE = {
  ok: { bar: 'bg-emerald-500', text: 'text-emerald-700', chip: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  soon: { bar: 'bg-amber-500', text: 'text-amber-700', chip: 'bg-amber-50 text-amber-800 ring-amber-200' },
  expired: { bar: 'bg-stone-300', text: 'text-stone-500', chip: 'bg-stone-100 text-stone-600 ring-stone-200' },
  upcoming: { bar: 'bg-sky-400', text: 'text-sky-700', chip: 'bg-sky-50 text-sky-800 ring-sky-200' },
};

/** One line per warranty: a bar from start to end with how much is left */
export function WarrantyTimeline({ warranties, today, d, locale, certHref }: {
  warranties: WarrantyRow[]; today: string; d: Dict; locale: Locale; certHref?: (id: string) => string;
}) {
  if (!warranties.length) return <p className="py-4 text-sm text-stone-450">{d.common.noData}</p>;
  const live = warranties.filter((w) => w.end_date >= today).sort((a, b) => a.end_date.localeCompare(b.end_date));
  const expired = warranties.filter((w) => w.end_date < today).sort((a, b) => b.end_date.localeCompare(a.end_date));
  const item = (w: WarrantyRow) => {
        const st = warrantyState(w, today, d, (v) => fmtDate(v, locale), locale);
        const tone = TONE[st.tone];
        return (
          <li key={w.id} className="rounded-2xl border border-sand-100 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium"><ShieldCheck className={cx('h-4 w-4 shrink-0', tone.text)} />{w.title}</div>
                <div className="mt-0.5 text-xs text-stone-450">
                  {w.category ? d.category[w.category as keyof Dict['category']] : d.admin.unit.anyCategory}
                  {' · '}{fmtDate(w.start_date, locale)} — {fmtDate(w.end_date, locale)}
                </div>
              </div>
              <span className={cx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1', tone.chip)}>{st.label}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand-100" role="progressbar" aria-valuenow={st.elapsed} aria-valuemin={0} aria-valuemax={100}>
              <div className={cx('h-full rounded-full', tone.bar)} style={{ width: `${st.tone === 'expired' ? 100 : Math.max(3, 100 - st.elapsed)}%` }} />
            </div>
            {(w.covered_items || w.excluded_items) && (
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer select-none text-stone-450">{d.portal.covered} / {d.portal.excluded}</summary>
                {w.covered_items && <p className="mt-1.5"><span className="text-emerald-700">{d.portal.covered}:</span> {w.covered_items}</p>}
                {w.excluded_items && <p className="mt-0.5"><span className="text-rose-700">{d.portal.excluded}:</span> {w.excluded_items}</p>}
              </details>
            )}
            {certHref && (
              <Link href={certHref(w.id)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline">
                <Award className="h-3.5 w-3.5" />{d.portal.viewCertificate}
              </Link>
            )}
          </li>
        );
  };
  return (
    <div className="space-y-3">
      <ul className="space-y-3">{live.map(item)}</ul>
      {expired.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer select-none rounded-xl bg-sand-50 px-4 py-2.5 text-sm text-stone-450">{fmt(d.portal.expiredGroup, { n: expired.length })}</summary>
          <ul className="mt-3 space-y-3">{expired.map(item)}</ul>
        </details>
      )}
    </div>
  );
}
