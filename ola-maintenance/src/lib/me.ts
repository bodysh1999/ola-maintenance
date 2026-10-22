import 'server-only';
import { cache } from 'react';
import { createClient } from './supabase/server';
import type { Salary } from './hr';

export type MyEmployee = {
  id: string; emp_no: string; full_name: string; full_name_en: string | null; email: string | null; phone: string | null; job_title: string;
  nationality_type: 'saudi' | 'resident'; nationality: string | null; gender: 'male' | 'female'; hire_date: string;
  contract_type: 'unlimited' | 'fixed'; contract_end: string | null; annual_leave_days: number; remote_allowed: boolean;
  work_start: string; work_end: string; status: string; manager_id: string | null;
  departments: { name: string } | null; manager: { full_name: string; job_title: string } | null;
  work_locations: { name: string } | null;
};
export type Balance = { accrued: number; used: number; pending: number; available: number; yearly_rate: number; service_years: number };

/** The signed-in user's employee file (RLS: own row) */
export const getMyEmployee = cache(async (): Promise<MyEmployee | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('employees')
    .select('*, departments!employees_department_id_fkey(name), manager:manager_id(full_name, job_title), work_locations(name)')
    .eq('profile_id', user.id).neq('status', 'terminated').maybeSingle();
  return (data as MyEmployee) ?? null;
});

export async function getBalance(employeeId: string): Promise<Balance | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('leave_balance', { p_emp: employeeId });
  const row = Array.isArray(data) ? data[0] : data;
  return row ? Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Number(v)])) as Balance : null;
}

export async function getSalary(employeeId: string): Promise<Salary | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('employee_salaries').select('*').eq('employee_id', employeeId).maybeSingle();
  return (data as Salary) ?? null;
}

export async function pendingApprovalsCount(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('my_pending_approvals_count');
  return Number(data ?? 0);
}
