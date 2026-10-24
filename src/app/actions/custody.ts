'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { act, must, numOrNull, str, UserError } from '@/lib/actions';
import { fmt } from '@/lib/i18n';
import type { ActionResult } from '@/lib/types';

const refresh = () => { revalidatePath('/me/custody', 'layout'); revalidatePath('/hr/custody', 'layout'); };

export async function requestCustody(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const amount = numOrNull(fd, 'amount');
    if (!amount) throw new UserError(d.errors.INVALID_AMOUNT);
    const supabase = await createClient();
    const ref = must(await supabase.rpc('submit_custody_request', { p_amount: amount, p_purpose: str(fd, 'purpose') }));
    refresh();
    return { ok: true, message: fmt(d.custody.submitted, { ref }) };
  });
}

/** The invoice file is uploaded from the browser first (hr-docs/<employee>/<uuid>.<ext>), then registered here */
export async function addCustodyExpense(input: {
  custody_id: string; kind: string; category: string; amount: number; date: string;
  description?: string; vendor?: string; invoice_no?: string; attachment?: string | null;
}): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await createClient();
    must(await supabase.rpc('add_custody_expense', {
      p_custody: input.custody_id, p_kind: input.kind, p_category: input.category, p_amount: input.amount, p_date: input.date,
      p_description: input.description || null, p_vendor: input.vendor || null, p_invoice_no: input.invoice_no || null, p_attachment: input.attachment || null,
    }));
    refresh();
    return { ok: true, message: d.custody.saved };
  });
}

export async function deleteCustodyExpense(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('delete_custody_expense', { p_id: str(fd, 'id') }));
    refresh();
  });
}

export async function requestSettlement(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await createClient();
    must(await supabase.rpc('request_custody_settlement', { p_custody: str(fd, 'id') }));
    refresh();
    return { ok: true, message: d.custody.settleSent };
  });
}

export async function reviewExpense(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const v = str(fd, 'decision');
    if (!['approve', 'reject'].includes(v)) throw new UserError(d.errors.REQUIRED);
    const supabase = await createClient();
    must(await supabase.rpc('review_custody_expense', { p_id: str(fd, 'id'), p_approve: v === 'approve', p_note: str(fd, 'note') || null }));
    refresh();
  });
}

export async function closeCustody(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('close_custody', { p_custody: str(fd, 'id'), p_returned: numOrNull(fd, 'returned'), p_note: str(fd, 'note') || null }));
    refresh();
  });
}

export async function saveApprovalChain(steps: { kind: string; employee_id?: string; min_amount?: number | null }[], max: number | null): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await createClient();
    const clean = steps.map((s) => ({ kind: s.kind, ...(s.kind === 'employee' ? { employee_id: s.employee_id } : {}), ...(s.min_amount ? { min_amount: s.min_amount } : {}) }));
    must(await supabase.rpc('set_approval_chain', { p_type: 'custody', p_steps: clean, p_max: max }));
    revalidatePath('/hr/custody');
    return { ok: true, message: d.custody.chainSaved };
  });
}
