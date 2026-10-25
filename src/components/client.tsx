'use client';

import { createContext, useActionState, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Dict } from '@/lib/i18n';
import type { ActionResult, Locale } from '@/lib/types';
import { buttonClass, cx } from './ui';

// ---------------------------------------------------------------- i18n
const I18nCtx = createContext<{ d: Dict; locale: Locale } | null>(null);

export function I18nProvider({ d, locale, children }: { d: Dict; locale: Locale; children: ReactNode }) {
  return <I18nCtx.Provider value={{ d, locale }}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const v = useContext(I18nCtx);
  if (!v) throw new Error('useI18n outside provider');
  return v;
}

// ---------------------------------------------------------------- forms
export function SubmitButton({
  children, variant = 'primary', size = 'md', className, pendingText, name, value, confirmText,
}: {
  children: ReactNode; variant?: Parameters<typeof buttonClass>[0]; size?: Parameters<typeof buttonClass>[1];
  className?: string; pendingText?: ReactNode; name?: string; value?: string; confirmText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (confirmText && !window.confirm(confirmText)) { e.preventDefault(); return; }
        // React form actions don't reliably include the clicked button's name/value in FormData,
        // so write the choice into a hidden field of the form before it submits.
        const form = e.currentTarget.form;
        if (name && form) {
          let input = form.querySelector<HTMLInputElement>(`input[type="hidden"][data-submitter="${name}"]`);
          if (!input) {
            input = document.createElement('input');
            input.type = 'hidden'; input.name = name; input.dataset.submitter = name;
            form.appendChild(input);
          }
          input.value = value ?? '';
        }
      }}
      className={buttonClass(variant, size, className)}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

type ServerAction = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

type FieldSnap = { el: Element; value?: string; checked?: boolean; files?: File[]; multi?: string[] };

/** Copy what the user typed so it can be put back — React 19 resets `action` forms even when the action fails */
export function snapshotForm(form: HTMLFormElement | null): FieldSnap[] {
  if (!form) return [];
  return Array.from(form.elements).flatMap((el): FieldSnap[] => {
    if (el instanceof HTMLInputElement) {
      if (el.type === 'hidden' || el.type === 'submit' || el.type === 'button') return [];
      if (el.type === 'checkbox' || el.type === 'radio') return [{ el, checked: el.checked }];
      if (el.type === 'file') return [{ el, files: Array.from(el.files ?? []) }];
      return [{ el, value: el.value }];
    }
    if (el instanceof HTMLSelectElement) return [{ el, multi: Array.from(el.selectedOptions).map((o) => o.value) }];
    if (el instanceof HTMLTextAreaElement) return [{ el, value: el.value }];
    return [];
  });
}

export function restoreForm(snap: FieldSnap[]) {
  for (const s of snap) {
    if (!s.el.isConnected) continue;
    if (s.el instanceof HTMLInputElement) {
      if (s.checked !== undefined) s.el.checked = s.checked;
      else if (s.files) {
        if (!s.files.length) continue;
        try { const dt = new DataTransfer(); s.files.forEach((f) => dt.items.add(f)); s.el.files = dt.files; } catch { /* old browsers */ }
      } else if (s.value !== undefined) s.el.value = s.value;
    } else if (s.el instanceof HTMLSelectElement && s.multi) {
      for (const o of Array.from(s.el.options)) o.selected = s.multi.includes(o.value);
    } else if (s.el instanceof HTMLTextAreaElement && s.value !== undefined) s.el.value = s.value;
  }
}

/** Keeps a form's values when its server action returns an error */
export function useKeepOnError(state: ActionResult) {
  const ref = useRef<HTMLFormElement>(null);
  const snap = useRef<FieldSnap[]>([]);
  useEffect(() => {
    if (!state?.error) return;
    const s = snap.current;
    restoreForm(s);
    const t = setTimeout(() => restoreForm(s), 0); // in case the reset lands after this effect
    return () => clearTimeout(t);
  }, [state]);
  return { ref, onSubmitCapture: () => { snap.current = snapshotForm(ref.current); } };
}

/**
 * Form wired to a server action, with inline error/success feedback.
 * The server action enforces permissions; RLS enforces them again in the database.
 */
export function ActionForm({
  action, children, className, resetOnSuccess = false, successText, onSuccess,
}: {
  action: ServerAction; children: ReactNode | ((state: ActionResult) => ReactNode); className?: string;
  resetOnSuccess?: boolean; successText?: string; onSuccess?: (r: ActionResult) => void;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const { ref, onSubmitCapture } = useKeepOnError(state);
  const { d } = useI18n();
  const [showOk, setShowOk] = useState(false);

  useEffect(() => {
    if (state?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.(state);
      setShowOk(true);
      const t = setTimeout(() => setShowOk(false), 3500);
      return () => clearTimeout(t);
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form ref={ref} action={formAction} onSubmitCapture={onSubmitCapture} className={className}>
      {typeof children === 'function' ? children(state) : children}
      {state?.error && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {state.error}
        </p>
      )}
      {showOk && (
        <>
          <p role="status" className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4" /> {state?.message || successText || d.common.saved}
          </p>
          {/* the same confirmation, pinned on screen so it is seen even when the form is long */}
          <div aria-hidden="true" className="no-print pointer-events-none fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 lg:bottom-8">
            <div className="flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm text-white shadow-lift">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" /> {state?.message || successText || d.common.saved}
            </div>
          </div>
        </>
      )}
    </form>
  );
}

export function cls(...a: Parameters<typeof cx>) {
  return cx(...a);
}
