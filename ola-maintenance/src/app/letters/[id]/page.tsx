import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/session';
import { salaryBreakdown, sar, type Salary } from '@/lib/hr';
import { DEFAULT_LOGO } from '@/components/brand';
import { PrintButton } from './print-button';

/** Printable HR letter (salary certificate / experience letter) — only once approved */
export default async function Letter({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, s, supabase] = await Promise.all([params, getSettings(), createClient()]);
  const { data: r } = await supabase.from('hr_requests').select('*, employee:employees!hr_requests_employee_id_fkey(*)').eq('id', id).maybeSingle();
  if (!r || r.status !== 'approved' || !['salary_certificate', 'experience_letter'].includes(r.type)) notFound();
  const e = r.employee as { id: string; full_name: string; job_title: string; emp_no: string; hire_date: string; nationality_type: 'saudi' | 'resident'; nationality: string | null; status: string };
  const [{ data: sal }, { data: priv }] = await Promise.all([
    supabase.from('employee_salaries').select('*').eq('employee_id', e.id).maybeSingle(),
    supabase.from('employee_private').select('id_number').eq('employee_id', e.id).maybeSingle(),
  ]);
  const br = sal ? salaryBreakdown(sal as Salary, e.nationality_type, { saudi: Number(s.gosi_saudi_rate ?? 9.75), resident: Number(s.gosi_resident_rate ?? 0) }) : null;
  const date = (v: string) => new Date(v).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' });
  const issued = new Date(r.decided_at ?? r.created_at);
  const row = (k: string, v: string) => <tr><td className="border border-stone-300 px-4 py-2 font-medium">{k}</td><td className="border border-stone-300 px-4 py-2" dir="ltr">{v}</td></tr>;

  return (
    <div dir="rtl" className="min-h-screen bg-stone-100 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end px-4 print:hidden"><PrintButton /></div>
      <article className="mx-auto flex min-h-[297mm] max-w-[210mm] flex-col bg-white px-[18mm] py-[16mm] text-[15px] leading-loose text-ink shadow-lift print:shadow-none">
        <header className="flex items-center justify-between border-b-2 border-brand pb-5">
          <div><div className="font-display text-lg font-bold text-brand">{s.name_ar}</div><div className="text-xs text-stone-500" dir="ltr">{s.name_en}</div></div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.logo_url || DEFAULT_LOGO} alt="" className="h-16 w-auto rounded-lg bg-brand p-2" />
        </header>
        <div className="mt-6 flex justify-between text-sm text-stone-600"><span>الرقم: <span dir="ltr">{r.ref_no}</span></span><span>التاريخ: {date(issued.toISOString())}</span></div>
        <h1 className="mt-10 text-center font-display text-2xl font-bold text-brand">{r.type === 'salary_certificate' ? 'تعريف بالراتب' : 'شهادة خبرة'}</h1>
        <p className="mt-8 font-semibold">{r.addressed_to || 'إلى من يهمه الأمر'}</p>
        <p className="mt-2">السلام عليكم ورحمة الله وبركاته،</p>
        {r.type === 'salary_certificate' ? (
          <>
            <p className="mt-4">
              تشهد {s.name_ar} بأن السيد/ة <b>{e.full_name}</b>{priv?.id_number ? <> ، رقم الهوية/الإقامة <b dir="ltr">{priv.id_number}</b></> : null}
              {e.nationality ? <> ، الجنسية <b>{e.nationality}</b></> : null}، يعمل لدينا بوظيفة <b>{e.job_title}</b> اعتبارًا من تاريخ <b>{date(e.hire_date)}</b> ولا يزال على رأس العمل حتى تاريخه، ويتقاضى راتبًا شهريًا على النحو التالي:
            </p>
            {sal && br && (
              <table className="mt-6 w-full border-collapse text-sm">
                <tbody>
                  {row('الراتب الأساسي', `${sar(sal.basic)} SAR`)}
                  {row('بدل السكن', `${sar(sal.housing)} SAR`)}
                  {row('بدل النقل', `${sar(sal.transport)} SAR`)}
                  {Number(sal.other_allowances) > 0 && row('بدلات أخرى', `${sar(sal.other_allowances)} SAR`)}
                  <tr className="bg-stone-50 font-bold"><td className="border border-stone-300 px-4 py-2">إجمالي الراتب</td><td className="border border-stone-300 px-4 py-2" dir="ltr">{sar(br.gross)} SAR</td></tr>
                  {row('الحسميات (التأمينات الاجتماعية وغيرها)', `${sar(br.deductions)} SAR`)}
                  <tr className="bg-stone-50 font-bold"><td className="border border-stone-300 px-4 py-2">صافي الراتب</td><td className="border border-stone-300 px-4 py-2" dir="ltr">{sar(br.net)} SAR</td></tr>
                </tbody>
              </table>
            )}
          </>
        ) : (
          <p className="mt-4">
            تشهد {s.name_ar} بأن السيد/ة <b>{e.full_name}</b> عمل/يعمل لدينا بوظيفة <b>{e.job_title}</b> اعتبارًا من تاريخ <b>{date(e.hire_date)}</b>
            {e.status === 'active' ? ' ولا يزال على رأس العمل حتى تاريخه' : ''}، وقد كان مثالًا للجدية والالتزام.
          </p>
        )}
        <p className="mt-6">وقد أُعطي هذا الخطاب بناءً على طلبه دون أدنى مسؤولية على الشركة.</p>
        <div className="mt-auto flex justify-end pt-16">
          <div className="text-center">
            <div className="font-semibold">إدارة الموارد البشرية</div>
            {s.hr_letter_signatory && <div className="mt-1">{s.hr_letter_signatory}</div>}
            <div className="mt-12 w-48 border-t border-stone-400 pt-1 text-xs text-stone-500">التوقيع والختم</div>
          </div>
        </div>
        <footer className="mt-8 border-t border-stone-200 pt-3 text-center text-[11px] text-stone-500" dir="ltr">
          {[s.support_phone, s.support_email, s.website_url?.replace(/^https?:\/\//, '')].filter(Boolean).join('  ·  ')}
        </footer>
      </article>
    </div>
  );
}
