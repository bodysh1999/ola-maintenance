import type { CompanySettings, Locale } from '@/lib/types';
import { cx } from './ui';

/** Bundled company logo (white mark) — used until another logo is uploaded in settings */
export const DEFAULT_LOGO = '/brand/logo.webp';

/**
 * Company logo + name. The logo is a white mark, so on light surfaces it sits on a
 * brand-coloured tile; on brand-coloured surfaces it is shown directly.
 */
export function BrandMark({ s, locale, light = false, size = 'md' }: { s: CompanySettings; locale: Locale; light?: boolean; size?: 'md' | 'lg' }) {
  const name = locale === 'ar' ? s.name_ar : s.name_en;
  const logo = s.logo_url || DEFAULT_LOGO;
  const tile = size === 'lg' ? 'h-16 w-[88px]' : 'h-10 w-14';
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className={cx(tile, 'grid shrink-0 place-items-center rounded-xl', light ? 'bg-white/[.06] ring-1 ring-white/10' : 'bg-brand')}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt={name} className="h-[78%] w-[86%] object-contain" />
      </div>
      <div className="min-w-0 leading-tight">
        <div className={cx('truncate font-semibold', size === 'lg' ? 'text-lg' : 'text-sm', light ? 'text-white' : 'text-ink')}>{name}</div>
        <div className={cx('truncate text-[11px]', light ? 'text-white/60' : 'text-stone-450')}>
          {locale === 'ar' ? 'خدمات ما بعد البيع' : 'After-sales services'}
        </div>
      </div>
    </div>
  );
}
