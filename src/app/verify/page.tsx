import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { getSettings } from '@/lib/session';
import { DEFAULT_LOGO } from '@/components/brand';

export const metadata: Metadata = { title: 'التحقق من وثيقة' };

async function go(fd: FormData) {
  'use server';
  const code = String(fd.get('code') ?? '').replace(/[\s-]/g, '').toLowerCase();
  redirect(`/verify/${encodeURIComponent(code || 'x')}`);
}

/** Manual entry of a verification code printed on an HR letter */
export default async function VerifyHome() {
  const s = await getSettings();
  return (
    <div dir="rtl" className="grid min-h-screen place-items-center bg-[#F7F5F9] px-4">
      <form action={go} className="w-full max-w-md rounded-[28px] border border-sand-200 bg-white p-8 text-center shadow-lift">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={s.logo_url || DEFAULT_LOGO} alt="" className="mx-auto h-14 w-auto rounded-xl bg-[#3C2E52] p-2" />
        <h1 className="mt-5 flex items-center justify-center gap-2 text-xl font-bold text-ink"><ShieldCheck className="h-5 w-5 text-accent" />التحقق من وثيقة</h1>
        <p className="mt-2 text-sm text-stone-450">أدخل رمز التحقق المطبوع أسفل الوثيقة بجانب رمز QR</p>
        <input name="code" required dir="ltr" autoComplete="off" placeholder="c8d1 9922 fb17 …"
          className="mt-6 h-12 w-full rounded-xl border border-sand-200 px-4 text-center font-mono tracking-wider outline-none focus:border-brand focus:ring-4 focus:ring-brand/10" />
        <button className="mt-4 h-12 w-full rounded-full bg-brand font-semibold text-white hover:bg-brand/90">تحقق</button>
      </form>
    </div>
  );
}
