#!/usr/bin/env node
/**
 * Bootstrap the first company admin (there is no public sign-up page by design).
 *   npm run create-admin -- admin@company.sa "اسم المدير"
 * Prints a temporary password; the admin is asked to change it at first sign-in.
 */
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

const [email, ...nameParts] = process.argv.slice(2);
const full_name = nameParts.join(' ') || 'مدير النظام';
if (!email) {
  console.error('Usage: npm run create-admin -- <email> "<full name>"');
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });
const password = randomBytes(9).toString('base64url') + '!7';
const { error } = await admin.auth.admin.createUser({
  email, password, email_confirm: true,
  app_metadata: { role: 'admin' },
  user_metadata: { full_name, must_change_password: true },
});
if (error) {
  console.error('❌', error.message);
  process.exit(1);
}
console.log(`✅ Admin created: ${email}\n   Temporary password: ${password}\n   (must be changed at first sign-in)`);
