import { BrandLoader } from '@/components/brand-loader';

/** شاشة التحميل العامة — تظهر عند فتح الموقع وأثناء التنقل بين الصفحات خارج لوحات التحكم */
export default function Loading() {
  return <BrandLoader fullscreen />;
}
