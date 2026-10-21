export const LEAD_KINDS = ['visit', 'booking', 'service', 'inquiry'] as const;
export const LEAD_STATUSES = ['new', 'contacted', 'scheduled', 'visited', 'negotiating', 'booked', 'won', 'lost', 'cancelled'] as const;
export const APPLICATION_STATUSES = ['new', 'screening', 'interview', 'offer', 'hired', 'accepted', 'rejected', 'archived'] as const;
export const SALE_STATUSES = ['available', 'reserved', 'sold', 'not_for_sale'] as const;
export const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'training'] as const;
export const OPEN_LEAD = ['new', 'contacted', 'scheduled', 'visited', 'negotiating', 'booked'];

export const LEAD_TONE: Record<string, string> = {
  new: 'bg-sky-50 text-sky-800 ring-sky-200', contacted: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  scheduled: 'bg-violet-50 text-violet-800 ring-violet-200', visited: 'bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-200',
  negotiating: 'bg-amber-50 text-amber-800 ring-amber-200', booked: 'bg-teal-50 text-teal-800 ring-teal-200',
  won: 'bg-emerald-50 text-emerald-800 ring-emerald-200', lost: 'bg-stone-100 text-stone-600 ring-stone-200',
  cancelled: 'bg-stone-100 text-stone-600 ring-stone-200',
};
export const APP_TONE: Record<string, string> = {
  new: 'bg-sky-50 text-sky-800 ring-sky-200', screening: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  interview: 'bg-violet-50 text-violet-800 ring-violet-200', offer: 'bg-amber-50 text-amber-800 ring-amber-200',
  hired: 'bg-emerald-50 text-emerald-800 ring-emerald-200', accepted: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  rejected: 'bg-stone-100 text-stone-600 ring-stone-200', archived: 'bg-stone-100 text-stone-600 ring-stone-200',
};
export const SALE_TONE: Record<string, string> = {
  available: 'bg-emerald-50 text-emerald-800 ring-emerald-200', reserved: 'bg-amber-50 text-amber-800 ring-amber-200',
  sold: 'bg-stone-100 text-stone-600 ring-stone-200', not_for_sale: 'bg-sand-100 text-stone-500 ring-sand-200',
};
