'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { act, must, numOrNull, str, strOrNull, UserError } from '@/lib/actions';
import { send, providerFor, type Channel } from '@/lib/notify/providers';
import type { ActionResult } from '@/lib/types';

const DOC_KINDS = ['sale_contract', 'title_deed', 'handover_report', 'drawings', 'manual', 'warranty_cert', 'other'] as const;

async function myRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('FORBIDDEN');
  const { data } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).single();
  if (!data?.is_active) throw new Error('FORBIDDEN');
  return { supabase, role: data.role as string, userId: user.id };
}

// ------------------------------------------------------------------ unit documents (staff)
/** Records a document row after the browser uploaded the file to the private "unit-docs" bucket. */
export async function registerUnitDocument(row: {
  unit_id: string; kind: string; title: string; storage_path: string; file_name: string; mime_type: string; size_bytes: number;
}): Promise<ActionResult> {
  return act(async (d) => {
    const { supabase, role } = await myRole();
    if (!['admin', 'supervisor'].includes(role)) throw new UserError(d.errors.FORBIDDEN);
    if (!row.title.trim() || !row.storage_path.startsWith(`${row.unit_id}/`)) throw new UserError(d.errors.REQUIRED);
    must(await supabase.from('unit_documents').insert({
      unit_id: row.unit_id,
      kind: (DOC_KINDS as readonly string[]).includes(row.kind) ? row.kind : 'other',
      title: row.title.trim().slice(0, 160),
      storage_path: row.storage_path, file_name: row.file_name.slice(0, 180),
      mime_type: row.mime_type || null, size_bytes: row.size_bytes,
    }));
    revalidatePath(`/admin/units/${row.unit_id}`);
    revalidatePath('/owner', 'layout');
    return { ok: true, message: d.portal.uploaded };
  });
}

export async function deleteUnitDocument(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const { supabase, role } = await myRole();
    if (!['admin', 'supervisor'].includes(role)) throw new UserError(d.errors.FORBIDDEN);
    const { data: doc } = await supabase.from('unit_documents').select('id, unit_id, storage_path').eq('id', str(fd, 'id')).maybeSingle();
    if (!doc) throw new UserError(d.errors.FORBIDDEN);
    await supabase.storage.from('unit-docs').remove([doc.storage_path]);
    must(await supabase.from('unit_documents').delete().eq('id', doc.id));
    revalidatePath(`/admin/units/${doc.unit_id}`);
    revalidatePath('/owner', 'layout');
    return { ok: true };
  });
}

// ------------------------------------------------------------------ live tracking
export async function techOnTheWay(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await createClient();
    const eta = numOrNull(fd, 'eta');
    must(await supabase.rpc('tech_on_the_way', { p_wo: str(fd, 'work_order_id'), p_eta: eta && eta > 0 ? Math.round(eta) : null }));
    revalidatePath('/tech', 'layout');
    return { ok: true, message: d.portal.onWaySent };
  });
}

export async function ownerConfirmVisit(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('owner_confirm_visit', { p_id: str(fd, 'request_id') }));
    revalidatePath(`/owner/requests/${str(fd, 'request_id')}`);
  });
}

export async function ownerRequestReschedule(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const note = str(fd, 'note');
    if (!note) throw new UserError(d.errors.NOTE_REQUIRED);
    const supabase = await createClient();
    must(await supabase.rpc('owner_request_reschedule', { p_id: str(fd, 'request_id'), p_note: note }));
    revalidatePath(`/owner/requests/${str(fd, 'request_id')}`);
    return { ok: true, message: d.portal.changeSent };
  });
}

// ------------------------------------------------------------------ outside messages
export async function setNotifyExternal(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const { supabase, userId } = await myRole();
    must(await supabase.from('profiles').update({ notify_external: str(fd, 'on') === 'true' }).eq('id', userId));
    revalidatePath('/owner');
  });
}

export async function uploadTechnicianPhoto(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const { supabase, role } = await myRole();
    if (role !== 'admin') throw new UserError(d.errors.FORBIDDEN);
    const file = fd.get('photo');
    if (!(file instanceof File) || file.size === 0) throw new UserError(d.errors.REQUIRED);
    if (file.size > 3 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new UserError(d.errors.FILE_TOO_LARGE);
    const id = str(fd, 'technician_id');
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `technicians/${id}-${Date.now()}.${ext}`;
    must(await supabase.storage.from('branding').upload(path, file, { contentType: file.type, upsert: false }));
    const url = supabase.storage.from('branding').getPublicUrl(path).data.publicUrl;
    must(await supabase.from('technicians').update({ photo_url: url }).eq('id', id));
    revalidatePath('/admin/team');
    return { ok: true };
  });
}

export async function sendTestMessage(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const { role } = await myRole();
    if (role !== 'admin') throw new UserError(d.errors.FORBIDDEN);
    const channel = str(fd, 'channel') as Channel;
    const to = strOrNull(fd, 'to');
    if (!to || !['sms', 'whatsapp', 'email'].includes(channel)) throw new UserError(d.errors.REQUIRED);
    if (!providerFor(channel)) throw new UserError(d.portal.notConfigured);
    const r = await send(channel, { to, text: 'رسالة تجريبية من نظام علا التميز ✅', subject: 'رسالة تجريبية' });
    if (!r.ok) throw new UserError(r.error);
    return { ok: true, message: d.portal.testSent };
  });
}
