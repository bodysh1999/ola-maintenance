'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { act, must, numOrNull, str, UserError } from '@/lib/actions';
import { getCurrentProfile, homeFor } from '@/lib/session';
import { fmt } from '@/lib/i18n';
import type { ActionResult } from '@/lib/types';

/** First sign-in / new policy version: accept the privacy policy and terms (+ optional purposes) */
export async function acceptPrivacy(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const res = await act(async (d) => {
    if (fd.get('accept') !== 'on') throw new UserError(d.privacy.consentRequired);
    const supabase = await createClient();
    must(await supabase.rpc('accept_privacy', { p_marketing: fd.get('marketing') === 'on', p_whatsapp: fd.get('whatsapp') === 'on' }));
  });
  if (res?.error) return res;
  const profile = await getCurrentProfile();
  redirect(profile ? homeFor(profile.role) : '/');
}

export async function setConsent(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('set_my_consent', { p_purpose: str(fd, 'purpose'), p_granted: str(fd, 'granted') === 'true' }));
    revalidatePath('/account/data');
  });
}

export async function submitDataRequest(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await createClient();
    const ref = must(await supabase.rpc('submit_data_request', { p_type: str(fd, 'type'), p_details: str(fd, 'details') || null }));
    revalidatePath('/account/data');
    return { ok: true, message: fmt(d.privacy.requestSent, { ref }) };
  });
}

// ------------------------------------------------------------------ admin
export async function handleDataRequest(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('handle_data_request', { p_id: str(fd, 'id'), p_status: str(fd, 'status'), p_response: str(fd, 'response') || null }));
    revalidatePath('/admin/privacy');
  });
}

export async function eraseVisitor(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await createClient();
    const r = must(await supabase.rpc('erase_public_subject', { p_email: str(fd, 'email') || null, p_phone: str(fd, 'phone') || null })) as
      { leads: number; applications: number; cv_paths: string[] };
    if (r.cv_paths?.length && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await createAdminClient().storage.from('cvs').remove(r.cv_paths);
    }
    revalidatePath('/admin/privacy');
    return { ok: true, message: fmt(d.privacy.erased, { leads: r.leads, apps: r.applications }) };
  });
}

export async function updatePrivacySettings(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('update_privacy_settings', {
      p_dpo_name: str(fd, 'dpo_name'), p_dpo_email: str(fd, 'dpo_email'), p_region: str(fd, 'region'),
      p_cv_months: numOrNull(fd, 'cv_months'), p_leads_months: numOrNull(fd, 'leads_months'), p_notif_days: numOrNull(fd, 'notif_days'),
      p_require_mfa: fd.get('require_mfa') === 'on', p_bump_version: fd.get('bump_version') === 'on',
    }));
    revalidatePath('/', 'layout');
  });
}
