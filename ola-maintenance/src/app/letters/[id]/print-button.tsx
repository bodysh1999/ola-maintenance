'use client';
import { Printer } from 'lucide-react';

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-white">
      <Printer className="h-4 w-4" /> طباعة / حفظ PDF
    </button>
  );
}
