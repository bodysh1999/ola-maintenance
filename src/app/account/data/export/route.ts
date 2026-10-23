import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** PDPL right of access: a machine-readable copy of everything the system holds about the signed-in user */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'));
  const uid = user.id;
  const pick = async <T,>(q: PromiseLike<{ data: T | null }>) => (await q).data;

  const [profile, owner, employee, technician, consents, requests, notifications, notes] = await Promise.all([
    pick(supabase.from('profiles').select('*').eq('id', uid).maybeSingle()),
    pick(supabase.from('owners').select('*').eq('profile_id', uid).maybeSingle()),
    pick(supabase.from('employees').select('*').eq('profile_id', uid).maybeSingle()),
    pick(supabase.from('technicians').select('id, full_name, phone, specialties, photo_url, created_at').eq('profile_id', uid).maybeSingle()),
    pick(supabase.from('consents').select('purpose, granted, policy_version, channel, created_at').eq('profile_id', uid).order('created_at')),
    pick(supabase.from('data_requests').select('ref_no, type, details, status, response, created_at, handled_at').eq('profile_id', uid)),
    pick(supabase.from('notifications').select('type, payload, read_at, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(1000)),
    pick(supabase.from('request_notes').select('request_id, body, created_at').eq('author_id', uid).order('created_at')),
  ]);

  const out: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    account: { email: user.email, created_at: user.created_at, last_sign_in_at: user.last_sign_in_at },
    profile, consents, data_requests: requests, notifications, my_messages: notes,
  };

  if (owner) {
    const o = owner as { id: string };
    const [units, mrequests, ratings] = await Promise.all([
      pick(supabase.from('units').select('id, unit_number, floor, unit_type, area_sqm, bedrooms, handover_date, buildings(name, projects(name_ar))').eq('owner_id', o.id)),
      pick(supabase.from('maintenance_requests').select('ref_no, category, location_in_unit, description, status, warranty_state, created_at, completed_at').eq('owner_id', o.id).order('created_at')),
      pick(supabase.from('ratings').select('request_id, score, comment, created_at').eq('owner_id', o.id)),
    ]);
    const unitIds = ((units ?? []) as { id: string }[]).map((u) => u.id);
    const [warranties, documents] = unitIds.length ? await Promise.all([
      pick(supabase.from('warranties').select('unit_id, title, category, start_date, end_date, covered_items, excluded_items').in('unit_id', unitIds)),
      pick(supabase.from('unit_documents').select('unit_id, kind, title, file_name, created_at').in('unit_id', unitIds)),
    ]) : [[], []];
    Object.assign(out, { owner, units, maintenance_requests: mrequests, ratings, warranties, unit_documents: documents });
  }
  if (employee) {
    const e = employee as { id: string };
    const [salary, priv, attendance, hr] = await Promise.all([
      pick(supabase.from('employee_salaries').select('*').eq('employee_id', e.id).maybeSingle()),
      pick(supabase.from('employee_private').select('*').eq('employee_id', e.id).maybeSingle()),
      pick(supabase.from('attendance').select('work_date, check_in_at, check_out_at, in_lat, in_lng, out_lat, out_lng, source').eq('employee_id', e.id).order('work_date')),
      pick(supabase.from('hr_requests').select('ref_no, type, status, start_date, end_date, work_date, hours, reason, created_at, decided_at').eq('employee_id', e.id).order('created_at')),
    ]);
    Object.assign(out, { employee, salary, private: priv, attendance, hr_requests: hr });
  }
  if (technician) out.technician = technician;

  await supabase.rpc('submit_data_request', { p_type: 'access', p_details: null }); // recorded in the rights log

  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
