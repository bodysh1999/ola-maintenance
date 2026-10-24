'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { act, must, numOrNull, str, strOrNull, UserError } from '@/lib/actions';
import type { ActionResult } from '@/lib/types';
import { LEAD_STATUSES } from '@/lib/sales-hr';


/** Only active admin / sales accounts; the database policies check the same thing again */
async function requireSales() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('FORBIDDEN');
  const { data } = await supabase.from('profiles').select('role,is_active').eq('id', user.id).single();
  if (!data?.is_active || !['admin', 'sales'].includes(data.role)) throw new Error('FORBIDDEN');
  return supabase;
}

export async function updateLead(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await requireSales();
    const status = str(fd, 'status');
    must(await supabase.from('leads').update({
      ...((LEAD_STATUSES as readonly string[]).includes(status) ? { status } : {}),
      assigned_to: strOrNull(fd, 'assigned_to'),
      follow_up_at: strOrNull(fd, 'follow_up_at'),
      internal_notes: strOrNull(fd, 'internal_notes'),
    }).eq('id', str(fd, 'id')));
    revalidatePath('/sales', 'layout');
  });
}

/** Booking lead → mark the unit reserved (hidden from new bookings) and the lead booked */
export async function reserveLeadUnit(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await requireSales();
    const { data: lead } = await supabase.from('leads').select('id, unit_id').eq('id', str(fd, 'id')).single();
    if (!lead?.unit_id) throw new UserError(d.errors.UNIT_REQUIRED);
    const { data: unit } = await supabase.from('units').select('sale_status').eq('id', lead.unit_id).single();
    if (unit?.sale_status !== 'available') throw new UserError(d.errors.UNIT_NOT_AVAILABLE);
    must(await supabase.from('units').update({ sale_status: 'reserved' }).eq('id', lead.unit_id));
    must(await supabase.from('leads').update({ status: 'booked' }).eq('id', lead.id));
    revalidatePath('/sales', 'layout');
  });
}

export async function updateUnitSale(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await requireSales();
    const st = str(fd, 'sale_status');
    must(await supabase.from('units').update({
      price: numOrNull(fd, 'price'),
      ...(['available', 'reserved', 'sold', 'not_for_sale'].includes(st) ? { sale_status: st } : {}),
    }).eq('id', str(fd, 'id')));
    revalidatePath('/sales/units');
  });
}

/** Kanban drag & drop: move a lead to another stage (optionally assign it) */
export async function moveLead(id: string, status: string): Promise<ActionResult> {
  return act(async (d) => {
    if (!(LEAD_STATUSES as readonly string[]).includes(status)) throw new UserError(d.errors.REQUIRED);
    const supabase = await requireSales();
    must(await supabase.from('leads').update({ status }).eq('id', id));
    revalidatePath('/sales', 'layout');
  });
}
