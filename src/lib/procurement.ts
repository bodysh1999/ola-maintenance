export type PurchaseStatus = 'quoting' | 'pending_approval' | 'approved' | 'purchased' | 'rejected' | 'cancelled';
export type ProcRole = 'admin' | 'approver' | 'rep' | null;

export type PurchaseRow = {
  id: string; ref_no: string; title: string; description: string | null; needed_by: string | null; project_id: string | null; project_name: string;
  requested_by: string | null; requester_name: string | null; rep_id: string | null; rep_name: string | null; quotes_required: number;
  status: PurchaseStatus; submit_note: string | null; submitted_at: string | null; chosen_quote_id: string | null;
  decided_by: string | null; decider_name: string | null; decided_at: string | null; decision_note: string | null;
  purchased_amount: number | null; invoice_path: string | null; purchase_note: string | null; purchased_at: string | null;
  created_at: string; quotes_count: number; min_amount: number | null; chosen_amount: number | null; chosen_no: number | null;
  chosen_supplier: string | null; chosen_supplier_phone: string | null;
};

export const PURCHASE_TONE: Record<PurchaseStatus, string> = {
  quoting: 'bg-sky-50 text-sky-800 ring-sky-200',
  pending_approval: 'bg-amber-50 text-amber-800 ring-amber-200',
  approved: 'bg-violet-50 text-violet-800 ring-violet-200',
  purchased: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  rejected: 'bg-rose-50 text-rose-800 ring-rose-200',
  cancelled: 'bg-stone-100 text-stone-600 ring-stone-200',
};

export const money = (n: number | string | null | undefined) =>
  n == null ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
