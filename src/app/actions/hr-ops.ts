'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { act, must, str, UserError } from '@/lib/actions';
import type { ActionResult } from '@/lib/types';

export async function setDelegation(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const delegate = str(fd, 'delegate_id'); const from = str(fd, 'start_date'); const to = str(fd, 'end_date');
    if (!delegate || !from || !to) throw new UserError(d.errors.REQUIRED);
    const supabase = await createClient();
    must(await supabase.rpc('set_delegation', { p_delegate: delegate, p_start: from, p_end: to, p_reason: str(fd, 'reason') || null }));
    revalidatePath('/me/approvals');
  });
}

export async function cancelDelegation(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('cancel_delegation', { p_id: str(fd, 'id') }));
    revalidatePath('/me/approvals');
  });
}

export async function addHoliday(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const name = str(fd, 'name_ar'); const from = str(fd, 'start_date'); const to = str(fd, 'end_date') || from;
    if (!name || !from || to < from) throw new UserError(d.errors.REQUIRED);
    const supabase = await createClient();
    must(await supabase.from('public_holidays').insert({ name_ar: name, name_en: str(fd, 'name_en') || null, start_date: from, end_date: to }));
    revalidatePath('/me/calendar');
  });
}

export async function deleteHoliday(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.from('public_holidays').delete().eq('id', str(fd, 'id')));
    revalidatePath('/me/calendar');
  });
}
