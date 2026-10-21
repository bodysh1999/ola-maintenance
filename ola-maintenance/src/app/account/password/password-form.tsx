'use client';

import { ActionForm, SubmitButton, useI18n } from '@/components/client';
import { Field, Input } from '@/components/ui';
import { updatePassword } from '@/app/actions/common';

export function PasswordForm() {
  const { d } = useI18n();
  return (
    <ActionForm action={updatePassword} className="mt-6 space-y-4">
      <Field label={d.auth.newPassword}>
        <Input name="password" type="password" minLength={8} required autoComplete="new-password" dir="ltr" />
      </Field>
      <Field label={d.auth.confirmPassword}>
        <Input name="confirm" type="password" minLength={8} required autoComplete="new-password" dir="ltr" />
      </Field>
      <SubmitButton className="w-full" size="lg">{d.auth.setPassword}</SubmitButton>
    </ActionForm>
  );
}
