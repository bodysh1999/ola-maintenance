'use client';

import { useI18n } from '@/components/client';
import { Button } from '@/components/ui';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const { d } = useI18n();
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div>
        <p className="text-sm text-stone-450">{d.common.errorGeneric}</p>
        <Button className="mt-4" onClick={reset}>{d.common.back}</Button>
      </div>
    </div>
  );
}
