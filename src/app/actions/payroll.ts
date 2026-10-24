'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { act, must, numOrNull, str, UserError } from '@/lib/actions';
import type { ActionResult } from '@/lib/types';

export async function generatePayroll(_: ActionResult, fd: FormData): Promise<ActionResult> {
  let id: string | null = null;
  const res = await act(async (d) => {
    const period = str(fd, 'period');
    if (!/^\d{4}-\d{2}$/.test(period)) throw new UserError(d.errors.INVALID_DATE);
    const supabase = await createClient();
    id = must(await supabase.rpc('generate_payroll', { p_period: period, p_include_absence: fd.get('include_absence') === 'on' })) as string;
    revalidatePath('/hr/payroll', 'layout');
    return { ok: true, message: d.payroll.generated };
  });
  if (res?.error || !id || fd.get('stay') === '1') return res;
  redirect(`/hr/payroll/${id}`);
}

export async function updatePayrollLine(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('update_payroll_line', { p_line: str(fd, 'id'), p_manual: numOrNull(fd, 'manual') ?? 0, p_note: str(fd, 'note') || null }));
    revalidatePath('/hr/payroll', 'layout');
  });
}

export async function addPayrollAdjustment(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('add_payroll_adjustment', {
      p_period: str(fd, 'period'), p_employee: str(fd, 'employee_id'), p_kind: str(fd, 'kind'), p_amount: numOrNull(fd, 'amount'), p_reason: str(fd, 'reason'),
    }));
    revalidatePath('/hr/payroll', 'layout');
  });
}

export async function deletePayrollAdjustment(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('delete_payroll_adjustment', { p_id: str(fd, 'id') }));
    revalidatePath('/hr/payroll', 'layout');
  });
}

export async function setPayrollStatus(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const status = str(fd, 'decision');
    if (!['approved', 'paid', 'draft'].includes(status)) throw new UserError(d.errors.REQUIRED);
    const supabase = await createClient();
    must(await supabase.rpc('set_payroll_status', { p_run: str(fd, 'id'), p_status: status }));
    revalidatePath('/hr/payroll', 'layout');
  });
}

export async function savePayrollSettings(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('update_payroll_settings', {
      p_absence: fd.get('absence') === 'on', p_late: fd.get('late') === 'on', p_grace: numOrNull(fd, 'grace'), p_day_hours: numOrNull(fd, 'day_hours'),
    }));
    revalidatePath('/hr/payroll');
  });
}
