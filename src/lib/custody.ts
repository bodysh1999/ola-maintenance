import 'server-only';
import { createClient } from './supabase/server';
import type { CustodyRow, ExpenseRow } from '@/components/custody-view';

/** One custody with its expenses; invoice files get short-lived signed links */
export async function loadCustody(id: string) {
  const supabase = await createClient();
  const [{ data: c }, { data: x }] = await Promise.all([
    supabase.from('custody_summary').select('*').eq('id', id).maybeSingle(),
    supabase.from('custody_expenses').select('*').eq('custody_id', id).order('expense_date', { ascending: false }).order('created_at', { ascending: false }),
  ]);
  if (!c) return null;
  const rows = (x ?? []) as ExpenseRow[];
  const paths = rows.map((r) => r.attachment_path).filter(Boolean) as string[];
  if (paths.length) {
    const { data: signed } = await supabase.storage.from('hr-docs').createSignedUrls(paths, 900);
    const map = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    rows.forEach((r) => { r.url = r.attachment_path ? map.get(r.attachment_path) ?? null : null; });
  }
  return { custody: c as CustodyRow, expenses: rows };
}
