'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { act, must, str, strOrNull, UserError } from '@/lib/actions';
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
