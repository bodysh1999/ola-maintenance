import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** Exchanges the code from password-reset / magic links for a session. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';
  // only paths on this site: rejects //evil.com, /\\evil.com and encoded tricks that resolve to another origin
  let safeNext = '/';
  if (next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')) {
    const target = new URL(next, url.origin);
    if (target.origin === url.origin) safeNext = target.pathname + target.search;
  }
  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL(safeNext, url.origin));
}
