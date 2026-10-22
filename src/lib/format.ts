import type { Locale } from './types';

const tz = 'Asia/Riyadh';
const loc = (l: Locale) => (l === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB');

export function fmtDate(value: string | Date | null | undefined, l: Locale): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(loc(l), { day: 'numeric', month: 'short', year: 'numeric', timeZone: tz }).format(new Date(value));
}

export function fmtDateTime(value: string | Date | null | undefined, l: Locale): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(loc(l), {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: tz,
  }).format(new Date(value));
}

export function fmtVisit(value: string | null | undefined, l: Locale): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(loc(l), {
    weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: tz,
  }).format(new Date(value));
}

export function fmtRelative(value: string | null | undefined, l: Locale): string {
  if (!value) return '';
  const diff = (new Date(value).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(l === 'ar' ? 'ar' : 'en', { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return fmtDate(value, l);
}

export function fmtMoney(n: number | string | null | undefined, l: Locale): string {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat(l === 'ar' ? 'ar-SA-u-nu-latn' : 'en-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 2 }).format(v);
}

export function fmtNum(n: number | string | null | undefined, digits = 0): string {
  if (n === null || n === undefined || n === '') return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(Number(n));
}

export function hexToRgbTriplet(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** Local datetime-input value (Asia/Riyadh, UTC+3) → ISO */
export function riyadhInputToIso(v: string | null | undefined): string | null {
  if (!v) return null;
  return new Date(`${v}:00+03:00`).toISOString();
}

export function isoToRiyadhInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + 3 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}

export function todayRiyadh(offsetDays = 0): string {
  const d = new Date(Date.now() + 3 * 3600 * 1000 + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}
