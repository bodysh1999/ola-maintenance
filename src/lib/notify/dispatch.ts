import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import { getDict, fmt } from '@/lib/i18n';
import type { Locale } from '@/lib/types';
import { anyProviderConfigured, send, type Channel } from './providers';

type Claimed = {
  outbox_id: string; channel: Channel; type: string; request_id: string | null; payload: Record<string, unknown>;
  phone: string | null; email: string | null; full_name: string | null; locale: string | null; role: string | null;
};

function siteUrl() {
  const u = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
  return u.replace(/\/$/, '');
}

/** In-app link for the person receiving the message */
function linkFor(n: Claimed) {
  const base = siteUrl();
  if (!base) return '';
  if (typeof n.payload?.link === 'string' && n.payload.link.startsWith('/')) return base + n.payload.link;
  if (!n.request_id) return base;
  if (n.role === 'owner') return `${base}/owner/requests/${n.request_id}`;
  if (n.role === 'technician') return `${base}/tech`;
  return `${base}/admin/requests/${n.request_id}`;
}

export function messageFor(n: Pick<Claimed, 'type' | 'payload' | 'locale' | 'full_name'> & Partial<Claimed>, company: string) {
  const locale = (n.locale === 'en' ? 'en' : 'ar') as Locale;
  const d = getDict(locale);
  const p = n.payload ?? {};
  const tpl = (d.notif as Record<string, string>)[n.type] ?? (d.notif as Record<string, string>).status_changed;
  const extra: string[] = [];
  if (n.type === 'visit_confirmed' || n.type === 'visit_rescheduled') {
    if (typeof p.starts_at === 'string') {
      extra.push(new Date(p.starts_at).toLocaleString(locale === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB',
        { timeZone: 'Asia/Riyadh', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }));
    }
  }
  if (n.type === 'tech_on_the_way' && p.eta) extra.push(fmt(d.portal.etaMin, { n: p.eta }));
  if (n.type === 'status_changed' && typeof p.to === 'string') extra.push((d.status as Record<string, string>)[p.to] ?? '');
  if (typeof p.note === 'string' && p.note && ['status_changed', 'completed'].includes(n.type)) extra.push(p.note);
  const body = fmt(tpl, {
    ref: p.ref_no ?? p.ref ?? '', name: p.name ?? '', level: p.level ?? '', count: p.count ?? '', score: p.score ?? '', tech: p.tech ?? '', eta: p.eta ?? '',
    title: p.title ?? '', days: p.days ?? '', unit: p.unit ?? '',
    date: typeof p.end_date === 'string' ? new Date(p.end_date).toLocaleDateString(locale === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '',
  }).replace(/\s+/g, ' ').trim();
  const link = n.outbox_id !== undefined ? linkFor(n as Claimed) : '';
  const text = [`${company}: ${body}`, ...extra.filter(Boolean), link].filter(Boolean).join('\n');
  return { text, subject: `${company} — ${body}` };
}

let draining = false;

/** Sends what is waiting in the outbox. Safe to call often: it does nothing when no provider is configured. */
export async function drainOutbox(limit = 20): Promise<{ sent: number; failed: number }> {
  const result = { sent: 0, failed: 0 };
  if (!anyProviderConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY || draining) return result;
  draining = true;
  try {
    const admin = createAdminClient();
    const [{ data: rows, error }, { data: s }] = await Promise.all([
      admin.rpc('claim_outbox', { p_limit: limit }),
      admin.from('company_settings').select('name_ar, name_en').eq('id', 1).maybeSingle(),
    ]);
    if (error) { console.error('[notify] claim', error.message); return result; }
    for (const n of (rows ?? []) as Claimed[]) {
      const company = (n.locale === 'en' ? s?.name_en : s?.name_ar)?.split(' ').slice(0, 2).join(' ') || 'Ola';
      const to = n.channel === 'email' ? n.email : n.phone;
      if (!to) { await admin.rpc('finish_outbox', { p_id: n.outbox_id, p_status: 'skipped', p_error: 'NO_CONTACT' }); continue; }
      const msg = messageFor(n, company);
      const r = await send(n.channel, { to, ...msg });
      if (r.ok) result.sent++; else result.failed++;
      await admin.rpc('finish_outbox', {
        p_id: n.outbox_id,
        p_status: r.ok ? 'sent' : r.permanent ? 'skipped' : 'failed',
        p_error: r.ok ? null : r.error,
      });
    }
  } catch (e) {
    console.error('[notify]', (e as Error).message);
  } finally {
    draining = false;
  }
  return result;
}
