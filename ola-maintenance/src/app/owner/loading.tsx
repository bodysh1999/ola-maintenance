import { BrandLoader } from '@/components/brand-loader';

/** تحميل داخل الواجهة — القائمة الجانبية تبقى ظاهرة والمحتوى يُستبدل بمؤشر التحميل */
export default function Loading() {
  return <BrandLoader />;
}
