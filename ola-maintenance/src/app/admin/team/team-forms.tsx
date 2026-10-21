'use client';

import { ActionForm, SubmitButton, useI18n } from '@/components/client';
import { Field, Input, Select } from '@/components/ui';
import { createContractor, createStaff, createTechnician, toggleStaff, toggleTechnician } from '@/app/actions/admin';
import { CATEGORIES } from '@/lib/constants';
import { Creator } from '../projects/forms';
import { TempPassword } from '../owners/owner-forms';

function Specialties() {
  const { d } = useI18n();
  return (
    <fieldset className="sm:col-span-full">
      <legend className="mb-2 text-[13px] font-medium text-ink/80">{d.admin.team.specialties}</legend>
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <label key={c} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-sand-300 px-3 py-1.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand has-[:checked]:text-white">
            <input type="checkbox" name="specialties" value={c} className="sr-only" />
            {d.category[c]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function TechnicianCreateForm({ contractors }: { contractors: { id: string; name: string }[] }) {
  const { d } = useI18n();
  const t = d.admin.team;
  return (
    <Creator label={t.addTech}>
      {() => (
        <ActionForm action={createTechnician} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
          {(state) => (
            <>
              <Field label={d.common.name} required><Input name="full_name" required /></Field>
              <Field label={d.common.email} required><Input name="email" type="email" required /></Field>
              <Field label={d.common.phone}><Input name="phone" type="tel" /></Field>
              <Field label={t.contractor}>
                <Select name="contractor_id" defaultValue="">
                  <option value="">{t.inHouse}</option>
                  {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Specialties />
              <div className="sm:col-span-2"><SubmitButton>{d.common.create}</SubmitButton></div>
              {state?.data?.password ? <div className="sm:col-span-2"><TempPassword email={String(state.data.email)} password={String(state.data.password)} /></div> : null}
            </>
          )}
        </ActionForm>
      )}
    </Creator>
  );
}

export function ContractorCreateForm() {
  const { d } = useI18n();
  const t = d.admin.team;
  return (
    <Creator label={t.addContractor}>
      {(close) => (
        <ActionForm action={createContractor} onSuccess={close} className="grid gap-3 sm:grid-cols-2">
          <Field label={d.common.name} required><Input name="name" required /></Field>
          <Field label={t.cr}><Input name="cr_number" dir="ltr" /></Field>
          <Field label={t.contact}><Input name="contact_name" /></Field>
          <Field label={d.common.phone}><Input name="phone" type="tel" /></Field>
          <Field label={d.common.email}><Input name="email" type="email" /></Field>
          <Specialties />
          <div className="sm:col-span-2"><SubmitButton>{d.common.create}</SubmitButton></div>
        </ActionForm>
      )}
    </Creator>
  );
}

export function StaffCreateForm() {
  const { d } = useI18n();
  return (
    <Creator label={d.admin.team.addStaff}>
      {() => (
        <ActionForm action={createStaff} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
          {(state) => (
            <>
              <Field label={d.common.name} required><Input name="full_name" required /></Field>
              <Field label={d.common.email} required><Input name="email" type="email" required /></Field>
              <Field label={d.common.phone}><Input name="phone" type="tel" /></Field>
              <Field label={d.admin.team.role}>
                <Select name="role" defaultValue="supervisor">
                  <option value="supervisor">{d.roles.supervisor}</option>
                  <option value="admin">{d.roles.admin}</option>
                </Select>
              </Field>
              <div className="sm:col-span-2"><SubmitButton>{d.common.create}</SubmitButton></div>
              {state?.data?.password ? <div className="sm:col-span-2"><TempPassword email={String(state.data.email)} password={String(state.data.password)} /></div> : null}
            </>
          )}
        </ActionForm>
      )}
    </Creator>
  );
}

export function ToggleActive({ kind, id, active }: { kind: 'technician' | 'staff'; id: string; active: boolean }) {
  const { d } = useI18n();
  return (
    <ActionForm action={kind === 'technician' ? toggleTechnician : toggleStaff}>
      <input type="hidden" name={kind === 'technician' ? 'technician_id' : 'profile_id'} value={id} />
      <input type="hidden" name="active" value={String(!active)} />
      <SubmitButton size="sm" variant="ghost" confirmText={active ? `${d.admin.owners.disable}?` : undefined}>
        {active ? d.admin.owners.disable : d.admin.owners.enable}
      </SubmitButton>
    </ActionForm>
  );
}
