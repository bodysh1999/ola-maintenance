'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { act, must, numOrNull, str, strOrNull, UserError } from '@/lib/actions';
import { fmt } from '@/lib/i18n';
import type { ActionResult } from '@/lib/types';

const refresh = () => revalidatePath('/procurement', 'layout');

export type PurchaseItemInput = { name: string; qty: number; unit?: string };

export async function createPurchase(input: {
  title: string; description?: string; needed_by?: string; project_id?: string; rep_id?: string; quotes?: number; items: PurchaseItemInput[];
}): Promise<ActionResult & { id?: string }> {
  let id: string | undefined;
  const r = await act(async (d) => {
    const items = (input.items ?? []).filter((x) => x.name?.trim()).map((x) => ({ name: x.name.trim(), qty: Number(x.qty) || 1, unit: x.unit?.trim() || null }));
    if (!input.title?.trim()) throw new UserError(d.errors.REQUIRED);
    if (!items.length) throw new UserError(d.errors.ITEMS_REQUIRED);
    const supabase = await createClient();
    const ref = must(await supabase.rpc('create_purchase_request', {
      p_title: input.title, p_items: items, p_description: input.description || null, p_needed_by: input.needed_by || null,
      p_project: input.project_id || null, p_rep: input.rep_id || null, p_quotes: input.quotes || null,
    })) as string;
    const { data } = await supabase.from('purchase_requests').select('id').eq('ref_no', ref).maybeSingle();
    id = data?.id;
    refresh();
    return { ok: true, message: fmt(d.proc.created, { ref }) };
  });
  return { ...r, id };
}

export async function saveSupplier(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await createClient();
    must(await supabase.rpc('upsert_supplier', {
      p_id: strOrNull(fd, 'id'), p_name: str(fd, 'name'), p_category: strOrNull(fd, 'category'), p_contact: strOrNull(fd, 'contact'),
      p_phone: strOrNull(fd, 'phone'), p_email: strOrNull(fd, 'email'), p_cr: strOrNull(fd, 'cr_no'), p_vat: strOrNull(fd, 'vat_no'),
      p_notes: strOrNull(fd, 'notes'), p_active: fd.get('inactive') !== '1',
    }));
    refresh();
    return { ok: true, message: d.proc.supplierSaved };
  });
}

/** The quotation file is uploaded from the browser first (procurement/<request>/<uuid>.<ext>), then registered here */
export async function addQuote(input: {
  request_id: string; supplier_id?: string;
  new_supplier?: { name: string; phone?: string; category?: string } | null;
  amount: number; vat_included: boolean; delivery_days?: number | null; valid_until?: string | null; file?: string | null; notes?: string;
}): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await createClient();
    let supplier = input.supplier_id || null;
    if (!supplier && input.new_supplier?.name?.trim()) {
      supplier = must(await supabase.rpc('upsert_supplier', {
        p_id: null, p_name: input.new_supplier.name, p_category: input.new_supplier.category || null, p_phone: input.new_supplier.phone || null,
      })) as string;
    }
    if (!supplier) throw new UserError(d.errors.REQUIRED);
    must(await supabase.rpc('add_purchase_quote', {
      p_req: input.request_id, p_supplier: supplier, p_amount: input.amount, p_vat_included: input.vat_included,
      p_delivery_days: input.delivery_days ?? null, p_valid_until: input.valid_until || null, p_file: input.file || null, p_notes: input.notes || null,
    }));
    refresh();
    return { ok: true, message: d.proc.quoteAdded };
  });
}

export async function deleteQuote(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('delete_purchase_quote', { p_id: str(fd, 'id') }));
    refresh();
  });
}

export async function submitQuotes(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await createClient();
    must(await supabase.rpc('submit_purchase_quotes', { p_req: str(fd, 'id'), p_note: strOrNull(fd, 'note') }));
    refresh();
    return { ok: true, message: d.proc.submitted };
  });
}

export async function decidePurchase(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const action = str(fd, 'decision');
    if (!['approve', 'return', 'reject'].includes(action)) throw new UserError(d.errors.REQUIRED);
    const quote = strOrNull(fd, 'quote');
    if (action === 'approve' && !quote) throw new UserError(d.errors.REQUIRED);
    const supabase = await createClient();
    must(await supabase.rpc('decide_purchase', { p_req: str(fd, 'id'), p_action: action, p_quote: quote, p_note: strOrNull(fd, 'note') }));
    refresh();
    return { ok: true, message: d.proc.decided };
  });
}

/** Invoice uploaded from the browser first, then the purchase is confirmed here */
export async function markPurchased(input: { request_id: string; amount: number; invoice: string; note?: string }): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await createClient();
    must(await supabase.rpc('mark_purchased', { p_req: input.request_id, p_amount: input.amount, p_invoice: input.invoice, p_note: input.note || null }));
    refresh();
    return { ok: true, message: d.proc.purchasedOk };
  });
}

export async function cancelPurchase(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await createClient();
    must(await supabase.rpc('cancel_purchase_request', { p_req: str(fd, 'id'), p_note: strOrNull(fd, 'note') }));
    refresh();
    return { ok: true, message: d.proc.cancelled };
  });
}

export async function setMember(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('set_procurement_member', { p_profile: str(fd, 'profile'), p_role: str(fd, 'role') || null }));
    refresh();
  });
}

export async function saveProcSettings(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('update_procurement_settings', { p_quotes: Number(str(fd, 'quotes')) || 3, p_threshold: numOrNull(fd, 'threshold') }));
    refresh();
  });
}
