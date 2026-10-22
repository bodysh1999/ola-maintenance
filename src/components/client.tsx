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
  const ref = useRef<HTMLFormElement>(null);
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
    <form ref={ref} action={formAction} className={className}>
      {typeof children === 'function' ? children(state) : children}
      {state?.error && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {state.error}
        </p>
      )}
      {showOk && (state?.message || successText) && (
        <p role="status" className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" /> {state?.message || successText}
        </p>
      )}
    </form>
  );
}

export function cls(...a: Parameters<typeof cx>) {
  return cx(...a);
}
