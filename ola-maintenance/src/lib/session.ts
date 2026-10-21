import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import { getDict } from './i18n';
import type { CompanySettings, Locale, Profile, Role } from './types';

export const DEFAULT_SETTINGS: CompanySettings = {
  name_ar: 'علا التميز للاستثمار والتسويق العقاري',
  name_en: 'Ola Al-Tamayuz Real Estate Investment & Marketing',
  logo_url: null,
  primary_color: '#3C2E52',
  accent_color: '#B08D57',
  support_phone: '8001111379',
  support_email: 'info@ola-altamayuz.com',
  response_sla_hours: 24,
  resolution_sla_hours: 120,
  reopen_window_days: 30,
  notify_channels: [],
  whatsapp: '966555003618',
  website_url: 'https://www.ola-altamayuz.com',
  instagram_url: 'https://www.instagram.com/ola.altamayuz',
  snapchat_url: 'https://www.snapchat.com/add/olaaltamayuz',
  tiktok_url: 'https://www.tiktok.com/@ola.altamayuz',
};

export const getLocale = cache(async (): Promise<Locale> => {
  const c = (await cookies()).get('locale')?.value;
  return c === 'en' ? 'en' : 'ar';
});

export const getI18n = cache(async () => {
  const locale = await getLocale();
  return { locale, d: getDict(locale) };
});

export const getSettings = cache(async (): Promise<CompanySettings> => {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('company_settings').select('*').eq('id', 1).maybeSingle();
    return { ...DEFAULT_SETTINGS, ...(data ?? {}) };
  } catch {
    return DEFAULT_SETTINGS;
  }
});

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return (data as Profile) ?? null;
});

export function homeFor(role: Role): string {
  if (role === 'owner') return '/owner';
  if (role === 'technician') return '/tech';
  if (role === 'supervisor') return '/admin/inbox';
  if (role === 'sales') return '/sales';
  if (role === 'hr') return '/hr';
  return '/admin';
}

/** Server-side guard: the UI is never the only line of defence (RLS is), but pages also refuse wrong roles. */
export async function requireRole(roles: Role[]): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (!profile.is_active) redirect('/login?disabled=1');
  if (!roles.includes(profile.role)) redirect(homeFor(profile.role));
  return profile;
}
