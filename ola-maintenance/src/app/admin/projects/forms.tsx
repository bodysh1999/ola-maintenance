'use client';

import { useState, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { ActionForm, SubmitButton, useI18n } from '@/components/client';
import { Button, Field, Input, Select, Textarea } from '@/components/ui';
import { addWarranty, applyStandardWarranties, createBuilding, createProject, createUnit, updateProject, updateUnit } from '@/app/actions/admin';
import { SALE_STATUSES } from '@/lib/sales-hr';
import { CATEGORIES } from '@/lib/constants';

/** Collapsible inline creator panel */
export function Creator({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Button type="button" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />{label}</Button>;
  return (
    <div className="w-full rounded-2xl border border-sand-200 bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">{label}</h3>
        <button type="button" aria-label="close" onClick={() => setOpen(false)} className="text-stone-450 hover:text-ink"><X className="h-5 w-5" /></button>
      </div>
      {children(() => setOpen(false))}
    </div>
  );
}

export function ProjectForm() {
  const { d } = useI18n();
  const p = d.admin.projects;
  return (
    <Creator label={p.add}>
      {(close) => (
        <ActionForm action={createProject} onSuccess={close} className="grid gap-3 sm:grid-cols-2">
          <Field label={p.nameAr} required><Input name="name_ar" required /></Field>
          <Field label={p.nameEn}><Input name="name_en" dir="ltr" /></Field>
          <Field label={p.city}><Input name="city" defaultValue="جدة" /></Field>
          <Field label={p.district}><Input name="district" /></Field>
          <Field label={p.year}><Input name="delivery_year" type="number" min={2000} max={2100} /></Field>
          <Field label={p.image}><Input name="image_url" type="url" dir="ltr" placeholder="https://" /></Field>
          <Field label={p.salesStatus}>
            <Select name="sales_status" defaultValue="sold">
              {(['sold', 'selling', 'construction'] as const).map((k) => <option key={k} value={k}>{p.stage[k]}</option>)}
            </Select>
          </Field>
          <div className="sm:col-span-2"><SubmitButton>{d.common.create}</SubmitButton></div>
        </ActionForm>
      )}
    </Creator>
  );
}

type ProjectRow = {
  id: string; name_ar: string; name_en: string | null; city: string; district: string | null; delivery_year: number | null; image_url: string | null;
  description: string | null; sales_status: string; address_text?: string | null; location_url?: string | null; map_query?: string | null; visit_hours?: string | null;
};

/** Project details shown on the public website (location for visits, description, stage) */
export function ProjectSiteForm({ project }: { project: ProjectRow }) {
  const { d } = useI18n();
  const p = d.admin.projects;
  const s = d.site;
  return (
    <Creator label={s.editProject}>
      {() => (
        <ActionForm action={updateProject} className="grid gap-3 sm:grid-cols-2" successText={d.common.saved}>
          <input type="hidden" name="id" value={project.id} />
          <Field label={p.nameAr} required><Input name="name_ar" required defaultValue={project.name_ar} /></Field>
          <Field label={p.nameEn}><Input name="name_en" dir="ltr" defaultValue={project.name_en ?? ''} /></Field>
          <Field label={p.city}><Input name="city" defaultValue={project.city} /></Field>
          <Field label={p.district}><Input name="district" defaultValue={project.district ?? ''} /></Field>
          <Field label={p.salesStatus}>
            <Select name="sales_status" defaultValue={project.sales_status}>
              {(['sold', 'selling', 'construction'] as const).map((k) => <option key={k} value={k}>{p.stage[k]}</option>)}
            </Select>
          </Field>
          <Field label={p.year}><Input name="delivery_year" type="number" min={2000} max={2100} defaultValue={project.delivery_year ?? ''} /></Field>
          <Field label={p.image} className="sm:col-span-2"><Input name="image_url" type="url" dir="ltr" defaultValue={project.image_url ?? ''} /></Field>
          <Field label={s.description} className="sm:col-span-2"><Textarea name="description" rows={4} defaultValue={project.description ?? ''} /></Field>
          <div className="mt-2 text-sm font-semibold text-brand sm:col-span-2">{s.location}</div>
          <Field label={s.address} className="sm:col-span-2"><Input name="address_text" defaultValue={project.address_text ?? ''} /></Field>
          <Field label={s.mapQuery} hint={s.mapQueryHint}><Input name="map_query" dir="ltr" defaultValue={project.map_query ?? ''} placeholder="21.6208,39.1176" /></Field>
          <Field label={s.locationUrl}><Input name="location_url" type="url" dir="ltr" defaultValue={project.location_url ?? ''} placeholder="https://maps.app.goo.gl/…" /></Field>
          <Field label={s.visitHours} className="sm:col-span-2"><Input name="visit_hours" defaultValue={project.visit_hours ?? ''} /></Field>
          <div className="sm:col-span-2"><SubmitButton>{d.common.save}</SubmitButton></div>
        </ActionForm>
      )}
    </Creator>
  );
}

export function BuildingForm({ projectId }: { projectId: string }) {
  const { d } = useI18n();
  const p = d.admin.projects;
  return (
    <ActionForm action={createBuilding} resetOnSuccess className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="project_id" value={projectId} />
      <Field label={p.buildingName} className="min-w-40 flex-1"><Input name="name" required /></Field>
      <Field label={p.floors} className="w-28"><Input name="floors_count" type="number" min={1} defaultValue={4} /></Field>
      <SubmitButton variant="outline" className="h-11"><Plus className="h-4 w-4" />{p.addBuilding}</SubmitButton>
    </ActionForm>
  );
}

type Opt = { id: string; label: string };
const UNIT_TYPES = ['apartment', 'villa', 'townhouse', 'penthouse', 'duplex', 'commercial'] as const;

export function UnitFields({ buildings, owners, unit }: {
  buildings?: Opt[]; owners: Opt[];
  unit?: {
    unit_number: string; floor: number; unit_type: string; area_sqm: number | null; bedrooms: number | null; owner_id: string | null; handover_date: string | null; image_url: string | null;
    price?: number | null; sale_status?: string; bathrooms?: number | null; features?: string | null;
  };
}) {
  const { d } = useI18n();
  const p = d.admin.projects;
  return (
    <>
      {buildings && (
        <Field label={d.owner.building} required>
          <Select name="building_id" required defaultValue="">
            <option value="" disabled>—</option>
            {buildings.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </Select>
        </Field>
      )}
      <Field label={p.unitNo} required><Input name="unit_number" required defaultValue={unit?.unit_number} /></Field>
      <Field label={p.floor}><Input name="floor" type="number" defaultValue={unit?.floor ?? 0} /></Field>
      <Field label={p.type}>
        <Select name="unit_type" defaultValue={unit?.unit_type ?? 'apartment'}>
          {UNIT_TYPES.map((t) => <option key={t} value={t}>{d.unitType[t]}</option>)}
        </Select>
      </Field>
      <Field label={p.area}><Input name="area_sqm" type="number" step="0.01" defaultValue={unit?.area_sqm ?? ''} /></Field>
      <Field label={p.bedrooms}><Input name="bedrooms" type="number" min={0} defaultValue={unit?.bedrooms ?? ''} /></Field>
      <Field label={p.owner}>
        <Select name="owner_id" defaultValue={unit?.owner_id ?? ''}>
          <option value="">{p.noOwner}</option>
          {owners.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </Select>
      </Field>
      <Field label={p.handover}><Input name="handover_date" type="date" defaultValue={unit?.handover_date ?? ''} /></Field>
      <Field label={p.image}><Input name="image_url" type="url" dir="ltr" placeholder="https://" defaultValue={unit?.image_url ?? ''} /></Field>
      {/* website listing — a unit linked to an owner is always saved as sold */}
      <div className="col-span-full mt-2 border-t border-sand-100 pt-3 text-sm font-semibold text-brand">{d.site.saleSection}</div>
      <Field label={d.site.saleStatus}>
        <Select name="sale_status" defaultValue={unit?.sale_status ?? 'not_for_sale'}>
          {SALE_STATUSES.map((k) => <option key={k} value={k}>{d.saleStatus[k]}</option>)}
        </Select>
      </Field>
      <Field label={d.site.price}><Input name="price" type="number" min={0} step={1000} dir="ltr" defaultValue={unit?.price ?? ''} /></Field>
      <Field label={d.site.bathrooms}><Input name="bathrooms" type="number" min={0} defaultValue={unit?.bathrooms ?? ''} /></Field>
      <Field label={d.site.features} className="col-span-full"><Input name="features" defaultValue={unit?.features ?? ''} /></Field>
    </>
  );
}

export function UnitCreateForm({ buildings, owners }: { buildings: Opt[]; owners: Opt[] }) {
  const { d } = useI18n();
  return (
    <Creator label={d.admin.projects.addUnit}>
      {() => (
        <ActionForm action={createUnit} resetOnSuccess className="grid gap-3 sm:grid-cols-3" successText={d.common.saved}>
          <UnitFields buildings={buildings} owners={owners} />
          <div className="sm:col-span-3"><SubmitButton>{d.common.create}</SubmitButton></div>
        </ActionForm>
      )}
    </Creator>
  );
}

export function UnitEditForm({ id, owners, unit }: { id: string; owners: Opt[]; unit: Parameters<typeof UnitFields>[0]['unit'] }) {
  const { d } = useI18n();
  return (
    <ActionForm action={updateUnit} className="grid gap-3 sm:grid-cols-2" successText={d.common.saved}>
      <input type="hidden" name="id" value={id} />
      <UnitFields owners={owners} unit={unit} />
      <div className="sm:col-span-2"><SubmitButton>{d.common.save}</SubmitButton></div>
    </ActionForm>
  );
}

export function WarrantyForm({ unitId, contractors, handover }: { unitId: string; contractors: Opt[]; handover: string | null }) {
  const { d } = useI18n();
  const u = d.admin.unit;
  return (
    <Creator label={u.addWarranty}>
      {(close) => (
        <ActionForm action={addWarranty} onSuccess={close} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="unit_id" value={unitId} />
          <Field label={u.wTitle} required className="sm:col-span-2"><Input name="title" required /></Field>
          <Field label={u.wCategory}>
            <Select name="category" defaultValue="">
              <option value="">{u.anyCategory}</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{d.category[c]}</option>)}
            </Select>
          </Field>
          <Field label={u.contractor}>
            <Select name="contractor_id" defaultValue="">
              <option value="">—</option>
              {contractors.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label={u.start} required><Input name="start_date" type="date" required defaultValue={handover ?? ''} /></Field>
          <Field label={u.end} required><Input name="end_date" type="date" required /></Field>
          <Field label={u.covered} className="sm:col-span-2"><Textarea name="covered_items" rows={2} /></Field>
          <Field label={u.excluded} className="sm:col-span-2"><Textarea name="excluded_items" rows={2} /></Field>
          <Field label={u.party} className="sm:col-span-2"><Input name="responsible_party" /></Field>
          <div className="sm:col-span-2"><SubmitButton>{d.common.add}</SubmitButton></div>
        </ActionForm>
      )}
    </Creator>
  );
}

export function StandardWarrantyButton({ unitId }: { unitId: string }) {
  const { d } = useI18n();
  return (
    <ActionForm action={applyStandardWarranties}>
      <input type="hidden" name="unit_id" value={unitId} />
      <SubmitButton variant="outline">{d.admin.unit.applyStandard}</SubmitButton>
      <p className="mt-1 text-xs text-stone-450">{d.admin.unit.applyStandardHint}</p>
    </ActionForm>
  );
}
