'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { act, must, numOrNull, str, strOrNull, UserError } from '@/lib/actions';
import { riyadhInputToIso } from '@/lib/format';
import { PRIORITIES } from '@/lib/constants';
import type { ActionResult, Priority } from '@/lib/types';

const refresh = (id?: string) => {
  revalidatePath('/admin', 'layout');
  if (id) revalidatePath(`/admin/requests/${id}`);
};

export async function transitionRequest(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const id = str(fd, 'request_id');
    const supabase = await createClient();
    must(await supabase.rpc('transition_request', { p_id: id, p_to: str(fd, 'to'), p_note: strOrNull(fd, 'note') }));
    refresh(id);
  });
}

export async function updateTriage(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const id = str(fd, 'request_id');
    const priority = str(fd, 'priority') as Priority;
    const warranty_state = str(fd, 'warranty_state');
    if (!PRIORITIES.includes(priority) || !['in_warranty', 'out_of_warranty', 'unknown'].includes(warranty_state)) {
      throw new UserError(d.errors.REQUIRED);
    }
    const supabase = await createClient();
    must(await supabase.from('maintenance_requests')
      .update({ priority, warranty_state, warranty_note: strOrNull(fd, 'warranty_note') })
      .eq('id', id));
    refresh(id);
  });
}

export async function assignTechnician(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const id = str(fd, 'request_id');
    const tech = str(fd, 'technician_id');
    if (!tech) throw new UserError(d.errors.REQUIRED);
    const priority = str(fd, 'priority');
    const supabase = await createClient();
    must(await supabase.rpc('assign_request', {
      p_id: id,
      p_technician: tech,
      p_instructions: strOrNull(fd, 'instructions'),
      p_priority: PRIORITIES.includes(priority as Priority) ? priority : null,
      p_starts: riyadhInputToIso(str(fd, 'starts_at')),
      p_ends: riyadhInputToIso(str(fd, 'ends_at')),
    }));
    refresh(id);
  });
}

export async function scheduleVisit(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const id = str(fd, 'request_id');
    const starts = riyadhInputToIso(str(fd, 'starts_at'));
    if (!starts) throw new UserError(d.errors.REQUIRED);
    const supabase = await createClient();
    must(await supabase.rpc('schedule_visit', {
      p_id: id, p_starts: starts, p_ends: riyadhInputToIso(str(fd, 'ends_at')), p_note: strOrNull(fd, 'note'),
    }));
    refresh(id);
  });
}

export async function reviewWork(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const id = str(fd, 'request_id');
    const supabase = await createClient();
    must(await supabase.rpc('review_work', {
      p_wo: str(fd, 'work_order_id'), p_approve: str(fd, 'decision') === 'approve', p_note: strOrNull(fd, 'note'),
    }));
    refresh(id);
  });
}

export async function issueQuote(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const id = str(fd, 'request_id');
    const amount = numOrNull(fd, 'amount');
    const description = str(fd, 'description');
    if (amount === null || amount < 0 || !description) throw new UserError(d.errors.REQUIRED);
    const supabase = await createClient();
    must(await supabase.rpc('create_quote', { p_id: id, p_amount: amount, p_description: description }));
    refresh(id);
  });
}
