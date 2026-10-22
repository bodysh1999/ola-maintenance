'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { act, must, numOrNull, str, UserError } from '@/lib/actions';
import type { ActionResult } from '@/lib/types';

const refresh = () => revalidatePath('/tech', 'layout');

export async function startWork(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('tech_start_work', { p_wo: str(fd, 'work_order_id') }));
    refresh();
  });
}

export async function markAwaitingParts(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('tech_awaiting_parts', { p_wo: str(fd, 'work_order_id'), p_note: str(fd, 'note') }));
    refresh();
  });
}

export async function submitWork(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('tech_submit_work', { p_wo: str(fd, 'work_order_id'), p_notes: str(fd, 'notes') }));
    refresh();
  });
}

export async function addPart(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const name = str(fd, 'name');
    const quantity = numOrNull(fd, 'quantity') ?? 1;
    const unit_cost = numOrNull(fd, 'unit_cost') ?? 0;
    if (!name || quantity <= 0 || unit_cost < 0) throw new UserError(d.errors.REQUIRED);
    const supabase = await createClient();
    must(await supabase.from('work_order_parts').insert({ work_order_id: str(fd, 'work_order_id'), name, quantity, unit_cost }));
    refresh();
    revalidatePath('/admin', 'layout');
    return { ok: true };
  });
}

export async function deletePart(id: string) {
  const supabase = await createClient();
  await supabase.from('work_order_parts').delete().eq('id', id);
  refresh();
  revalidatePath('/admin', 'layout');
}
