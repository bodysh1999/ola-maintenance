'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { act, must, str } from '@/lib/actions';
import type { ActionResult } from '@/lib/types';

export async function resolveError(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('resolve_error', { p_fp: str(fd, 'fp') }));
    revalidatePath('/admin/system');
  });
}
