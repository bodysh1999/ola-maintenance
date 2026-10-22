'use server';

import { act, numOrNull, str, strOrNull, UserError } from '@/lib/actions';
import { anonClient } from '@/lib/public-data';
import type { ActionResult } from '@/lib/types';

/**
 * Visitor forms on the company website. They run with the anonymous key, and the database
 * functions (submit_lead / submit_application) validate everything again and notify the team.
 */
const isBot = (fd: FormData) => str(fd, 'website') !== ''; // honeypot field — hidden from people

export async function submitLead(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    if (isBot(fd)) return { ok: true, data: { ref: '—' } };
    if (!str(fd, 'full_name') || !str(fd, 'phone')) throw new UserError(d.errors.REQUIRED);
    const { data, error } = await anonClient().rpc('submit_lead', {
      p_kind: str(fd, 'kind'),
      p_name: str(fd, 'full_name'),
      p_phone: str(fd, 'phone'),
      p_project: strOrNull(fd, 'project_id'),
      p_unit: strOrNull(fd, 'unit_id'),
      p_service: strOrNull(fd, 'service'),
      p_email: strOrNull(fd, 'email'),
      p_city: strOrNull(fd, 'city'),
      p_date: strOrNull(fd, 'preferred_date'),
      p_time: strOrNull(fd, 'preferred_time'),
      p_message: strOrNull(fd, 'message'),
    });
    if (error) throw new Error(error.message);
    return { ok: true, data: { ref: data as string } };
  });
}

export async function submitApplication(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    if (isBot(fd)) return { ok: true, data: { ref: '—' } };
    if (!str(fd, 'full_name') || !str(fd, 'phone') || !str(fd, 'email')) throw new UserError(d.errors.REQUIRED);
    const linkedin = strOrNull(fd, 'linkedin_url');
    const { data, error } = await anonClient().rpc('submit_application', {
      p_kind: str(fd, 'kind') === 'training' ? 'training' : 'job',
      p_name: str(fd, 'full_name'),
      p_phone: str(fd, 'phone'),
      p_email: str(fd, 'email'),
      p_opening: strOrNull(fd, 'opening_id'),
      p_city: strOrNull(fd, 'city'),
      p_education: strOrNull(fd, 'education'),
      p_major: strOrNull(fd, 'major'),
      p_university: strOrNull(fd, 'university'),
      p_experience: numOrNull(fd, 'experience_years'),
      p_linkedin: linkedin && /^https:\/\//i.test(linkedin) ? linkedin : null,
      p_cv_path: strOrNull(fd, 'cv_path'),
      p_note: strOrNull(fd, 'cover_note'),
      p_training_from: strOrNull(fd, 'training_from'),
      p_training_to: strOrNull(fd, 'training_to'),
    });
    if (error) throw new Error(error.message);
    return { ok: true, data: { ref: data as string } };
  });
}
