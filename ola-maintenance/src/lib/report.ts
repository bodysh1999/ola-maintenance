import 'server-only';
import { createClient } from './supabase/server';
import type { Category, Priority, RequestStatus } from './types';

export type Report = {
  period: { from: string; to: string };
  kpis: {
    units: number; owners: number; total: number; new: number; in_progress: number; completed: number; rejected: number;
    overdue: number; completion_rate: number | null; avg_response_hours: number | null; avg_resolution_hours: number | null;
    avg_rating: number | null; satisfaction_rate: number | null; parts_cost: number; quotes_approved: number;
  };
  by_status: { key: RequestStatus; count: number }[];
  by_category: { key: Category; count: number }[];
  by_project: { key: string; count: number }[];
  by_priority: { key: Priority; count: number }[];
  daily: { day: string; created: number; completed: number }[];
  technicians: { id: string; name: string; assigned: number; completed: number; open: number; avg_hours: number | null; avg_rating: number | null; parts_cost: number }[];
};

export async function getReport(from: string, to: string): Promise<Report | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('report_summary', { p_from: from, p_to: to });
  if (error) {
    console.error('report_summary', error.message);
    return null;
  }
  return data as Report;
}
