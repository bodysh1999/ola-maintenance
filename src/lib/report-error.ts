'use client';

import { createClient } from './supabase/client';

/** Records a browser-side error (shown on /admin/system). Never throws. */
export function reportClientError(error: Error & { digest?: string }) {
  try {
    void createClient().rpc('log_error', {
      p_source: 'client', p_message: String(error?.message ?? error).slice(0, 500), p_path: window.location.pathname,
      p_digest: error?.digest ?? null, p_stack: error?.stack?.slice(0, 2000) ?? null, p_user_agent: navigator.userAgent.slice(0, 300),
    }).then(() => undefined, () => undefined);
  } catch { /* ignore */ }
}
