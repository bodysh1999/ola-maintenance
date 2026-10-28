import QRCode from 'qrcode';
import { ShieldCheck } from 'lucide-react';
import { sar } from '@/lib/hr';
import { DEFAULT_LOGO } from './brand';

/** Letter content exactly as issued (snapshot saved by the database at approval time) */
export type LetterData = {
  employee: {
    full_name: string; job_title: string; emp_no?: string; nationality: string | null; nationality_type?: 'saudi' | 'resident';
    gender?: 'male' | 'female'; hire_date: string; status?: string; id_number?: string | null;
  };
  salary: { basic: number; housing: number; transport: number; other_allowances: number; gross: number; gosi: number; gosi_rate?: number; other_deductions: number; deductions: number; net: number } | null;
  signatory: { name: string | null; title: string | null; signature_url: string | null };
  company: { name_ar: string; name_en: string; logo_url: string | null; phone: string | null; email: string | null; website: string | null };
};

export type LetterProps = {
  type: 'salary_certificate' | 'experience_letter';
  refNo: string; issuedAt: string; addressedTo: string | null;
  data: LetterData; verifyUrl: string;
};

export async function qrSvg(url: string) {
  return QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#2A1F3A', light: '#FFFFFF' } });
}

const date = (v: string) => new Date(v).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' });
const hijri = (v: string) => new Date(v).toLocaleDateString('ar-SA-u-nu-latn-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' });

/** Shows the A4 page whole on any screen: scaled down on phones (like a page preview), real size when printing */
export function LetterScale({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-fit [zoom:0.43] min-[420px]:[zoom:0.5] min-[520px]:[zoom:0.62] sm:[zoom:0.78] md:[zoom:0.94] lg:[zoom:1] print:[zoom:1]">
      {children}
    </div>
  );
}

