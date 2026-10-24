/**
 * Server-side error reporting (Next.js onRequestError hook): any uncaught error while rendering a page,
 * running a server action or a route handler is recorded in public.error_events (see /admin/system).
 */
export async function onRequestError(err: unknown, request: { path: string; method: string; headers: Record<string, string | string[] | undefined> }, context: { routePath?: string; routeType?: string }) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    const e = err as { message?: string; digest?: string; stack?: string };
    // redirects / notFound are control flow, not errors
    if (typeof e?.digest === 'string' && e.digest.startsWith('NEXT_')) return;
    await fetch(`${url}/rest/v1/rpc/log_error`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_source: 'server', p_message: String(e?.message ?? err).slice(0, 500), p_path: `${request.method} ${context.routePath ?? request.path}`.slice(0, 300),
        p_digest: e?.digest ?? null, p_stack: e?.stack?.slice(0, 2000) ?? null, p_user_agent: String(request.headers['user-agent'] ?? '').slice(0, 300),
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch { /* never let reporting break the response */ }
}
