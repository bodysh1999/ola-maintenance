'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { siteOrigin } from '@/lib/origin';
import { act, must, str, UserError } from '@/lib/actions';
import { getI18n, homeFor } from '@/lib/session';
import type { ActionResult, Role } from '@/lib/types';

export async function setLocale(locale: 'ar' | 'en') {
  (await cookies()).set('locale', locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await supabase.from('profiles').update({ locale }).eq('id', user.id);
  revalidatePath('/', 'layout');
}

export async function signIn(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { d } = await getI18n();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: str(fd, 'email'), password: str(fd, 'password') });
  if (error || !data.user) {
    // show the real reason instead of always "wrong email or password"
    const code = (error as { code?: string } | null)?.code ?? '';
    const msg = error?.message ?? '';
    console.error('[signIn]', code, error?.status, msg);
    if (code === 'email_not_confirmed' || /not confirmed/i.test(msg)) return { error: d.auth.notConfirmed };
    if (code.includes('rate_limit') || error?.status === 429) return { error: d.auth.rateLimited };
    if ((error?.status ?? 0) >= 500 || /database error/i.test(msg)) return { error: d.auth.serverError };
    return { error: d.auth.invalid };
  }

  const { data: profile } = await supabase.from('profiles').select('role,is_active,locale').eq('id', data.user.id).maybeSingle();
  if (!profile?.is_active) {
    await supabase.auth.signOut();
    return { error: d.auth.disabled };
  }
  (await cookies()).set('locale', profile.locale ?? 'ar', { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  redirect(homeFor(profile.role as Role));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function requestPasswordReset(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { d } = await getI18n();
  const supabase = await createClient();
  const origin = await siteOrigin();
  await supabase.auth.resetPasswordForEmail(str(fd, 'email'), { redirectTo: `${origin}/auth/callback?next=/account/password` });
  return { ok: true, message: d.auth.resetSent }; // same answer whether or not the email exists
}

export async function updatePassword(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const p1 = str(fd, 'password');
    if (p1.length < 8) throw new UserError(d.auth.tooShort);
    if (p1 !== str(fd, 'confirm')) throw new UserError(d.auth.mismatch);
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password: p1, data: { must_change_password: false } });
    if (error) throw new UserError(error.message);
    const { data: { user } } = await supabase.auth.getUser();
    // the flag lives in app_metadata (users cannot edit it); only the server clears it after a real change
    if (user?.app_metadata?.must_change_password && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await createAdminClient().auth.admin.updateUserById(user.id, { app_metadata: { must_change_password: false } });
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
    redirect(homeFor(profile!.role as Role));
  });
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
  revalidatePath('/', 'layout');
}

export async function markNotificationRead(id: string) {
  const supabase = await createClient();
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null);
}

/** Owners, staff and technicians can add notes to requests they can see (RLS decides). */
export async function addNote(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const body = str(fd, 'body');
    if (!body) throw new UserError(d.errors.REQUIRED);
    const supabase = await createClient();
    must(await supabase.from('request_notes').insert({
      request_id: str(fd, 'request_id'),
      body,
      is_internal: fd.get('is_internal') === 'on',
    }));
    revalidatePath('/', 'layout');
    return { ok: true };
  });
}

/** Records attachment rows after the browser uploaded files directly to Storage. */
export async function registerAttachments(rows: { request_id: string; work_order_id?: string | null; kind: string; storage_path: string; file_name: string; mime_type: string; size_bytes: number }[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('attachments').insert(rows.map((r) => ({ ...r, uploaded_by: user?.id })));
  if (error) {
    // roll back orphaned files the user just uploaded
    await supabase.storage.from('attachments').remove(rows.map((r) => r.storage_path));
    return { error: error.message };
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function deleteAttachment(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('attachments').select('storage_path').eq('id', id).maybeSingle();
  if (!data) return { error: 'NOT_FOUND' };
  const { error } = await supabase.from('attachments').delete().eq('id', id);
  if (error) return { error: error.message };
  await supabase.storage.from('attachments').remove([data.storage_path]);
  revalidatePath('/', 'layout');
  return { ok: true };
}
