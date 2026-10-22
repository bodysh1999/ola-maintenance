import type { Category, Priority, RequestStatus } from './types';

export const CATEGORIES: Category[] = [
  'electrical', 'plumbing', 'hvac', 'elevators', 'tiles',
  'painting', 'doors_windows', 'insulation', 'appliances', 'other',
];

export const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];

/** The main 8-stage pipeline shown to owners as a progress tracker */
export const MAIN_STAGES: RequestStatus[] = [
  'new', 'under_review', 'approved', 'assigned', 'scheduled', 'in_progress', 'pending_approval', 'completed',
];

export const SIDE_STATUSES: RequestStatus[] = ['awaiting_parts', 'postponed', 'rejected', 'reopened'];

export const ALL_STATUSES: RequestStatus[] = [...MAIN_STAGES, ...SIDE_STATUSES];

export const OPEN_STATUSES: RequestStatus[] = ALL_STATUSES.filter((s) => s !== 'completed' && s !== 'rejected');

/** Mirrors public.status_transition_allowed() — the database is the source of truth */
export const STAFF_TRANSITIONS: Partial<Record<RequestStatus, RequestStatus[]>> = {
  new: ['under_review', 'approved', 'postponed', 'rejected'],
  under_review: ['approved', 'postponed', 'rejected'],
  approved: ['postponed', 'rejected'],
  assigned: ['awaiting_parts', 'postponed'],
  scheduled: ['in_progress', 'awaiting_parts', 'postponed'],
  in_progress: ['awaiting_parts', 'postponed'],
  pending_approval: ['completed', 'in_progress'],
  awaiting_parts: ['in_progress', 'postponed'],
  postponed: ['under_review', 'approved'],
  rejected: ['reopened'],
  completed: ['reopened'],
  reopened: ['under_review', 'approved', 'rejected'],
};

export const NOTE_REQUIRED: RequestStatus[] = ['rejected', 'postponed'];

export const STATUS_TONE: Record<RequestStatus, string> = {
  new: 'bg-sky-50 text-sky-800 ring-sky-200',
  under_review: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  approved: 'bg-teal-50 text-teal-800 ring-teal-200',
  assigned: 'bg-violet-50 text-violet-800 ring-violet-200',
  scheduled: 'bg-cyan-50 text-cyan-800 ring-cyan-200',
  in_progress: 'bg-amber-50 text-amber-800 ring-amber-200',
  pending_approval: 'bg-orange-50 text-orange-800 ring-orange-200',
  completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  awaiting_parts: 'bg-yellow-50 text-yellow-800 ring-yellow-200',
  postponed: 'bg-stone-100 text-stone-700 ring-stone-200',
  rejected: 'bg-rose-50 text-rose-800 ring-rose-200',
  reopened: 'bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-200',
};

export const STATUS_HEX: Record<RequestStatus, string> = {
  new: '#0EA5E9', under_review: '#6366F1', approved: '#14B8A6', assigned: '#8B5CF6',
  scheduled: '#06B6D4', in_progress: '#F59E0B', pending_approval: '#F97316', completed: '#10B981',
  awaiting_parts: '#EAB308', postponed: '#A8A29E', rejected: '#F43F5E', reopened: '#D946EF',
};

export const PRIORITY_TONE: Record<Priority, string> = {
  low: 'bg-stone-100 text-stone-700 ring-stone-200',
  medium: 'bg-sky-50 text-sky-800 ring-sky-200',
  high: 'bg-orange-50 text-orange-800 ring-orange-200',
  urgent: 'bg-rose-600 text-white ring-rose-600',
};

export const WARRANTY_TONE = {
  in_warranty: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  out_of_warranty: 'bg-rose-50 text-rose-800 ring-rose-200',
  unknown: 'bg-stone-100 text-stone-700 ring-stone-200',
} as const;

export const LOCATIONS_AR = ['المطبخ', 'الصالة', 'المجلس', 'غرفة النوم الرئيسية', 'غرفة نوم', 'دورة المياه', 'غرفة الغسيل', 'الممر', 'السطح', 'الحوش / الفناء', 'المدخل', 'الواجهة الخارجية'];
export const LOCATIONS_EN = ['Kitchen', 'Living room', 'Majlis', 'Master bedroom', 'Bedroom', 'Bathroom', 'Laundry', 'Corridor', 'Roof', 'Courtyard', 'Entrance', 'Exterior facade'];

/** Standard warranty package (editable after applying) — durations in years */
export const STANDARD_WARRANTIES: { category: Category | null; title: string; years: number; covered: string; excluded: string }[] = [
  { category: 'other', title: 'الضمان الإنشائي (الهيكل)', years: 10, covered: 'الأساسات والأعمدة والجسور والأسقف الخرسانية', excluded: 'التعديلات الإنشائية من المالك' },
  { category: 'insulation', title: 'ضمان العزل المائي والحراري', years: 10, covered: 'عزل الأسطح ودورات المياه والخزانات', excluded: 'الأضرار الناتجة عن تركيبات المالك على السطح' },
  { category: 'electrical', title: 'ضمان الأعمال الكهربائية', years: 2, covered: 'التمديدات واللوحات والقواطع والمفاتيح', excluded: 'الأجهزة الكهربائية الخاصة بالمالك وسوء الاستخدام' },
  { category: 'plumbing', title: 'ضمان أعمال السباكة', years: 2, covered: 'التمديدات والمحابس والصرف والسخانات المركبة', excluded: 'الانسداد بسبب سوء الاستخدام والأدوات الصحية المكسورة' },
  { category: 'hvac', title: 'ضمان التكييف', years: 1, covered: 'وحدات التكييف المركبة وتمديدات النحاس والتصريف', excluded: 'تنظيف الفلاتر والصيانة الدورية' },
  { category: 'elevators', title: 'ضمان المصاعد', years: 2, covered: 'المحرك ولوحات التحكم والأبواب', excluded: 'الأضرار الناتجة عن التحميل الزائد' },
  { category: 'doors_windows', title: 'ضمان الأبواب والنوافذ', years: 1, covered: 'المفصلات والأقفال والألمنيوم والزجاج المركب', excluded: 'الكسر الناتج عن الاستخدام' },
  { category: 'tiles', title: 'ضمان البلاط والسيراميك', years: 1, covered: 'التشققات والانفصال غير الناتج عن صدمات', excluded: 'الكسر بسبب سقوط أجسام' },
  { category: 'painting', title: 'ضمان الدهانات', years: 1, covered: 'التقشر والتشقق الطبيعي', excluded: 'الاتساخ والخدوش' },
];

/** Background photo of the login hero (a company project from ola-altamayuz.com); the brand colour shows if it can't load */
export const LOGIN_HERO_IMAGE = 'https://files.cdn-files-a.com/uploads/7515788/800_6914f1c01fbad.jpg';
