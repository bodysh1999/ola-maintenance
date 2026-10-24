'use client';

import { ActionForm, SubmitButton, useI18n } from '@/components/client';
import { resolveError } from './actions';

export function ResolveButton({ fp }: { fp: string }) {
  const { d } = useI18n();
  return (
    <ActionForm action={resolveError}>
      <input type="hidden" name="fp" value={fp} />
      <SubmitButton size="sm" variant="ghost">{d.system.resolve}</SubmitButton>
    </ActionForm>
  );
}
