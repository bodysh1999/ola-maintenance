'use server';

import { randomInt } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { act, must, numOrNull, str, strOrNull, UserError } from '@/lib/actions';
import { CATEGORIES, STANDARD_WARRANTIES } from '@/lib/constants';
import type { ActionResult, Category, Role } from '@/lib/types';

// ------------------------------------------------------------------ guards
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('FORBIDDEN');
  const { data } = await supabase.from('profiles').select('role,is_active').eq('id', user.id).single();
  if (data?.role !== 'admin' || !data.is_active) throw new Error('FORBIDDEN');
  return supabase;
}

function tempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += chars[randomInt(chars.length)];
  return s + '@' + randomInt(10, 99);
}

/** Creates a Supabase Auth user. Role goes to app_metadata (not user-editable) → profile trigger. */
async function createAccount(email: string, full_name: string, phone: string | null, role: Role) {
  const admin = createAdminClient();
  const password = tempPassword();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
    user_metadata: { full_name, phone, must_change_password: true },
  });
  if (error) throw new Error(/already|registered|exists/i.test(error.message) ? 'EMAIL_EXISTS' : error.message);
  return { userId: data.user.id, password };
}

async function setAccountActive(profileId: string, active: boolean) {
  const admin = createAdminClient();
  must(await admin.from('profiles').update({ is_active: active }).eq('id', profileId));
  await admin.auth.admin.updateUserById(profileId, { ban_duration: active ? 'none' : '876000h' });
}

const r = (...paths: string[]) => paths.forEach((p) => revalidatePath(p, 'layout'));

// ------------------------------------------------------------------ projects / buildings / units
export async function createProject(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await requireAdmin();
    if (!str(fd, 'name_ar')) throw new UserError(d.errors.REQUIRED);
    must(await supabase.from('projects').insert({
      name_ar: str(fd, 'name_ar'), name_en: strOrNull(fd, 'name_en'), city: str(fd, 'city') || 'جدة',
      district: strOrNull(fd, 'district'), delivery_year: numOrNull(fd, 'delivery_year'),
      image_url: strOrNull(fd, 'image_url'), description: strOrNull(fd, 'description'),
      sales_status: ['construction', 'selling', 'sold'].includes(str(fd, 'sales_status')) ? str(fd, 'sales_status') : 'sold',
    }));
    r('/admin/projects');
    return { ok: true };
  });
}

export async function updateProject(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await requireAdmin();
    must(await supabase.from('projects').update({
      name_ar: str(fd, 'name_ar'), name_en: strOrNull(fd, 'name_en'), city: str(fd, 'city'),
      district: strOrNull(fd, 'district'), delivery_year: numOrNull(fd, 'delivery_year'),
      image_url: strOrNull(fd, 'image_url'), description: strOrNull(fd, 'description'),
    }).eq('id', str(fd, 'id')));
    r('/admin/projects');
  });
}

export async function createBuilding(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await requireAdmin();
    if (!str(fd, 'name')) throw new UserError(d.errors.REQUIRED);
    must(await supabase.from('buildings').insert({
      project_id: str(fd, 'project_id'), name: str(fd, 'name'), floors_count: numOrNull(fd, 'floors_count') ?? 1,
    }));
    r('/admin/projects');
    return { ok: true };
  });
}

export async function createUnit(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await requireAdmin();
    if (!str(fd, 'building_id') || !str(fd, 'unit_number')) throw new UserError(d.errors.REQUIRED);
    must(await supabase.from('units').insert({
      building_id: str(fd, 'building_id'), unit_number: str(fd, 'unit_number'), floor: numOrNull(fd, 'floor') ?? 0,
      unit_type: str(fd, 'unit_type') || 'apartment', area_sqm: numOrNull(fd, 'area_sqm'), bedrooms: numOrNull(fd, 'bedrooms'),
      owner_id: strOrNull(fd, 'owner_id'), handover_date: strOrNull(fd, 'handover_date'), image_url: strOrNull(fd, 'image_url'),
    }));
    r('/admin/projects', '/admin/owners');
    return { ok: true };
  });
}

export async function updateUnit(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await requireAdmin();
    must(await supabase.from('units').update({
      unit_number: str(fd, 'unit_number'), floor: numOrNull(fd, 'floor') ?? 0, unit_type: str(fd, 'unit_type'),
      area_sqm: numOrNull(fd, 'area_sqm'), bedrooms: numOrNull(fd, 'bedrooms'), owner_id: strOrNull(fd, 'owner_id'),
      handover_date: strOrNull(fd, 'handover_date'), image_url: strOrNull(fd, 'image_url'),
    }).eq('id', str(fd, 'id')));
    r('/admin/projects', '/admin/owners');
  });
}

