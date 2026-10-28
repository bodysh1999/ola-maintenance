import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/session';
import { siteOrigin } from '@/lib/origin';
import { salaryBreakdown, type Salary } from '@/lib/hr';
import { HrLetter, LetterScale, type LetterData } from '@/components/hr-letter';
import { PrintButton } from './print-button';

/** Printable HR letter (salary certificate / experience letter) — only once approved */
export default async function Letter({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, supabase, origin] = await Promise.all([params, createClient(), siteOrigin()]);
  const { data: r } = await supabase.from('hr_requests')
    .select('id, ref_no, type, status, addressed_to, decided_at, created_at, verify_code, letter_data, employee_id')
    .eq('id', id).maybeSingle();
  if (!r || r.status !== 'approved' || !['salary_certificate', 'experience_letter'].includes(r.type)) notFound();
  const data = (r.letter_data as LetterData | null) ?? (await liveSnapshot(r.employee_id));
  if (!data) notFound();

  return (
    <div dir="rtl" className="a4-print-root min-h-screen overflow-x-hidden bg-stone-100 px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end px-4 print:hidden"><PrintButton /></div>
      <LetterScale>
        <HrLetter type={r.type} refNo={r.ref_no} issuedAt={r.decided_at ?? r.created_at} addressedTo={r.addressed_to}
          data={data} verifyUrl={`${origin}/verify/${r.verify_code}`} />
      </LetterScale>
    </div>
  );
}

/** Fallback for letters approved before the snapshot existed */
async function liveSnapshot(employeeId: string): Promise<LetterData | null> {
  const [supabase, s] = await Promise.all([createClient(), getSettings()]);
  const [{ data: e }, { data: sal }, { data: priv }] = await Promise.all([
    supabase.from('employees').select('*').eq('id', employeeId).maybeSingle(),
    supabase.from('employee_salaries').select('*').eq('employee_id', employeeId).maybeSingle(),
    supabase.from('employee_private').select('id_number').eq('employee_id', employeeId).maybeSingle(),
  ]);
  if (!e) return null;
  const br = sal ? salaryBreakdown(sal as Salary, e.nationality_type, { saudi: Number(s.gosi_saudi_rate ?? 9.75), resident: Number(s.gosi_resident_rate ?? 0) }) : null;
  return {
    employee: { ...e, id_number: priv?.id_number ?? null },
    salary: sal && br ? { basic: +sal.basic, housing: +sal.housing, transport: +sal.transport, other_allowances: +sal.other_allowances, gross: br.gross, gosi: br.gosi, other_deductions: +sal.other_deductions, deductions: br.deductions, net: br.net } : null,
    signatory: { name: s.hr_letter_signatory ?? null, title: s.hr_signatory_title ?? null, signature_url: s.hr_signature_url ?? null },
    company: { name_ar: s.name_ar, name_en: s.name_en, logo_url: s.logo_url, phone: s.support_phone, email: s.support_email, website: s.website_url },
  };
}
