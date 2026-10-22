import { ShieldCheck } from 'lucide-react';
import { qrSvg } from './hr-letter';
import { DEFAULT_LOGO } from './brand';

export type WarrantyCertData = {
  title: string; category_label: string | null; start_date: string; end_date: string;
  covered_items: string | null; excluded_items: string | null; responsible: string | null;
  unit_number: string; building: string | null; project: string | null; owner: string | null;
};
export type CertCompany = { name_ar: string; name_en: string; logo_url: string | null; phone: string | null; email: string | null; website: string | null };

const date = (v: string) => new Date(v).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' });
const hijri = (v: string) => new Date(v).toLocaleDateString('ar-SA-u-nu-latn-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' });

/** A4 warranty certificate with a QR code that opens the public verification page */
export async function WarrantyCertificate({ w, company: c, code, verifyUrl, today }: {
  w: WarrantyCertData; company: CertCompany; code: string; verifyUrl: string; today: string;
}) {
  const qr = await qrSvg(verifyUrl);
  const active = today >= w.start_date && today <= w.end_date;
  const certNo = `WC-${code.slice(0, 8).toUpperCase()}`;
  const row = (k: string, v: React.ReactNode) => (
    <tr>
      <td className="w-[38%] border border-stone-300 bg-[#F7F5F9] px-4 py-2.5 font-semibold text-[#3C2E52]">{k}</td>
      <td className="border border-stone-300 px-4 py-2.5">{v}</td>
    </tr>
  );

  return (
    <article className="relative mx-auto flex min-h-[297mm] w-[210mm] flex-col overflow-hidden bg-white px-[16mm] py-[14mm] text-[14.5px] leading-[2] text-ink shadow-lift print:shadow-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={c.logo_url || DEFAULT_LOGO} alt="" aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 w-[110mm] -translate-x-1/2 -translate-y-1/2 opacity-[0.035] [filter:brightness(0)]" />
      <div className="pointer-events-none absolute inset-[7mm] rounded-[6mm] border-2 border-[#B08D57]/40" />

      <header className="relative flex items-center justify-between gap-6 border-b-2 border-[#3C2E52] pb-4">
        <div>
          <div className="font-display text-[17px] font-bold text-[#3C2E52]">{c.name_ar}</div>
          <div className="text-[11px] leading-snug text-stone-500" dir="ltr">{c.name_en}</div>
          <div className="mt-1 text-[11px] text-stone-500">إدارة خدمات ما بعد البيع</div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={c.logo_url || DEFAULT_LOGO} alt="" className="h-16 w-auto rounded-xl bg-[#3C2E52] p-2.5" />
      </header>

      <div className="relative mt-5 grid grid-cols-2 gap-1 text-[12.5px] text-stone-600">
        <span>رقم الشهادة: <b className="font-semibold text-ink" dir="ltr">{certNo}</b></span>
        <span className="text-left">تاريخ الإصدار: <b className="font-semibold text-ink">{date(today)}</b></span>
        <span />
        <span className="text-left">الموافق: {hijri(today)}</span>
      </div>

      <h1 className="relative mt-8 text-center font-display text-[26px] font-bold text-[#3C2E52]">
        شهادة ضمان
        <span className="mx-auto mt-2 block h-[3px] w-14 rounded-full bg-[#B08D57]" />
      </h1>

      <div className="relative mt-6">
        <p className="text-justify">
          تشهد <b>{c.name_ar}</b> بأن الوحدة رقم <b>{w.unit_number}</b>
          {w.building ? <> في <b>{w.building}</b></> : null}
          {w.project ? <> بمشروع <b>{w.project}</b></> : null}
          {w.owner ? <>، والمملوكة لـ <b>{w.owner}</b></> : null}،
          مشمولة بالضمان الموضح أدناه وفق الشروط المعتمدة لدى الشركة:
        </p>

        <table className="mt-5 w-full border-collapse text-[13.5px] leading-[1.8]">
          <tbody>
            {row('نوع الضمان', <b>{w.title}</b>)}
            {w.category_label && row('الفئة', w.category_label)}
            {row('تاريخ بداية الضمان', date(w.start_date))}
            {row('تاريخ انتهاء الضمان', date(w.end_date))}
            {row('حالة الضمان', <span className={active ? 'font-bold text-emerald-700' : 'font-bold text-stone-500'}>{active ? 'ساري' : today < w.start_date ? 'لم يبدأ بعد' : 'منتهي'}</span>)}
            {w.covered_items && row('يشمل', w.covered_items)}
            {w.excluded_items && row('لا يشمل', w.excluded_items)}
            {w.responsible && row('الجهة المسؤولة', w.responsible)}
          </tbody>
        </table>

        <p className="mt-5 text-[13px] leading-[1.9] text-stone-600">
          يسري الضمان على الأعطال الناتجة عن عيوب التنفيذ أو المواد، ولا يشمل الأضرار الناتجة عن سوء الاستخدام أو التعديلات التي يجريها المالك.
          لطلب خدمة ضمن هذا الضمان يُرجى تقديم بلاغ صيانة عبر بوابة الملاك.
        </p>
      </div>

      <div className="relative mt-auto grid grid-cols-[1.25fr_1fr] items-end gap-8 pt-10">
        <div className="flex items-center gap-4 rounded-2xl border border-[#E4DFEA] bg-[#F7F5F9] p-4">
          <div className="h-[30mm] w-[30mm] shrink-0 rounded-lg bg-white p-1.5 ring-1 ring-[#E4DFEA] [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
          <div className="min-w-0 text-[11.5px] leading-[1.8] text-stone-600">
            <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#3C2E52]"><ShieldCheck className="h-4 w-4 text-[#B08D57]" />هذه وثيقة إلكترونية</div>
            <p>صادرة من نظام {c.name_ar} ولا تحتاج إلى ختم.</p>
            <p>للتحقق من صحتها امسح الرمز أو زر:</p>
            <p className="font-medium text-[#3C2E52]" dir="ltr">{verifyUrl.replace(/^https?:\/\//, '').replace(/\/verify\/.*$/, '/verify')}</p>
            <p className="mt-0.5 font-mono text-[10.5px] tracking-wide text-[#3C2E52]" dir="ltr">{code.match(/.{1,4}/g)?.join(' ')}</p>
          </div>
        </div>
        <div className="text-center">
          <div className="text-[13px] font-semibold text-stone-600">إدارة خدمات ما بعد البيع</div>
          <div className="mt-2 flex h-[22mm] items-center justify-center">
            <span className="grid h-[20mm] w-[20mm] place-items-center rounded-full border-2 border-dashed border-[#B08D57]/60 text-[10px] font-bold leading-tight text-[#B08D57]">
              ضمان<br />معتمد
            </span>
          </div>
          <div className="mt-1 font-display text-[15px] font-bold text-ink">{c.name_ar}</div>
        </div>
      </div>

      <footer className="relative mt-6 border-t border-stone-200 pt-3 text-center text-[10.5px] text-stone-500" dir="ltr">
        {[c.phone, c.email, c.website?.replace(/^https?:\/\//, '')].filter(Boolean).join('   ·   ')}
      </footer>
    </article>
  );
}
