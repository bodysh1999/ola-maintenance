'use client';

import { ActionForm, SubmitButton, useI18n } from '@/components/client';
import { Field, Input } from '@/components/ui';
import { signIn } from '@/app/actions/common';

export function LoginForm() {
  const { d } = useI18n();
  return (
    <ActionForm action={signIn} className="mt-8 space-y-4">
      <Field label={d.auth.email}>
        <Input name="email" type="email" autoComplete="email" required dir="ltr" />
      </Field>
      <Field label={d.auth.password}>
        <Input name="password" type="password" autoComplete="current-password" required dir="ltr" />
      </Field>
      <SubmitButton size="lg" className="w-full">{d.auth.signIn}</SubmitButton>
    </ActionForm>
  );
}
