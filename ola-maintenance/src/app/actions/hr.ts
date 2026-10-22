'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { act, must, str, strOrNull, UserError } from '@/lib/actions';
import { createLoginAccount } from '@/lib/accounts';
import type { ActionResult } from '@/lib/types';
import { APPLICATION_STATUSES } from '@/lib/sales-hr';

const EMPLOYMENT = ['full_time', 'part_time', 'contract', 'training'];

async function requireHr() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('FORBIDDEN');
  const { data } = await supabase.from('profiles').select('role,is_active').eq('id', user.id).single();
  if (!data?.is_active || !['admin', 'hr'].includes(data.role)) throw new Error('FORBIDDEN');
  return supabase;
}

export async function updateApplication(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await requireHr();
    const status = str(fd, 'status');
    must(await supabase.from('job_applications').update({
      ...((APPLICATION_STATUSES as readonly string[]).includes(status) ? { status } : {}),
      internal_notes: strOrNull(fd, 'internal_notes'),
    }).eq('id', str(fd, 'id')));
    revalidatePath('/hr', 'layout');
  });
}

export async function createOpening(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await requireHr();
    if (!str(fd, 'title')) throw new UserError(d.errors.REQUIRED);
    must(await supabase.from('job_openings').insert({
      title: str(fd, 'title'), department: strOrNull(fd, 'department'), location: str(fd, 'location') || 'جدة',
      employment: EMPLOYMENT.includes(str(fd, 'employment')) ? str(fd, 'employment') : 'full_time',
      description: strOrNull(fd, 'description'), requirements: strOrNull(fd, 'requirements'),
    }));
    revalidatePath('/hr/openings');
    return { ok: true };
  });
}

export async function toggleOpening(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await requireHr();
    must(await supabase.from('job_openings').update({ is_open: str(fd, 'open') === 'true' }).eq('id', str(fd, 'id')));
    revalidatePath('/hr/openings');
  });
}

// ================================================================== employees (HR self-service module)
const strOrNullX = (fd: FormData, k: string) => { const v = fd.get(k); return typeof v === 'string' && v.trim() ? v.trim() : null; };
const num = (fd: FormData, k: string, def = 0) => { const v = Number(fd.get(k)); return Number.isFinite(v) && String(fd.get(k) ?? '').trim() !== '' ? v : def; };

export async function saveEmployee(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await requireHr();
    const id = str(fd, 'id');
    if (!str(fd, 'full_name') || !str(fd, 'job_title') || !str(fd, 'hire_date')) throw new UserError(d.errors.REQUIRED);
    const row = {
      full_name: str(fd, 'full_name'), full_name_en: strOrNullX(fd, 'full_name_en'), email: strOrNullX(fd, 'email')?.toLowerCase() ?? null,
      phone: strOrNullX(fd, 'phone'), job_title: str(fd, 'job_title'), department_id: strOrNullX(fd, 'department_id'),
      manager_id: strOrNullX(fd, 'manager_id'), nationality_type: str(fd, 'nationality_type') === 'resident' ? 'resident' : 'saudi',
      nationality: strOrNullX(fd, 'nationality'), gender: str(fd, 'gender') === 'female' ? 'female' : 'male',
      hire_date: str(fd, 'hire_date'), contract_type: str(fd, 'contract_type') === 'fixed' ? 'fixed' : 'unlimited',
      contract_end: strOrNullX(fd, 'contract_end'), annual_leave_days: Math.max(21, num(fd, 'annual_leave_days', 21)),
      leave_opening_balance: num(fd, 'leave_opening_balance', 0), leave_accrual_start: strOrNullX(fd, 'leave_accrual_start'),
      work_location_id: strOrNullX(fd, 'work_location_id'), remote_allowed: fd.get('remote_allowed') === 'on',
      work_start: str(fd, 'work_start') || '08:00', work_end: str(fd, 'work_end') || '17:00',
      status: ['active', 'suspended', 'terminated'].includes(str(fd, 'status')) ? str(fd, 'status') : 'active',
    };
    if (id && row.manager_id === id) throw new UserError(d.errors.INVALID_TRANSITION);
    if (id) {
      must(await supabase.from('employees').update(row).eq('id', id));
      revalidatePath('/hr', 'layout');
      return { ok: true };
    }
    const created = must(await supabase.from('employees').insert(row).select('id').single());
    revalidatePath('/hr', 'layout');
    return { ok: true, data: { id: created.id } };
  });
}

