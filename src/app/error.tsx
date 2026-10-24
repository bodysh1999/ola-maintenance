'use client';

import { useEffect } from 'react';
import { useI18n } from '@/components/client';
import { Button } from '@/components/ui';
import { reportClientError } from '@/lib/report-error';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { d } = useI18n();
  useEffect(() => { reportClientError(error); }, [error]);
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div>
        <p className="text-sm text-stone-450">{d.common.errorGeneric}</p>
        {error.digest && <p className="mt-1 font-mono text-[11px] text-stone-400" dir="ltr">#{error.digest}</p>}
        <Button className="mt-4" onClick={reset}>{d.common.back}</Button>
      </div>
    </div>
  );
}
