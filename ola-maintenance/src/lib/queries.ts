import 'server-only';
import { createClient } from './supabase/server';
import { withSignedUrls, type NoteRow } from '@/components/request-parts';
import { MAIN_STAGES } from './constants';
import type { ActivityLog, Attachment, RequestOverview, RequestStatus } from './types';

export type Quote = { id: string; amount: number; vat_rate: number; description: string; status: 'pending' | 'approved' | 'declined' | 'cancelled'; created_at: string; responded_at: string | null };
export type Part = { id: string; name: string; quantity: number; unit_cost: number; created_at: string };
export type WorkOrder = {
  id: string; status: string; instructions: string | null; tech_notes: string | null; review_note: string | null;
  started_at: string | null; submitted_at: string | null; reviewed_at: string | null; created_at: string;
  technician_id: string; technicians: { full_name: string; phone: string | null } | null;
  work_order_parts: Part[];
};

/** Everything a request page needs. RLS decides what the caller can actually see. */
export async function loadRequest(id: string) {
  const supabase = await createClient();
  const { data: r } = await supabase.from('request_overview').select('*').eq('id', id).maybeSingle();
  if (!r) return null;

  // opening a request marks its notifications as read (own rows only — RLS)
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('request_id', id).is('read_at', null);

  const [logs, atts, notes, quotes, rating, wos] = await Promise.all([
    supabase.from('activity_logs').select('*').eq('request_id', id).order('created_at', { ascending: true }),
    supabase.from('attachments').select('*').eq('request_id', id).order('created_at'),
    supabase.from('request_notes').select('*').eq('request_id', id).order('created_at'),
    supabase.from('quotes').select('*').eq('request_id', id).order('created_at', { ascending: false }),
    supabase.from('ratings').select('score, comment, created_at').eq('request_id', id).maybeSingle(),
    supabase.from('work_orders')
      .select('*, technicians(full_name, phone), work_order_parts(id, name, quantity, unit_cost, created_at)')
      .eq('request_id', id).neq('status', 'cancelled').order('created_at', { ascending: false }),
  ]);

  const activityLogs = (logs.data ?? []) as ActivityLog[];
  const request = r as RequestOverview;
  const lastMain = [...activityLogs].reverse().find((l) => l.to_status && MAIN_STAGES.includes(l.to_status))?.to_status ?? null;

  return {
    request,
    logs: activityLogs,
    attachments: await withSignedUrls((atts.data ?? []) as Attachment[]),
    notes: (notes.data ?? []) as NoteRow[],
    quotes: (quotes.data ?? []) as Quote[],
    rating: rating.data as { score: number; comment: string | null; created_at: string } | null,
    workOrders: (wos.data ?? []) as unknown as WorkOrder[],
    lastMainStatus: lastMain as RequestStatus | null,
  };
}

export const partsTotal = (parts: Part[]) => parts.reduce((s, p) => s + Number(p.quantity) * Number(p.unit_cost), 0);