/** A4 HR letter — salary certificate / experience letter */
export async function HrLetter({ type, refNo, issuedAt, addressedTo, data, verifyUrl }: LetterProps) {
  const { employee: e, salary: s, signatory: sg, company: c } = data;
  const f = e.gender === 'female';
  const qr = await qrSvg(verifyUrl);
  const active = (e.status ?? 'active') === 'active';
  const row = (k: string, v: number, strong = false) => (
    <tr className={strong ? 'bg-[#F7F5F9] font-bold' : ''}>
      <td className="border border-stone-300 px-4 py-1.5">{k}</td>
      <td className="border border-stone-300 px-4 py-1.5 text-left" dir="ltr">{sar(v)} SAR</td>
    </tr>
  );

  return (
    <article className="a4-doc relative mx-auto flex min-h-[297mm] w-[210mm] flex-col overflow-hidden bg-white px-[16mm] py-[11mm] text-[14px] leading-[1.85] text-ink shadow-lift print:shadow-none">
      {/* exact A4 sheet with no browser margins (only on pages that show a document) */}
      <style>{'@page{size:A4 portrait;margin:0}'}</style>
      {/* watermark */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={c.logo_url || DEFAULT_LOGO} alt="" aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 w-[110mm] -translate-x-1/2 -translate-y-1/2 opacity-[0.035] [filter:brightness(0)]" />

      <header className="relative flex items-center justify-between gap-6 border-b-2 border-[#3C2E52] pb-4">
        <div>
          <div className="font-display text-[17px] font-bold text-[#3C2E52]">{c.name_ar}</div>
          <div className="text-[11px] leading-snug text-stone-500" dir="ltr">{c.name_en}</div>
          <div className="mt-1 text-[11px] text-stone-500">إدارة تنمية رأس المال البشري</div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={c.logo_url || DEFAULT_LOGO} alt="" className="h-16 w-auto rounded-xl bg-[#3C2E52] p-2.5" />
      </header>

      <div className="relative mt-4 grid grid-cols-2 gap-1 text-[12.5px] text-stone-600">
        <span>الرقم: <b className="font-semibold text-ink" dir="ltr">{refNo}</b></span>
        <span className="text-left">التاريخ: <b className="font-semibold text-ink">{date(issuedAt)}</b></span>
        <span />
        <span className="text-left">الموافق: {hijri(issuedAt)}</span>
      </div>

      <h1 className="relative mt-6 text-center font-display text-[24px] font-bold text-[#3C2E52]">
        {type === 'salary_certificate' ? 'تعريف بالراتب' : 'شهادة خبرة'}
        <span className="mx-auto mt-2 block h-[3px] w-14 rounded-full bg-[#B08D57]" />
      </h1>

      <div className="relative mt-4">
        <p className="font-semibold">{addressedTo || 'إلى من يهمه الأمر'}</p>
        <p className="mt-1">السلام عليكم ورحمة الله وبركاته،</p>
        {type === 'salary_certificate' ? (
          <>
            <p className="mt-4 text-justify">
              تشهد <b>{c.name_ar}</b> بأن {f ? 'السيدة' : 'السيد'}/ <b>{e.full_name}</b>
              {e.nationality ? <>، الجنسية <b>{e.nationality}</b></> : null}
              {e.id_number ? <>، {e.nationality_type === 'resident' ? 'رقم الإقامة' : 'رقم الهوية'} <bdi dir="ltr" className="font-bold [unicode-bidi:isolate]">{e.id_number}</bdi></> : null}،
              {' '}{f ? 'تعمل' : 'يعمل'} لدينا بوظيفة <b>{e.job_title}</b> اعتبارًا من تاريخ <b>{date(e.hire_date)}</b>
              {active ? <> {f ? 'ولا تزال' : 'ولا يزال'} على رأس العمل حتى تاريخه</> : null}، {f ? 'وتتقاضى' : 'ويتقاضى'} راتبًا شهريًا على النحو التالي:
            </p>
            {s && (
              <table className="mt-4 w-full border-collapse text-[13.5px]">
                <tbody>
                  {row('الراتب الأساسي', s.basic)}
                  {row('بدل السكن', s.housing)}
                  {row('بدل النقل', s.transport)}
                  {s.other_allowances > 0 && row('بدلات أخرى', s.other_allowances)}
                  {row('إجمالي الراتب', s.gross, true)}
                  {row('الحسميات (التأمينات الاجتماعية وغيرها)', s.deductions)}
                  {row('صافي الراتب', s.net, true)}
                </tbody>
              </table>
            )}
          </>
        ) : (
          <p className="mt-4 text-justify">
            تشهد <b>{c.name_ar}</b> بأن {f ? 'السيدة' : 'السيد'}/ <b>{e.full_name}</b>
            {e.nationality ? <>، الجنسية <b>{e.nationality}</b></> : null}،
            {' '}{active ? (f ? 'تعمل' : 'يعمل') : (f ? 'عملت' : 'عمل')} لدينا بوظيفة <b>{e.job_title}</b> اعتبارًا من تاريخ <b>{date(e.hire_date)}</b>
            {active ? <> {f ? 'ولا تزال' : 'ولا يزال'} على رأس العمل حتى تاريخه</> : null}، وقد {f ? 'كانت' : 'كان'} مثالًا للجدية والالتزام وحسن الأداء.
          </p>
        )}
        <p className="mt-4">وقد أُعطي هذا الخطاب بناءً على {f ? 'طلبها' : 'طلبه'} دون أدنى مسؤولية على الشركة.</p>
        <p className="mt-1">وتقبلوا خالص التحية والتقدير،</p>
      </div>

      {/* ---------- verification (right) + signature (left) ---------- */}
      <div className="relative mt-auto grid grid-cols-[1.25fr_1fr] items-end gap-8 pt-6">
        <div className="flex items-center gap-4 rounded-2xl border border-[#E4DFEA] bg-[#F7F5F9] p-4">
          <div className="h-[26mm] w-[26mm] shrink-0 rounded-lg bg-white p-1.5 ring-1 ring-[#E4DFEA] [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
          <div className="min-w-0 text-[11.5px] leading-[1.8] text-stone-600">
            <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#3C2E52]"><ShieldCheck className="h-4 w-4 text-[#B08D57]" />هذه وثيقة إلكترونية</div>
            <p>صادرة من نظام {c.name_ar} ولا تحتاج إلى ختم.</p>
            <p>للتحقق من صحتها امسح الرمز أو زر:</p>
            <p className="font-medium text-[#3C2E52]" dir="ltr">{verifyUrl.replace(/^https?:\/\//, '').replace(/\/verify\/.*$/, '/verify')}</p>
            <p className="mt-0.5 font-mono text-[10.5px] tracking-wide text-[#3C2E52]" dir="ltr">{(verifyUrl.split('/verify/')[1] ?? '').match(/.{1,4}/g)?.join(' ')}</p>
          </div>
        </div>
        <div className="text-center">
          <div className="text-[13px] font-semibold text-stone-600">{sg.title || 'مدير تنمية رأس المال البشري'}</div>
          <div className="mt-2 flex h-[22mm] items-center justify-center">
            {sg.signature_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={sg.signature_url} alt="التوقيع" className="max-h-full max-w-[55mm] object-contain" />
              : <span className="block w-40 border-b border-dashed border-stone-300" />}
          </div>
          <div className="mt-1 font-display text-[15px] font-bold text-ink">{sg.name || '—'}</div>
        </div>
      </div>

      <footer className="relative mt-4 border-t border-stone-200 pt-3 text-center text-[10.5px] text-stone-500" dir="ltr">
        {[c.phone, c.email, c.website?.replace(/^https?:\/\//, '')].filter(Boolean).join('   ·   ')}
      </footer>
    </article>
  );
}
