'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { act, decisionOf, str, UserError } from '@/lib/actions';
import { HR_REQUEST_TYPES } from '@/lib/hr';
import type { ActionResult } from '@/lib/types';

/** GPS check-in/out — the database checks the distance to the work site */
export async function punch(kind: 'in' | 'out', lat: number, lng: number, accuracy: number | null): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('attendance_punch', { p_kind: kind, p_lat: lat, p_lng: lng, p_accuracy: accuracy });
    if (error) throw new Error(error.message + (error.details ? `|${error.details}` : ''));
    revalidatePath('/me', 'layout');
    return { ok: true, data: data as Record<string, unknown> };
  });
}

const FIELDS = ['leave_type', 'start_date', 'end_date', 'work_date', 'time_in', 'time_out', 'hours', 'destination', 'amount',
  'addressed_to', 'lat', 'lng', 'accuracy_m', 'reason', 'attachment_path'];

export async function submitHrRequest(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const type = str(fd, 'type');
    if (!(HR_REQUEST_TYPES as readonly string[]).includes(type)) throw new UserError(d.errors.REQUIRED);
    const p: Record<string, string> = { type };
    for (const k of FIELDS) { const v = str(fd, k); if (v) p[k] = v; }
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('submit_hr_request', { p });
    if (error) throw new Error(error.message);
    revalidatePath('/me', 'layout');
    const { data: row } = await supabase.from('hr_requests').select('id').eq('ref_no', data as string).single();
    return { ok: true, data: { ref: data as string, id: row?.id } };
  });
}

export async function decideHrRequest(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await createClient();
    const { error } = await supabase.rpc('decide_hr_request', {
      p_id: str(fd, 'id'), p_approve: decisionOf(fd, d), p_comment: str(fd, 'comment') || null,
    });
    if (error) throw new Error(error.message);
    revalidatePath('/me', 'layout');
    revalidatePath('/hr', 'layout');
  });
}

export async function cancelHrRequest(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    const { error } = await supabase.rpc('cancel_hr_request', { p_id: str(fd, 'id') });
    if (error) throw new Error(error.message);
    revalidatePath('/me', 'layout');
  });
}