// ------------------------------------------------------------------ warranties
export async function addWarranty(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await requireAdmin();
    const cat = str(fd, 'category');
    if (!str(fd, 'title') || !str(fd, 'start_date') || !str(fd, 'end_date')) throw new UserError(d.errors.REQUIRED);
    must(await supabase.from('warranties').insert({
      unit_id: str(fd, 'unit_id'), title: str(fd, 'title'),
      category: CATEGORIES.includes(cat as Category) ? cat : null,
      start_date: str(fd, 'start_date'), end_date: str(fd, 'end_date'),
      covered_items: strOrNull(fd, 'covered_items'), excluded_items: strOrNull(fd, 'excluded_items'),
      contractor_id: strOrNull(fd, 'contractor_id'), responsible_party: strOrNull(fd, 'responsible_party'),
    }));
    r('/admin/projects');
    return { ok: true };
  });
}

export async function applyStandardWarranties(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await requireAdmin();
    const unitId = str(fd, 'unit_id');
    const { data: unit } = await supabase.from('units').select('handover_date').eq('id', unitId).single();
    if (!unit?.handover_date) throw new UserError(d.admin.unit.needsHandover);
    const start = new Date(unit.handover_date);
    const rows = STANDARD_WARRANTIES.map((w) => {
      const end = new Date(start);
      end.setFullYear(end.getFullYear() + w.years);
      end.setDate(end.getDate() - 1);
      return {
        unit_id: unitId, category: w.category, title: w.title, start_date: unit.handover_date,
        end_date: end.toISOString().slice(0, 10), covered_items: w.covered, excluded_items: w.excluded,
        responsible_party: 'إدارة خدمات ما بعد البيع',
      };
    });
    must(await supabase.from('warranties').insert(rows));
    r('/admin/projects');
  });
}

export async function deleteWarranty(id: string) {
  const supabase = await requireAdmin();
  await supabase.from('warranties').delete().eq('id', id);
  r('/admin/projects');
}

// ------------------------------------------------------------------ owners
export async function createOwner(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await requireAdmin();
    if (!str(fd, 'full_name') || !str(fd, 'phone')) throw new UserError(d.errors.REQUIRED);
    must(await supabase.from('owners').insert({
      full_name: str(fd, 'full_name'), phone: str(fd, 'phone'),
      email: strOrNull(fd, 'email')?.toLowerCase() ?? null, notes: strOrNull(fd, 'notes'),
    }));
    r('/admin/owners');
    return { ok: true };
  });
}

export async function updateOwner(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await requireAdmin();
    must(await supabase.from('owners').update({
      full_name: str(fd, 'full_name'), phone: str(fd, 'phone'),
      email: strOrNull(fd, 'email')?.toLowerCase() ?? null, notes: strOrNull(fd, 'notes'),
    }).eq('id', str(fd, 'id')));
    r('/admin/owners');
  });
}

/** Owner activation: only after the owner is verified as linked to at least one unit. */
export async function activateOwner(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await requireAdmin();
    const id = str(fd, 'owner_id');
    const { data: owner } = await supabase.from('owners').select('*, units(id)').eq('id', id).single();
    if (!owner) throw new UserError(d.errors.FORBIDDEN);
    if (!owner.units?.length) throw new UserError(d.errors.OWNER_NEEDS_UNIT);
    if (!owner.email) throw new UserError(d.errors.OWNER_NEEDS_EMAIL);

    if (owner.profile_id) {
      await setAccountActive(owner.profile_id, true);
      must(await supabase.from('owners').update({ account_status: 'active' }).eq('id', id));
      r('/admin/owners');
      return { ok: true };
    }
    const { userId, password } = await createAccount(owner.email, owner.full_name, owner.phone, 'owner');
    must(await supabase.from('owners').update({ profile_id: userId, account_status: 'active' }).eq('id', id));
    r('/admin/owners');
    return { ok: true, data: { password, email: owner.email } };
  });
}

export async function disableOwner(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await requireAdmin();
    const id = str(fd, 'owner_id');
    const { data: owner } = await supabase.from('owners').select('profile_id').eq('id', id).single();
    must(await supabase.from('owners').update({ account_status: 'disabled' }).eq('id', id));
    if (owner?.profile_id) await setAccountActive(owner.profile_id, false);
    r('/admin/owners');
  });
}

