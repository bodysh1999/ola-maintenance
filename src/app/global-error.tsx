'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/report-error';

/** Last-resort boundary (the root layout itself failed) — plain HTML, no providers available */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportClientError(error); }, [error]);
  return (
    <html lang="ar" dir="rtl">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0, background: '#faf8f5', color: '#1c1917' }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <p>حدث خطأ غير متوقع — Something went wrong</p>
          {error.digest && <p style={{ fontSize: 11, color: '#a8a29e', fontFamily: 'monospace' }} dir="ltr">#{error.digest}</p>}
          <button onClick={reset} style={{ marginTop: 16, padding: '10px 20px', borderRadius: 12, border: 0, background: '#1f3a33', color: '#fff', cursor: 'pointer' }}>إعادة المحاولة</button>
        </div>
      </body>
    </html>
  );
}
