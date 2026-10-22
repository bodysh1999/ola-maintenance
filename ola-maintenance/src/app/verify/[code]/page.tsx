import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeCheck, ShieldAlert } from 'lucide-react';
import { anonClient } from '@/lib/public-data';
import { siteOrigin } from '@/lib/origin';
import { getSettings } from '@/lib/session';
import { HrLetter, LetterScale, type LetterData } from '@/components/hr-letter';
import { DEFAULT_LOGO } from '@/components/brand';
import { PrintButton } from '../../letters/[id]/print-button';

export const metadata: Metadata = { title: 'التحقق من وثيقة', robots: { index: false, follow: false } };

type Verified = { ref_no: string; type: 'salary_certificate' | 'experience_letter'; addressed_to: string | null; issued_at: string; data: LetterData };

/** Public page opened from the QR code on an HR letter */
export default async function VerifyDocument({ params }: { params: Promise<{ code: string }> }) {
  const [{ code: raw }, origin, s] = await Promise.all([params, siteOrigin(), getSettings()]);
  const code = decodeURIComponent(raw).replace(/[\s-]/g, '').toLowerCase();
  let doc: Verified | null = null;
  if (/^[0-9a-f]{32}$/i.test(code)) {
    const { data } = await anonClient().rpc('verify_hr_document', { p_code: code });
    doc = (data as Verified | null) ?? null;
  }
  const typeName = doc?.type === 'experience_letter' ? 'شهادة خبرة' : 'تعريف بالراتب';
  const issued = doc ? new Date(doc.issued_at).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return (
    <div dir="rtl" className="min-h-screen overflow-x-hidden bg-[#F7F5F9] pb-12 print:bg-white print:pb-0">
      <header className="bg-[#2A1F3A] text-white print:hidden">
        <div className="mx-auto flex max-w-[210mm] items-center justify-between gap-4 px-5 py-4">
          <Link href="/" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.logo_url || DEFAULT_LOGO} alt="" className="h-10 w-auto" />
            <span className="hidden text-sm text-white/80 sm:inline">{s.name_ar}</span>
          </Link>
          <span className="shrink-0 text-xs text-white/60">منصة التحقق</span>
        </div>
      </header>

      <div className="mx-auto max-w-[210mm] px-4 pt-8 print:hidden">
        {doc ? (
          <div className="flex flex-col gap-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white"><BadgeCheck className="h-8 w-8" /></span>
              <div className="min-w-0">
                <h1 className="text-lg font-bold leading-snug text-emerald-900 sm:text-xl">وثيقة صحيحة وصادرة من {s.name_ar}</h1>
                <p className="mt-1 text-sm text-emerald-800">{typeName} · رقم <span dir="ltr">{doc.ref_no}</span></p>
                <p className="text-sm text-emerald-800">صدرت بتاريخ {issued}</p>
              </div>
            </div>
            <div className="shrink-0"><PrintButton /></div>
          </div>
        ) : (
          <div className="flex items-center gap-4 rounded-3xl border border-rose-200 bg-rose-50 p-6">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-rose-600 text-white"><ShieldAlert className="h-8 w-8" /></span>
            <div>
              <h1 className="text-xl font-bold text-rose-900">لم نتمكن من التحقق من هذه الوثيقة</h1>
              <p className="mt-1 text-sm leading-relaxed text-rose-800">رمز التحقق غير صحيح أو أن الوثيقة غير معتمدة. للاستفسار تواصل مع الشركة{s.support_phone ? <> على <span dir="ltr">{s.support_phone}</span></> : null}.</p>
            </div>
          </div>
        )}
        {doc && <p className="mt-3 text-center text-xs text-stone-500">النسخة أدناه هي الوثيقة كما صدرت من النظام — طابِق بياناتها مع النسخة الورقية. أُخفيت أرقام الهوية جزئيًا لحماية الخصوصية.</p>}
      </div>

      {doc && (
        <div className="mt-6 px-4 print:mt-0 print:px-0">
          <LetterScale>
            <HrLetter type={doc.type} refNo={doc.ref_no} issuedAt={doc.issued_at} addressedTo={doc.addressed_to}
              data={doc.data} verifyUrl={`${origin}/verify/${code}`} />
          </LetterScale>
        </div>
      )}
    </div>
  );
}
