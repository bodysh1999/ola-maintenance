import type { SupabaseClient } from '@supabase/supabase-js';
import { fmt, type Dict } from './i18n';

export type UnitDoc = {
  id: string; unit_id: string; kind: string; title: string; storage_path: string; file_name: string;
  mime_type: string | null; size_bytes: number | null; created_at: string; url: string | null;
};

export type WarrantyRow = {
  id: string; unit_id: string; title: string; category: string | null; start_date: string; end_date: string;
  covered_items: string | null; excluded_items: string | null; responsible_party: string | null; contractors?: { name: string } | null;
};

export const DOC_KINDS = ['sale_contract', 'title_deed', 'handover_report', 'drawings', 'manual', 'warranty_cert', 'other'] as const;

/** Documents of the given units with short-lived download links (RLS decides who can read them) */
export async function loadUnitDocs(supabase: SupabaseClient, unitIds: string[]): Promise<UnitDoc[]> {
  if (!unitIds.length) return [];
  const { data } = await supabase.from('unit_documents').select('*').in('unit_id', unitIds).order('created_at', { ascending: false });
  const docs = (data ?? []) as Omit<UnitDoc, 'url'>[];
  if (!docs.length) return [];
  const { data: signed } = await supabase.storage.from('unit-docs').createSignedUrls(docs.map((x) => x.storage_path), 60 * 60);
  const urls = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return docs.map((x) => ({ ...x, url: urls.get(x.storage_path) ?? null }));
}

const DAY = 86400000;
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

const AR_UNITS = { day: ['يوم', 'يومان', 'أيام', 'يومًا'], month: ['شهر', 'شهران', 'أشهر', 'شهرًا'], year: ['سنة', 'سنتان', 'سنوات', 'سنة'] } as const;
const EN_UNITS = { day: ['day', 'days'], month: ['month', 'months'], year: ['year', 'years'] } as const;

/** "3 أيام" / "11 يومًا" / "سنتان" — Arabic counted nouns; plain plural in English */
export function countLabel(n: number, unit: 'day' | 'month' | 'year', locale: 'ar' | 'en') {
  if (locale === 'en') return `${n} ${n === 1 ? EN_UNITS[unit][0] : EN_UNITS[unit][1]}`;
  const u = AR_UNITS[unit];
  if (n === 1) return u[0];
  if (n === 2) return u[1];
  if (n >= 3 && n <= 10) return `${n} ${u[2]}`;
  return `${n} ${u[3]}`;
}

/** How much of a warranty is left, as a label + tone + progress (0–100 elapsed) */
export function warrantyState(w: Pick<WarrantyRow, 'start_date' | 'end_date'>, today: string, d: Dict, fmtD: (v: string) => string, locale: 'ar' | 'en' = 'ar') {
  const total = Math.max(1, days(w.start_date, w.end_date));
  const left = days(today, w.end_date);
  const elapsed = Math.min(100, Math.max(0, Math.round((days(w.start_date, today) / total) * 100)));
  const t = d.portal;
  const c = (n: number, u: 'day' | 'month' | 'year') => countLabel(n, u, locale);
  if (today < w.start_date) return { label: fmt(t.notStarted, { date: fmtD(w.start_date) }), tone: 'upcoming' as const, elapsed: 0, left };
  if (left < 0) return { label: t.expired, tone: 'expired' as const, elapsed: 100, left };
  if (left === 0) return { label: t.endsToday, tone: 'soon' as const, elapsed, left };
  if (left <= 30) return { label: fmt(t.endsSoon, { x: c(left, 'day') }), tone: 'soon' as const, elapsed, left };
  if (left < 60) return { label: fmt(t.daysLeft, { x: c(left, 'day') }), tone: 'ok' as const, elapsed, left };
  const months = Math.floor(left / 30.44);
  if (months < 12) return { label: fmt(t.monthsLeft, { x: c(months, 'month') }), tone: 'ok' as const, elapsed, left };
  const y = Math.floor(months / 12), m = months % 12;
  return { label: m ? fmt(t.yearsLeft, { y: c(y, 'year'), m: c(m, 'month') }) : fmt(t.yearsOnly, { y: c(y, 'year') }), tone: 'ok' as const, elapsed, left };
}
