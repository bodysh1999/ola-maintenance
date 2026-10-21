'use client';

import { useState } from 'react';
import { FileSpreadsheet, Loader2, Printer } from 'lucide-react';
import { useI18n } from './client';
import { buttonClass } from './ui';

export type Sheet = { name: string; rows: Record<string, string | number | null>[] };

/** Builds a real .xlsx in the browser (SheetJS is loaded on demand). */
export function ExportExcelButton({ sheets, filename }: { sheets: Sheet[]; filename: string }) {
  const { d, locale } = useI18n();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      if (locale === 'ar') wb.Workbook = { Views: [{ RTL: true }] };
      for (const s of sheets) {
        const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{ '': d.common.noData }]);
        const keys = Object.keys(s.rows[0] ?? {});
        ws['!cols'] = keys.map((k) => ({ wch: Math.min(48, Math.max(k.length + 2, ...s.rows.map((r) => String(r[k] ?? '').length + 2))) }));
        XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
      }
      XLSX.writeFile(wb, `${filename}.xlsx`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button type="button" onClick={run} disabled={busy} className={buttonClass('outline', 'md')}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 text-emerald-700" />}
      {d.common.exportExcel}
    </button>
  );
}

/** PDF via the browser's print dialog ("Save as PDF") — keeps Arabic shaping and RTL intact. */
export function PrintPdfButton() {
  const { d } = useI18n();
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass('outline', 'md', 'no-print')}>
      <Printer className="h-4 w-4 text-rose-700" /> {d.common.exportPdf}
    </button>
  );
}
