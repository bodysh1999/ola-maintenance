import 'server-only';
import { after } from 'next/server';
import { getI18n } from './session';
import { drainOutbox } from './notify/dispatch';
import { anyProviderConfigured } from './notify/providers';
import { translateError, type Dict } from './i18n';
import type { ActionResult } from './types';

/** Throws if a Supabase response carries an error */
export function must<D>(res: { data: D; error: unknown }): NonNullable<D> {
  const err = res.error as { message?: string } | null;
  if (err) throw new Error(err.message ?? 'error');
  return res.data as NonNullable<D>;
}

export class UserError extends Error {}

/** Wraps a server action body: translates DB errors into user-facing messages. */
export async function act(fn: (d: Dict) => Promise<ActionResult | void>): Promise<ActionResult> {
  const { d } = await getI18n();
  try {
    const r = await fn(d);
    // any change may have queued WhatsApp / SMS messages — send them after the response
    if (anyProviderConfigured()) after(() => drainOutbox().then(() => undefined));
    return r ?? { ok: true, message: d.common.saved };
  } catch (e) {
    const digest = (e as { digest?: string })?.digest;
    if (typeof digest === 'string' && digest.startsWith('NEXT_')) throw e; // redirect / notFound
    const message = e instanceof Error ? e.message : String(e);
    if (e instanceof UserError) return { error: message };
    console.error('[action]', message);
    return { error: translateError(d, message) };
  }
}

export const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' ? v.trim() : '';
};
export const strOrNull = (fd: FormData, k: string) => str(fd, k) || null;
export const numOrNull = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return v === '' || Number.isNaN(Number(v)) ? null : Number(v);
};

/** Approve/reject choice from a form — never defaults to "reject" when the value is missing */
export const decisionOf = (fd: FormData, d: Dict, approve = 'approve', reject: string[] = ['reject']) => {
  const v = str(fd, 'decision');
  if (v === approve) return true;
  if (reject.includes(v)) return false;
  throw new UserError(d.errors.REQUIRED);
};
