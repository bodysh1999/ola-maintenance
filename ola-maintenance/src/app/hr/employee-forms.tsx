'use client';

import { useRouter } from 'next/navigation';
import { ActionForm, SubmitButton, useI18n } from '@/components/client';
import { Field, Input, Select } from '@/components/ui';
import { TempPassword } from '@/app/admin/owners/owner-forms';
import { createEmployeeAccount, linkEmployeeProfile, saveDepartment, saveEmployee, saveLocation, savePrivate, saveSalary, updateHrSettings, updateLeaveType } from '@/app/actions/hr';
import { salaryBreakdown, sar, type Salary } from '@/lib/hr';
import type { ActionResult } from '@/lib/types';

type Opt = { id: string; label: string };
export type EmployeeRow = {
  id?: string; full_name?: string; full_name_en?: string | null; email?: string | null; phone?: string | null; job_title?: string;
  department_id?: string | null; manager_id?: string | null; nationality_type?: 'saudi' | 'resident'; nationality?: string | null; gender?: 'male' | 'female';
  hire_date?: string; contract_type?: 'unlimited' | 'fixed'; contract_end?: string | null; annual_leave_days?: number; leave_opening_balance?: number;
  leave_accrual_start?: string | null; work_location_id?: string | null; remote_allowed?: boolean; work_start?: string; work_end?: string; status?: string;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
      <legend className="mb-1 w-full border-b border-sand-100 pb-2 text-sm font-semibold text-brand">{title}</legend>
      {children}
    </fieldset>
  );
}

