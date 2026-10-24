'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronLeft, ChevronRight, Film, ImagePlus, Loader2, ShieldCheck, X } from 'lucide-react';
import { createRequest } from '@/app/actions/owner';
import { useI18n } from '@/components/client';
import { CATEGORY_ICONS } from '@/components/category-icon';
import { uploadFiles, MAX_FILE_BYTES } from '@/components/uploader';
import { Button, Card, Field, Input, Textarea, cx } from '@/components/ui';
import { CATEGORIES, LOCATIONS_AR, LOCATIONS_EN } from '@/lib/constants';
import type { Category } from '@/lib/types';
import { isImageLike } from '@/lib/image';

export type UnitOption = { id: string; label: string; sub: string; covered: string[] };
const MAX_FILES = 6;

export function NewRequestForm({ units, initialUnit, minDate }: { units: UnitOption[]; initialUnit?: string; minDate: string }) {
  const { d, locale } = useI18n();
  const router = useRouter();
  const single = units.length === 1;
  const [step, setStep] = useState(single ? 1 : 0);
  const [unitId, setUnitId] = useState(initialUnit && units.some((u) => u.id === initialUnit) ? initialUnit : single ? units[0].id : '');
  const [category, setCategory] = useState<Category | ''>('');
  const [location, setLocation] = useState('');
  const [customLoc, setCustomLoc] = useState(false);
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState<'morning' | 'afternoon' | 'evening' | ''>('');
  const [phase, setPhase] = useState<'idle' | 'saving' | 'uploading'>('idle');
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const unit = units.find((u) => u.id === unitId);
  const locations = locale === 'ar' ? LOCATIONS_AR : LOCATIONS_EN;
  const steps = [d.newReq.stepUnit, d.newReq.stepType, d.newReq.stepDetails, d.newReq.stepVisit];
  const previews = useMemo(() => files.map((f) => ({ f, url: URL.createObjectURL(f) })), [files]);

  const canNext = [!!unitId, !!category, !!location.trim() && description.trim().length >= 5, true][step];

  function addFiles(list: FileList | null) {
    const incoming = Array.from(list ?? []).filter((f) => f.size <= MAX_FILE_BYTES && (isImageLike(f) || f.type.startsWith('video/')));
    if ((list?.length ?? 0) > incoming.length) setError(d.errors.FILE_TOO_LARGE);
    setFiles((prev) => [...prev, ...incoming].slice(0, MAX_FILES));
  }

  async function submit() {
    setError(null);
    setPhase('saving');
    const fd = new FormData();
    fd.set('unit_id', unitId);
    fd.set('category', category);
    fd.set('location_in_unit', location);
    fd.set('description', description);
    if (date) fd.set('preferred_date', date);
    if (slot) fd.set('preferred_slot', slot);
    const res = await createRequest(undefined, fd);
    if (!res?.ok || !res.data) {
      setError(res?.error ?? d.common.errorGeneric);
      setPhase('idle');
      return;
    }
    const id = String(res.data.id);
    if (files.length) {
      setPhase('uploading');
      try {
        await uploadFiles(files, id, 'request');
      } catch {
        // the request exists; attachments can be added again from the request page
      }
    }
    router.push(`/owner/requests/${id}?created=1`);
  }

  const Prev = locale === 'ar' ? ChevronRight : ChevronLeft;
  const Next = locale === 'ar' ? ChevronLeft : ChevronRight;

  return (
    <div>
      {/* stepper */}
      <ol className="mb-6 flex items-center gap-2">
        {steps.map((label, i) => (
          <li key={label} className="flex flex-1 flex-col gap-1.5">
            <span className={cx('h-1.5 rounded-full transition', i <= step ? 'bg-brand' : 'bg-sand-200')} />
            <span className={cx('text-[11px]', i === step ? 'font-semibold text-ink' : 'text-stone-450')}>{label}</span>
          </li>
        ))}
      </ol>

      <Card className="p-5 sm:p-7">
        {step === 0 && (
          <fieldset>
            <legend className="mb-4 text-lg font-semibold">{d.newReq.chooseUnit}</legend>
            <div className="space-y-3">
              {units.map((u) => (
                <button key={u.id} type="button" onClick={() => setUnitId(u.id)}
                  className={cx('flex w-full items-center gap-3 rounded-xl border p-4 text-start transition', unitId === u.id ? 'border-brand bg-brand/[.04] ring-2 ring-brand/15' : 'border-sand-200 hover:border-sand-300')}>
                  <span className={cx('grid h-5 w-5 place-items-center rounded-full border', unitId === u.id ? 'border-brand bg-brand text-white' : 'border-sand-300')}>
                    {unitId === u.id && <Check className="h-3 w-3" />}
                  </span>
                  <span><span className="block font-medium">{u.label}</span><span className="text-sm text-stone-450">{u.sub}</span></span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {step === 1 && (
          <fieldset>
            <legend className="mb-4 text-lg font-semibold">{d.newReq.chooseType}</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {CATEGORIES.map((c) => {
                const Icon = CATEGORY_ICONS[c];
                const covered = unit && (unit.covered.includes(c) || unit.covered.includes('*'));
                return (
                  <button key={c} type="button" onClick={() => setCategory(c)}
                    className={cx('relative flex flex-col items-center gap-2 rounded-2xl border px-3 py-5 text-center text-sm transition',
                      category === c ? 'border-brand bg-brand text-white shadow-lift' : 'border-sand-200 bg-white hover:border-brand/30 hover:bg-sand-50')}>
                    <Icon className={cx('h-6 w-6', category === c ? 'text-accent' : 'text-brand')} />
                    <span className="font-medium">{d.category[c]}</span>
                    {covered && c !== 'other' && (
                      <span className={cx('absolute end-2 top-2', category === c ? 'text-white/80' : 'text-emerald-600')} title={d.warranty.in_warranty}>
                        <ShieldCheck className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <div className="mb-2 text-[13px] font-medium text-ink/80">{d.newReq.where} <span className="text-rose-500">*</span></div>
              <div className="flex flex-wrap gap-2">
                {locations.map((l) => (
                  <button key={l} type="button" onClick={() => { setLocation(l); setCustomLoc(false); }}
                    className={cx('rounded-full border px-3.5 py-1.5 text-sm transition', location === l && !customLoc ? 'border-brand bg-brand text-white' : 'border-sand-300 bg-white hover:border-brand/40')}>
                    {l}
                  </button>
                ))}
                <button type="button" onClick={() => { setCustomLoc(true); setLocation(''); }}
                  className={cx('rounded-full border border-dashed px-3.5 py-1.5 text-sm', customLoc ? 'border-brand text-brand' : 'border-sand-300 text-stone-450')}>
                  {d.newReq.otherPlace}
                </button>
              </div>
              {customLoc && <Input className="mt-3" autoFocus maxLength={120} value={location} onChange={(e) => setLocation(e.target.value)} />}
            </div>
            <Field label={d.newReq.describe} required>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={d.newReq.describePh} rows={4} maxLength={2000} />
            </Field>
            <div>
              <div className="mb-1 text-[13px] font-medium text-ink/80">{d.newReq.media} <span className="font-normal text-stone-450">({d.common.optional})</span></div>
              <p className="mb-3 text-xs text-stone-450">{d.newReq.mediaHint}</p>
              <input ref={fileInput} type="file" accept="image/*,video/*,.heic,.heif" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {previews.map(({ f, url }, i) => (
                  <div key={i} className="relative aspect-square overflow-hidden rounded-xl border border-sand-200 bg-sand-50">
                    {f.type.startsWith('image/') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-stone-450"><Film className="h-6 w-6" /></div>
                    )}
                    <button type="button" aria-label="remove" onClick={() => setFiles(files.filter((_, j) => j !== i))}
                      className="absolute end-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-ink/70 text-white"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                {files.length < MAX_FILES && (
                  <button type="button" onClick={() => fileInput.current?.click()}
                    className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-sand-300 text-stone-450 transition hover:border-brand/40 hover:text-brand">
                    <span className="flex flex-col items-center gap-1 text-xs"><ImagePlus className="h-6 w-6" />{d.newReq.addFiles}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <Field label={d.newReq.preferred}>
              <Input type="date" min={minDate} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <div>
              <div className="mb-2 text-[13px] font-medium text-ink/80">{d.newReq.slot}</div>
              <div className="grid grid-cols-3 gap-2">
                {(['morning', 'afternoon', 'evening'] as const).map((s) => (
                  <button key={s} type="button" onClick={() => setSlot(slot === s ? '' : s)}
                    className={cx('rounded-xl border px-2 py-3 text-sm transition', slot === s ? 'border-brand bg-brand text-white' : 'border-sand-300 hover:border-brand/40')}>
                    {d.slot[s]}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-sand-50 p-4 text-sm">
              <div className="mb-2 font-semibold">{d.newReq.review}</div>
              <dl className="space-y-1.5 text-ink/80">
                <div className="flex justify-between gap-3"><dt className="text-stone-450">{d.req.unit}</dt><dd className="text-end">{unit?.label} — {unit?.sub}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-stone-450">{d.common.category}</dt><dd>{category && d.category[category]}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-stone-450">{d.req.location}</dt><dd>{location}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-stone-450">{d.req.attachments}</dt><dd>{files.length}</dd></div>
              </dl>
            </div>
          </div>
        )}

        {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

        <div className="mt-7 flex items-center justify-between gap-3 border-t border-sand-100 pt-5">
          {step > (single ? 1 : 0) ? (
            <Button type="button" variant="ghost" onClick={() => setStep(step - 1)} disabled={phase !== 'idle'}>
              <Prev className="h-4 w-4" /> {d.newReq.prev}
            </Button>
          ) : <span />}
          {step < 3 ? (
            <Button type="button" onClick={() => setStep(step + 1)} disabled={!canNext} size="lg">
              {d.newReq.next} <Next className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" onClick={submit} disabled={phase !== 'idle'} variant="accent" size="lg" className="min-w-40">
              {phase !== 'idle' && <Loader2 className="h-4 w-4 animate-spin" />}
              {phase === 'saving' ? d.newReq.submitting : phase === 'uploading' ? d.newReq.uploading : d.newReq.submit}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
