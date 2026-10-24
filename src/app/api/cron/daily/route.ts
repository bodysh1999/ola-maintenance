import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { drainOutbox } from '@/lib/notify/dispatch';

export const dynamic = 'force-dynamic';

/**
 * Daily job (Vercel Cron, see vercel.json): warranty expiry reminders + retry of unsent WhatsApp/SMS.
 * Vercel sends "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is set in the project env.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data: alerts, error } = await admin.rpc('queue_warranty_alerts');
  const { data: escalation } = await admin.rpc('escalate_requests'); // also hourly via pg_cron
  const out = await drainOutbox(100);
  // PDPL retention: delete expired visitor requests, CVs, notifications (and the CV files)
  const { data: purged, error: pErr } = await admin.rpc('purge_expired_data');
  const cvs = (purged as { cv_paths?: string[] } | null)?.cv_paths ?? [];
  if (cvs.length) await admin.storage.from('cvs').remove(cvs);
  return NextResponse.json({ warranty_alerts: alerts ?? 0, error: error?.message ?? pErr?.message ?? null, ...out, purged, escalation });
}
