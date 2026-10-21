export type Role = 'admin' | 'supervisor' | 'technician' | 'owner';

export type RequestStatus =
  | 'new' | 'under_review' | 'approved' | 'assigned' | 'scheduled' | 'in_progress'
  | 'pending_approval' | 'completed' | 'awaiting_parts' | 'postponed' | 'rejected' | 'reopened';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export type Category =
  | 'electrical' | 'plumbing' | 'hvac' | 'elevators' | 'tiles'
  | 'painting' | 'doors_windows' | 'insulation' | 'appliances' | 'other';

export type WarrantyState = 'in_warranty' | 'out_of_warranty' | 'unknown';
export type WorkOrderStatus = 'assigned' | 'in_progress' | 'awaiting_parts' | 'submitted' | 'approved' | 'returned' | 'cancelled';
export type AttachmentKind = 'request' | 'before' | 'after' | 'quote' | 'other';
export type Locale = 'ar' | 'en';

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  email: string | null;
  phone: string | null;
  locale: Locale;
  is_active: boolean;
}

export interface CompanySettings {
  name_ar: string;
  name_en: string;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  support_phone: string | null;
  support_email: string | null;
  response_sla_hours: number;
  resolution_sla_hours: number;
  reopen_window_days: number;
  notify_channels: string[];
  whatsapp: string | null;
  website_url: string | null;
  instagram_url: string | null;
  snapchat_url: string | null;
  tiktok_url: string | null;
}

export interface RequestRow {
  id: string;
  ref_no: string;
  unit_id: string;
  owner_id: string;
  category: Category;
  location_in_unit: string;
  description: string;
  preferred_date: string | null;
  preferred_slot: 'morning' | 'afternoon' | 'evening' | null;
  priority: Priority;
  status: RequestStatus;
  warranty_state: WarrantyState;
  warranty_id: string | null;
  warranty_note: string | null;
  reject_reason: string | null;
  is_paid: boolean;
  reopen_count: number;
  created_at: string;
  updated_at: string;
  first_response_at: string | null;
  completed_at: string | null;
  due_at: string | null;
}

export interface RequestOverview extends RequestRow {
  unit_number: string;
  floor: number;
  unit_type: string;
  unit_image_url: string | null;
  building_id: string;
  building_name: string;
  project_id: string;
  project_name_ar: string;
  project_name_en: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  work_order_id: string | null;
  work_order_status: WorkOrderStatus | null;
  technician_id: string | null;
  technician_name: string | null;
  technician_phone: string | null;
  visit_at: string | null;
  visit_ends_at: string | null;
  is_overdue: boolean;
  rating_score: number | null;
}

export interface ActivityLog {
  id: string;
  action: string;
  from_status: RequestStatus | null;
  to_status: RequestStatus | null;
  note: string | null;
  meta: Record<string, unknown>;
  actor_name: string | null;
  actor_role: Role | null;
  created_at: string;
}

export interface Attachment {
  id: string;
  request_id: string;
  work_order_id: string | null;
  kind: AttachmentKind;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  created_at: string;
  url?: string;
}

export type ActionResult = { ok?: boolean; error?: string; message?: string; data?: Record<string, unknown> } | undefined;
