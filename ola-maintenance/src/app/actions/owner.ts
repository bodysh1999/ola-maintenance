'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { act, decisionOf, must, str, strOrNull, UserError } from '@/lib/actions';
import { CATEGORIES } from '@/lib/constants';
import type { ActionResult, Category } from '@/lib/types';

/**
 * Creates a maintenance request. The DB trigger fills owner_id from the unit, evaluates the
 * warranty, sets SLA and forces status/priority for owners; RLS rejects units the caller doesn't own.
 */
export async function createRequest(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const category = str(fd, 'category') as Category;
    const unit_id = str(fd, 'unit_id');
    const location = str(fd, 'location_in_unit');
    const description = str(fd, 'description');
    if (!unit_id || !CATEGORIES.includes(category) || !location || description.length < 5) {
      throw new UserError(d.errors.REQUIRED);
    }
    const slot = str(fd, 'preferred_slot');
    const supabase = await createClient();
    const { data: unit } = await supabase.from('units').select('id, owner_id').eq('id', unit_id).maybeSingle();
    if (!unit) throw new UserError(d.errors.FORBIDDEN);

    const row = must(await supabase.from('maintenance_requests').insert({
      unit_id,
      owner_id: unit.owner_id,
      category,
      location_in_unit: location.slice(0, 120),
      description: description.slice(0, 2000),
      preferred_date: strOrNull(fd, 'preferred_date'),
      preferred_slot: ['morning', 'afternoon', 'evening'].includes(slot) ? slot : null,
    }).select('id, ref_no').single());

    revalidatePath('/owner');
    return { ok: true, data: { id: row.id, ref_no: row.ref_no } };
  });
}

export async function rateRequest(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const score = Number(str(fd, 'score'));
    if (!(score >= 1 && score <= 5)) throw new UserError(d.errors.REQUIRED);
    const supabase = await createClient();
    must(await supabase.rpc('owner_rate_request', { p_id: str(fd, 'request_id'), p_score: score, p_comment: strOrNull(fd, 'comment') }));
    revalidatePath('/owner', 'layout');
    return { ok: true, message: d.req.rated };
  });
}

export async function reopenRequest(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('owner_reopen_request', { p_id: str(fd, 'request_id'), p_reason: str(fd, 'reason') }));
    revalidatePath('/owner', 'layout');
  });
}

export async function respondQuote(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await createClient();
    must(await supabase.rpc('respond_quote', { p_quote: str(fd, 'quote_id'), p_approve: decisionOf(fd, d, 'approve', ['decline']) }));
    revalidatePath('/owner', 'layout');
  });
}