export function EmployeeForm({ e, departments, managers, locations }: { e: EmployeeRow; departments: Opt[]; managers: Opt[]; locations: Opt[] }) {
  const { d } = useI18n();
  const h = d.hrm; const f = h.fields; const i = d.me.info;
  const router = useRouter();
  const onSuccess = (r: ActionResult) => { if (!e.id && r?.data?.id) router.push(`/hr/employees/${r.data.id}`); };
  return (
    <ActionForm action={saveEmployee} onSuccess={onSuccess} className="grid gap-5 sm:grid-cols-2" successText={d.common.saved}>
      {e.id && <input type="hidden" name="id" value={e.id} />}
      <Section title={h.sections.basic}>
        <Field label={f.fullName} required><Input name="full_name" required defaultValue={e.full_name} /></Field>
        <Field label={f.fullNameEn}><Input name="full_name_en" dir="ltr" defaultValue={e.full_name_en ?? ''} /></Field>
        <Field label={d.common.email}><Input name="email" type="email" dir="ltr" defaultValue={e.email ?? ''} /></Field>
        <Field label={d.common.phone}><Input name="phone" type="tel" dir="ltr" defaultValue={e.phone ?? ''} /></Field>
        <Field label={i.type}>
          <Select name="nationality_type" defaultValue={e.nationality_type ?? 'saudi'}><option value="saudi">{i.saudi}</option><option value="resident">{i.resident}</option></Select>
        </Field>
        <Field label={f.nationality}><Input name="nationality" defaultValue={e.nationality ?? ''} placeholder="سعودي" /></Field>
        <Field label={f.gender}>
          <Select name="gender" defaultValue={e.gender ?? 'male'}><option value="male">{f.male}</option><option value="female">{f.female}</option></Select>
        </Field>
        <Field label={f.status}>
          <Select name="status" defaultValue={e.status ?? 'active'}>{(['active', 'suspended', 'terminated'] as const).map((k) => <option key={k} value={k}>{f[k]}</option>)}</Select>
        </Field>
      </Section>
      <Section title={h.sections.job}>
        <Field label={i.jobTitle} required><Input name="job_title" required defaultValue={e.job_title} /></Field>
        <Field label={i.department}>
          <Select name="department_id" defaultValue={e.department_id ?? ''}><option value="">—</option>{departments.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select>
        </Field>
        <Field label={i.manager}>
          <Select name="manager_id" defaultValue={e.manager_id ?? ''}><option value="">{f.noManager}</option>{managers.filter((o) => o.id !== e.id).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select>
        </Field>
        <Field label={i.hireDate} required><Input name="hire_date" type="date" required defaultValue={e.hire_date ?? ''} /></Field>
        <Field label={i.contract}>
          <Select name="contract_type" defaultValue={e.contract_type ?? 'unlimited'}><option value="unlimited">{i.unlimited}</option><option value="fixed">{i.fixed}</option></Select>
        </Field>
        <Field label={i.contractEnd}><Input name="contract_end" type="date" defaultValue={e.contract_end ?? ''} /></Field>
        <Field label={i.location}>
          <Select name="work_location_id" defaultValue={e.work_location_id ?? ''}><option value="">—</option>{locations.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={f.workStart}><Input name="work_start" type="time" defaultValue={e.work_start?.slice(0, 5) ?? '08:00'} /></Field>
          <Field label={f.workEnd}><Input name="work_end" type="time" defaultValue={e.work_end?.slice(0, 5) ?? '17:00'} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="remote_allowed" defaultChecked={e.remote_allowed} className="h-4 w-4 accent-brand" />{f.remote}</label>
      </Section>
      <Section title={h.sections.leave}>
        <Field label={i.leaveDays} hint="21 / 30"><Input name="annual_leave_days" type="number" min={21} max={60} defaultValue={e.annual_leave_days ?? 21} /></Field>
        <Field label={f.opening}><Input name="leave_opening_balance" type="number" step="0.5" defaultValue={e.leave_opening_balance ?? 0} /></Field>
        <Field label={f.accrualStart}><Input name="leave_accrual_start" type="date" defaultValue={e.leave_accrual_start ?? ''} /></Field>
      </Section>
      <div className="sm:col-span-2"><SubmitButton size="lg">{e.id ? d.common.save : d.common.create}</SubmitButton></div>
    </ActionForm>
  );
}

export function SalaryForm({ employeeId, salary, nationality, rates }: { employeeId: string; salary: Salary | null; nationality: 'saudi' | 'resident'; rates: { saudi: number; resident: number } }) {
  const { d } = useI18n();
  const s = d.me.salary;
  const br = salary ? salaryBreakdown(salary, nationality, rates) : null;
  return (
    <ActionForm action={saveSalary} className="grid gap-3 sm:grid-cols-2" successText={d.common.saved}>
      <input type="hidden" name="employee_id" value={employeeId} />
      <Field label={s.basic}><Input name="basic" type="number" min={0} step="0.01" dir="ltr" defaultValue={salary?.basic ?? ''} /></Field>
      <Field label={s.housing}><Input name="housing" type="number" min={0} step="0.01" dir="ltr" defaultValue={salary?.housing ?? ''} /></Field>
      <Field label={s.transport}><Input name="transport" type="number" min={0} step="0.01" dir="ltr" defaultValue={salary?.transport ?? ''} /></Field>
      <Field label={s.other}><Input name="other_allowances" type="number" min={0} step="0.01" dir="ltr" defaultValue={salary?.other_allowances ?? ''} /></Field>
      <Field label={s.otherDed}><Input name="other_deductions" type="number" min={0} step="0.01" dir="ltr" defaultValue={salary?.other_deductions ?? ''} /></Field>
      <Field label={d.hrm.fields.gosiRate}><Input name="gosi_rate" type="number" min={0} max={30} step="0.01" dir="ltr" defaultValue={salary?.gosi_rate ?? ''} /></Field>
      {br && (
        <p className="rounded-xl bg-sand-50 px-4 py-3 text-sm sm:col-span-2">
          {s.gross}: <b>{sar(br.gross)}</b> · {s.gosi} ({br.rate}%): <b>{sar(br.gosi)}</b> · {s.net}: <b className="text-brand">{sar(br.net)}</b> {d.common.sar}
        </p>
      )}
      <div className="sm:col-span-2"><SubmitButton>{d.common.save}</SubmitButton></div>
    </ActionForm>
  );
}

export function PrivateForm({ employeeId, p }: { employeeId: string; p: { id_number?: string | null; id_expiry?: string | null; birth_date?: string | null; iban?: string | null; bank_name?: string | null } | null }) {
  const { d } = useI18n();
  const i = d.me.info;
  return (
    <ActionForm action={savePrivate} className="grid gap-3 sm:grid-cols-2" successText={d.common.saved}>
      <input type="hidden" name="employee_id" value={employeeId} />
      <Field label={i.idNumber}><Input name="id_number" dir="ltr" defaultValue={p?.id_number ?? ''} /></Field>
      <Field label={i.idExpiry}><Input name="id_expiry" type="date" defaultValue={p?.id_expiry ?? ''} /></Field>
      <Field label={i.iban}><Input name="iban" dir="ltr" defaultValue={p?.iban ?? ''} placeholder="SA…" /></Field>
      <Field label={i.bank}><Input name="bank_name" defaultValue={p?.bank_name ?? ''} /></Field>
      <div className="sm:col-span-2"><SubmitButton>{d.common.save}</SubmitButton></div>
    </ActionForm>
  );
}

export function AccountForms({ employeeId, hasEmail, profiles }: { employeeId: string; hasEmail: boolean; profiles: Opt[] }) {
  const { d } = useI18n();
  const a = d.hrm.account;
  return (
    <div className="space-y-4">
      <ActionForm action={createEmployeeAccount}>
        {(state) => (
          <>
            <input type="hidden" name="employee_id" value={employeeId} />
            <SubmitButton>{a.create}</SubmitButton>
            {!hasEmail && <p className="mt-1 text-xs text-stone-450">{d.errors.OWNER_NEEDS_EMAIL}</p>}
            {state?.data?.password ? <div className="mt-3"><TempPassword email={String(state.data.email)} password={String(state.data.password)} /></div> : null}
          </>
        )}
      </ActionForm>
      {profiles.length > 0 && (
        <ActionForm action={linkEmployeeProfile} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="employee_id" value={employeeId} />
          <Field label={a.link} className="min-w-56 flex-1">
            <Select name="profile_id" required defaultValue=""><option value="" disabled>—</option>{profiles.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select>
          </Field>
          <SubmitButton variant="outline" className="h-11">{a.linkBtn}</SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ structure
export function LocationForm({ loc }: { loc?: { id: string; name: string; lat: number; lng: number; radius_m: number; is_active: boolean } }) {
  const { d } = useI18n();
  const l = d.hrm.locations;
  return (
    <ActionForm action={saveLocation} resetOnSuccess={!loc} className="grid items-end gap-2 sm:grid-cols-[1.4fr_1fr_1fr_110px_auto]" successText={d.common.saved}>
      {loc && <input type="hidden" name="id" value={loc.id} />}
      <Field label={l.name}><Input name="name" required defaultValue={loc?.name} /></Field>
      <Field label={l.lat}><Input name="lat" required inputMode="decimal" dir="ltr" defaultValue={loc?.lat} placeholder="21.5433" /></Field>
      <Field label={l.lng}><Input name="lng" required inputMode="decimal" dir="ltr" defaultValue={loc?.lng} placeholder="39.1728" /></Field>
      <Field label={l.radius}><Input name="radius_m" type="number" min={20} max={5000} defaultValue={loc?.radius_m ?? 150} /></Field>
      <SubmitButton variant={loc ? 'outline' : 'primary'} className="h-11">{loc ? d.common.save : l.add}</SubmitButton>
    </ActionForm>
  );
}

export function DepartmentForm({ dep, departments, managers }: { dep?: { id: string; name: string; parent_id: string | null; manager_employee_id: string | null }; departments: Opt[]; managers: Opt[] }) {
  const { d } = useI18n();
  const t = d.hrm.departments;
  return (
    <ActionForm action={saveDepartment} resetOnSuccess={!dep} className="grid items-end gap-2 sm:grid-cols-[1.3fr_1fr_1fr_auto]" successText={d.common.saved}>
      {dep && <input type="hidden" name="id" value={dep.id} />}
      <Field label={t.name}><Input name="name" required defaultValue={dep?.name} /></Field>
      <Field label={t.parent}><Select name="parent_id" defaultValue={dep?.parent_id ?? ''}><option value="">—</option>{departments.filter((o) => o.id !== dep?.id).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select></Field>
      <Field label={t.manager}><Select name="manager_employee_id" defaultValue={dep?.manager_employee_id ?? ''}><option value="">—</option>{managers.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select></Field>
      <SubmitButton variant={dep ? 'outline' : 'primary'} className="h-11">{dep ? d.common.save : t.add}</SubmitButton>
    </ActionForm>
  );
}

export function LeaveTypeRow({ lt }: { lt: { code: string; name_ar: string; name_en: string; max_days: number | null; is_active: boolean; note_ar: string | null } }) {
  const { d, locale } = useI18n();
  return (
    <ActionForm action={updateLeaveType} className="grid items-center gap-2 py-3 sm:grid-cols-[1.6fr_120px_auto_auto]">
      <input type="hidden" name="code" value={lt.code} />
      <div><div className="text-sm font-medium">{locale === 'en' ? lt.name_en : lt.name_ar}</div>{lt.note_ar && locale === 'ar' && <div className="text-xs text-stone-450">{lt.note_ar}</div>}</div>
      <Input name="max_days" type="number" min={1} defaultValue={lt.max_days ?? ''} placeholder={d.hrm.leaveTypes.maxDays} className="h-9" />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={lt.is_active} className="h-4 w-4 accent-brand" />{d.hrm.leaveTypes.active}</label>
      <SubmitButton size="sm" variant="outline">{d.common.save}</SubmitButton>
    </ActionForm>
  );
}

export function HrSettingsForm({ s }: { s: { gosi_saudi_rate?: number; gosi_resident_rate?: number; trip_per_diem?: number; hr_letter_signatory?: string | null } }) {
  const { d } = useI18n();
  const t = d.hrm.settings;
  return (
    <ActionForm action={updateHrSettings} className="grid gap-3 sm:grid-cols-2" successText={d.common.saved}>
      <Field label={t.gosiSaudi}><Input name="gosi_saudi_rate" type="number" step="0.01" min={0} max={30} dir="ltr" defaultValue={s.gosi_saudi_rate ?? 9.75} /></Field>
      <Field label={t.gosiResident}><Input name="gosi_resident_rate" type="number" step="0.01" min={0} max={30} dir="ltr" defaultValue={s.gosi_resident_rate ?? 0} /></Field>
      <Field label={t.perDiem}><Input name="trip_per_diem" type="number" min={0} dir="ltr" defaultValue={s.trip_per_diem ?? 500} /></Field>
      <Field label={t.signatory}><Input name="hr_letter_signatory" defaultValue={s.hr_letter_signatory ?? ''} /></Field>
      <div className="sm:col-span-2"><SubmitButton>{d.common.save}</SubmitButton></div>
    </ActionForm>
  );
}
