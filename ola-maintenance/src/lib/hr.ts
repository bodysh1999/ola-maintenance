export const STAFF_ROLES = ['admin', 'supervisor', 'technician', 'sales', 'hr', 'employee'] as const;
/** Shared HR helpers (no server-only imports — used by pages and client forms) */
export const HR_REQUEST_TYPES = [
  'leave', 'attendance_correction', 'presence', 'overtime', 'business_trip',
  'salary_certificate', 'salary_advance', 'exit_reentry', 'experience_letter',
] as const;
export type HrRequestType = (typeof HR_REQUEST_TYPES)[number];
export const HR_STATUS_TONE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-200', approved: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  rejected: 'bg-rose-50 text-rose-800 ring-rose-200', cancelled: 'bg-stone-100 text-stone-600 ring-stone-200',
};

export type Salary = { basic: number; housing: number; transport: number; other_allowances: number; other_deductions: number; gosi_rate: number | null };
export const GOSI_CAP = 45000; // contribution wage cap (basic + housing)

/** Monthly breakdown: GOSI is taken on basic + housing (capped), at the employee share for their nationality */
export function salaryBreakdown(s: Salary, nationality: 'saudi' | 'resident', rates: { saudi: number; resident: number }) {
  const n = (v: unknown) => Number(v ?? 0);
  const gross = n(s.basic) + n(s.housing) + n(s.transport) + n(s.other_allowances);
  const rate = s.gosi_rate ?? (nationality === 'saudi' ? rates.saudi : rates.resident);
  const gosi = Math.round(Math.min(n(s.basic) + n(s.housing), GOSI_CAP) * n(rate)) / 100;
  const deductions = gosi + n(s.other_deductions);
  return { gross, rate: n(rate), gosi, deductions, net: Math.round((gross - deductions) * 100) / 100 };
}

/** Saudi Labor Law Art. 107: hourly wage + 50% of the basic hourly wage (30-day month, 8-hour day) */
export function overtimeHourly(s: Salary) {
  const gross = Number(s.basic) + Number(s.housing) + Number(s.transport) + Number(s.other_allowances);
  return gross / 30 / 8 + 0.5 * (Number(s.basic) / 30 / 8);
}

export const sar = (v: number | string | null | undefined) =>
  Number(v ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function hoursBetween(a: string | null, b: string | null) {
  if (!a || !b) return null;
  return Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 36e5);
}
export const timeRiyadh = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit' }) : '—';