// ------------------------------------------------------------------ technicians / contractors / staff
export async function createContractor(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await requireAdmin();
    if (!str(fd, 'name')) throw new UserError(d.errors.REQUIRED);
    must(await supabase.from('contractors').insert({
      name: str(fd, 'name'), cr_number: strOrNull(fd, 'cr_number'), contact_name: strOrNull(fd, 'contact_name'),
      phone: strOrNull(fd, 'phone'), email: strOrNull(fd, 'email'),
      specialties: fd.getAll('specialties').map(String).filter((c) => CATEGORIES.includes(c as Category)),
    }));
    r('/admin/team');
    return { ok: true };
  });
}

export async function createTechnician(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await requireAdmin();
    const email = str(fd, 'email').toLowerCase();
    const full_name = str(fd, 'full_name');
    if (!email || !full_name) throw new UserError(d.errors.REQUIRED);
    const { userId, password } = await createAccount(email, full_name, strOrNull(fd, 'phone'), 'technician');
    must(await supabase.from('technicians').insert({
      profile_id: userId, full_name, phone: strOrNull(fd, 'phone'), contractor_id: strOrNull(fd, 'contractor_id'),
      specialties: fd.getAll('specialties').map(String).filter((c) => CATEGORIES.includes(c as Category)),
    }));
    r('/admin/team');
    return { ok: true, data: { password, email } };
  });
}

export async function toggleTechnician(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await requireAdmin();
    const id = str(fd, 'technician_id');
    const active = str(fd, 'active') === 'true';
    const { data: t } = await supabase.from('technicians').select('profile_id').eq('id', id).single();
    must(await supabase.from('technicians').update({ is_active: active }).eq('id', id));
    if (t?.profile_id) await setAccountActive(t.profile_id, active);
    r('/admin/team');
  });
}

export async function createStaff(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    await requireAdmin();
    const role = str(fd, 'role') as Role;
    const email = str(fd, 'email').toLowerCase();
    if (!email || !str(fd, 'full_name') || !['admin', 'supervisor'].includes(role)) throw new UserError(d.errors.REQUIRED);
    const { password } = await createAccount(email, str(fd, 'full_name'), strOrNull(fd, 'phone'), role);
    r('/admin/team');
    return { ok: true, data: { password, email } };
  });
}

export async function toggleStaff(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await requireAdmin();
    const id = str(fd, 'profile_id');
    const { data: { user } } = await supabase.auth.getUser();
    if (id === user?.id) throw new UserError(d.errors.FORBIDDEN); // can't lock yourself out
    await setAccountActive(id, str(fd, 'active') === 'true');
    r('/admin/team');
  });
}

// ------------------------------------------------------------------ settings
export async function updateSettings(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await requireAdmin();
    const hex = (v: string, fb: string) => (/^#[0-9a-fA-F]{6}$/.test(v) ? v : fb);
    must(await supabase.from('company_settings').update({
      name_ar: str(fd, 'name_ar'), name_en: str(fd, 'name_en'),
      primary_color: hex(str(fd, 'primary_color'), '#3C2E52'), accent_color: hex(str(fd, 'accent_color'), '#B08D57'),
      support_phone: strOrNull(fd, 'support_phone'), support_email: strOrNull(fd, 'support_email'),
      whatsapp: strOrNull(fd, 'whatsapp')?.replace(/[^0-9]/g, '') || null, website_url: strOrNull(fd, 'website_url'),
      instagram_url: strOrNull(fd, 'instagram_url'), snapchat_url: strOrNull(fd, 'snapchat_url'), tiktok_url: strOrNull(fd, 'tiktok_url'),
      response_sla_hours: numOrNull(fd, 'response_sla_hours') ?? 24,
      resolution_sla_hours: numOrNull(fd, 'resolution_sla_hours') ?? 120,
      reopen_window_days: numOrNull(fd, 'reopen_window_days') ?? 30,
      notify_channels: fd.getAll('notify_channels').map(String).filter((c) => ['whatsapp', 'sms', 'email'].includes(c)),
    }).eq('id', 1));
    revalidatePath('/', 'layout');
  });
}

export async function uploadLogo(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await requireAdmin();
    const file = fd.get('logo');
    if (!(file instanceof File) || file.size === 0) throw new UserError(d.errors.REQUIRED);
    if (file.size > 1.8 * 1024 * 1024) throw new UserError(d.errors.FILE_TOO_LARGE);
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z]/g, '');
    const path = `logo-${Date.now()}.${ext}`;
    must(await supabase.storage.from('branding').upload(path, file, { contentType: file.type, upsert: true }));
    const { data } = supabase.storage.from('branding').getPublicUrl(path);
    must(await supabase.from('company_settings').update({ logo_url: data.publicUrl }).eq('id', 1));
    revalidatePath('/', 'layout');
  });
}
