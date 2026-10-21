import Link from 'next/link';
import { getI18n } from '@/lib/session';
import { buttonClass } from '@/components/ui';

export default async function NotFound() {
  const { locale } = await getI18n();
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div>
        <div className="text-6xl font-semibold text-brand/20">404</div>
        <p className="mt-2 text-sm text-stone-450">{locale === 'ar' ? 'الصفحة غير موجودة أو ليست لديك صلاحية لعرضها.' : 'This page does not exist or you do not have access to it.'}</p>
        <Link href="/" className={buttonClass('primary', 'md', 'mt-6')}>{locale === 'ar' ? 'الصفحة الرئيسية' : 'Home'}</Link>
      </div>
    </div>
  );
}