export async function saveSalary(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await requireHr();
    const gr = str(fd, 'gosi_rate');
    must(await supabase.from('employee_salaries').upsert({
      employee_id: str(fd, 'employee_id'), basic: num(fd, 'basic'), housing: num(fd, 'housing'), transport: num(fd, 'transport'),
      other_allowances: num(fd, 'other_allowances'), other_deductions: num(fd, 'other_deductions'),
      gosi_rate: gr === '' ? null : Number(gr), updated_at: new Date().toISOString(),
    }));
    revalidatePath('/hr', 'layout');
  });
}

export async function savePrivate(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await requireHr();
    must(await supabase.from('employee_private').upsert({
      employee_id: str(fd, 'employee_id'), id_number: strOrNullX(fd, 'id_number'), id_expiry: strOrNullX(fd, 'id_expiry'),
      birth_date: strOrNullX(fd, 'birth_date'), iban: strOrNullX(fd, 'iban')?.replace(/\s+/g, '').toUpperCase() ?? null, bank_name: strOrNullX(fd, 'bank_name'),
    }));
    revalidatePath('/hr', 'layout');
  });
}

/** Login for an employee who has no system account yet (role: employee — self-service only) */
export async function createEmployeeAccount(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await requireHr();
    const { data: e } = await supabase.from('employees').select('id, full_name, email, phone, profile_id').eq('id', str(fd, 'employee_id')).single();
    if (!e?.email) throw new UserError(d.errors.OWNER_NEEDS_EMAIL);
    if (e.profile_id) throw new UserError(d.errors.DUPLICATE);
    const { userId, password } = await createLoginAccount(e.email, e.full_name, e.phone, 'employee');
    must(await supabase.from('employees').update({ profile_id: userId }).eq('id', e.id));
    revalidatePath('/hr', 'layout');
    return { ok: true, data: { password, email: e.email } };
  });
}

/** Link to an existing staff account (technician, sales, supervisor…) */
export async function linkEmployeeProfile(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await requireHr();
    must(await supabase.from('employees').update({ profile_id: strOrNullX(fd, 'profile_id') }).eq('id', str(fd, 'employee_id')));
    revalidatePath('/hr', 'layout');
  });
}

export async function saveLocation(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await requireHr();
    const lat = Number(fd.get('lat')), lng = Number(fd.get('lng'));
    if (!str(fd, 'name') || !Number.isFinite(lat) || !Number.isFinite(lng)) throw new UserError(d.errors.REQUIRED);
    const row = { name: str(fd, 'name'), lat, lng, radius_m: Math.min(5000, Math.max(20, num(fd, 'radius_m', 150))), is_active: fd.get('is_active') !== 'off' };
    const id = str(fd, 'id');
    must(id ? await supabase.from('work_locations').update(row).eq('id', id) : await supabase.from('work_locations').insert(row));
    revalidatePath('/hr', 'layout');
    return { ok: true };
  });
}

export async function saveDepartment(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await requireHr();
    if (!str(fd, 'name')) throw new UserError(d.errors.REQUIRED);
    const row = { name: str(fd, 'name'), parent_id: strOrNullX(fd, 'parent_id'), manager_employee_id: strOrNullX(fd, 'manager_employee_id') };
    const id = str(fd, 'id');
    must(id ? await supabase.from('departments').update(row).eq('id', id) : await supabase.from('departments').insert(row));
    revalidatePath('/hr', 'layout');
    return { ok: true };
  });
}

export async function updateLeaveType(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await requireHr();
    const md = str(fd, 'max_days');
    must(await supabase.from('leave_types').update({ max_days: md === '' ? null : Number(md), is_active: fd.get('is_active') === 'on' }).eq('code', str(fd, 'code')));
    revalidatePath('/hr', 'layout');
  });
}

export async function updateHrSettings(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await requireHr();
    // signature image → public branding bucket (random name), uploaded server-side with the service key
    let signatureUrl: string | null = null;
    const file = fd.get('signature');
    if (file instanceof File && file.size > 0) {
      const ext = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as Record<string, string>)[file.type];
      if (!ext || file.size > 1024 * 1024) throw new UserError(d.errors.INVALID_FILE);
      const admin = createAdminClient();
      const path = `signatures/${randomUUID()}.${ext}`;
      const { error: upErr } = await admin.storage.from('branding').upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw new Error(upErr.message);
      signatureUrl = admin.storage.from('branding').getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabase.rpc('update_hr_settings', {
      p_gosi_saudi: num(fd, 'gosi_saudi_rate', 9.75), p_gosi_resident: num(fd, 'gosi_resident_rate', 0),
      p_per_diem: num(fd, 'trip_per_diem', 500), p_signatory: str(fd, 'hr_letter_signatory'),
      p_signatory_title: str(fd, 'hr_signatory_title') || null, p_signature_url: signatureUrl,
      p_clear_signature: fd.get('clear_signature') === 'on',
    });
    if (error) throw new Error(error.message);
    revalidatePath('/', 'layout');
  });
}
