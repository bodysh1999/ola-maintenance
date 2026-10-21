'use client';

import { useTransition } from 'react';
import { Languages } from 'lucide-react';
import { setLocale } from '@/app/actions/common';
import { useI18n } from './client';
import { cx } from './ui';

export function LocaleToggle({ className, light }: { className?: string; light?: boolean }) {
  const { locale, d } = useI18n();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => setLocale(locale === 'ar' ? 'en' : 'ar'))}
      className={cx(
        'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm transition disabled:opacity-50',
        light ? 'text-white/80 hover:bg-white/10 hover:text-white' : 'text-ink/70 hover:bg-sand-100',
        className,
      )}
    >
      <Languages className="h-4 w-4" />
      {d.common.language}
    </button>
  );
}
