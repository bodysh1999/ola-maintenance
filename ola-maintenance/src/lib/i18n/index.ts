import { ar, type Dict } from './ar';
import { en } from './en';
import type { Locale } from '../types';

export type { Dict };
export const dictionaries: Record<Locale, Dict> = { ar, en };

export function getDict(locale: Locale): Dict {
  return dictionaries[locale] ?? ar;
}

/** "{ref}" style interpolation */
export function fmt(template: string, params: Record<string, unknown> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => (params[k] == null ? '' : String(params[k])));
}

/** Maps a Postgres/Supabase error message to a translated, user-facing string */
export function translateError(d: Dict, message?: string | null): string {
  if (!message) return d.common.errorGeneric;
  const code = Object.keys(d.errors).find((k) => message.includes(k));
  if (code) return d.errors[code as keyof Dict['errors']];
  if (message.includes('duplicate key')) return d.errors.DUPLICATE;
  if (message.includes('row-level security') || message.includes('permission denied')) return d.errors.FORBIDDEN;
  return d.common.errorGeneric;
}
