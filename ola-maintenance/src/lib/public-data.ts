import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { FALLBACK_PROJECTS, type SiteProject } from './site-content';

/**
 * Public website data — read with the anonymous key only, so the visitor sees exactly
 * what the database policies allow for anyone (never owner data, never sold units).
 */
export function anonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getProjects(): Promise<SiteProject[]> {
  try {
    const { data, error } = await anonClient().from('projects')
      .select('id, name_ar, name_en, image_url, sales_status, city, district').order('name_ar', { ascending: false });
    if (error || !data?.length) return FALLBACK_PROJECTS;
    return data as SiteProject[];
  } catch {
    return FALLBACK_PROJECTS;
  }
}

export type PublicUnit = {
  id: string; unit_number: string; floor: number; unit_type: string; area_sqm: number | null; bedrooms: number | null;
  bathrooms: number | null; image_url: string | null; price: number | null; sale_status: 'available' | 'reserved'; features: string | null;
  building: string;
};
export type PublicProject = SiteProject & {
  id: string; description: string | null; delivery_year: number | null; address_text: string | null;
  location_url: string | null; map_query: string | null; visit_hours: string | null; units: PublicUnit[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getProject(id: string): Promise<PublicProject | null> {
  if (!UUID.test(id)) return null;
  try {
    const sb = anonClient();
    const { data: p, error } = await sb.from('projects')
      .select('id, name_ar, name_en, image_url, sales_status, city, district, description, delivery_year, address_text, location_url, map_query, visit_hours')
      .eq('id', id).maybeSingle();
    if (error || !p) return null;
    const { data: b } = await sb.from('buildings')
      .select('name, units(id, unit_number, floor, unit_type, area_sqm, bedrooms, bathrooms, image_url, price, sale_status, features)')
      .eq('project_id', id);
    type B = { name: string; units: Omit<PublicUnit, 'building'>[] };
    const units = ((b ?? []) as B[]).flatMap((x) => x.units.map((u) => ({ ...u, building: x.name })))
      .sort((x, y) => x.floor - y.floor || x.unit_number.localeCompare(y.unit_number, 'en', { numeric: true }));
    return { ...(p as Omit<PublicProject, 'units'>), units };
  } catch {
    return null;
  }
}

export type PublicOpening = { id: string; title: string; department: string | null; location: string; employment: 'full_time' | 'part_time' | 'contract' | 'training'; description: string | null; requirements: string | null };

export async function getOpenings(): Promise<PublicOpening[]> {
  try {
    const { data } = await anonClient().from('job_openings')
      .select('id, title, department, location, employment, description, requirements').eq('is_open', true).order('created_at');
    return (data ?? []) as PublicOpening[];
  } catch {
    return [];
  }
}

/** Google Maps embed (no API key) from coordinates or an address */
export function mapEmbed(q: string | null | undefined) {
  return q ? `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed` : null;
}
export function mapLink(p: { location_url: string | null; map_query: string | null }) {
  if (p.location_url && /^https:\/\//i.test(p.location_url)) return p.location_url;
  return p.map_query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.map_query)}` : null;
}
