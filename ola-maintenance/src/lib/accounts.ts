import 'server-only';
import { randomInt } from 'crypto';
import { createAdminClient } from './supabase/server';
import type { Role } from './types';

export function tempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += chars[randomInt(chars.length)];
  return s + '@' + randomInt(10, 99);
}

/** Creates a Supabase Auth user (service key, server only). Role is in app_metadata → profile trigger. */
export async function createLoginAccount(email: string, full_name: string, phone: string | null, role: Role) {
  const admin = createAdminClient();
  const password = tempPassword();
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    app_metadata: { role },
    user_metadata: { full_name, phone, must_change_password: true },
  });
  if (error) throw new Error(/already|registered|exists/i.test(error.message) ? 'EMAIL_EXISTS' : error.message);
  return { userId: data.user.id, password };
}
