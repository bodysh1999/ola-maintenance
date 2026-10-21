'use client';

import Link from 'next/link';
import { ActionForm, SubmitButton, useI18n } from '@/components/client';
import { Field, Input } from '@/components/ui';
import { requestPasswordReset } from '@/app/actions/common';

export default function ForgotPasswordPage() {
  const { d } = useI18n();
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold">{d.auth.forgot}</h1>
        <ActionForm action={requestPasswordReset} className="mt-6 space-y-4">
          <Field label={d.auth.email}>
            <Input name="email" type="email" required dir="ltr" />
          </Field>
          <SubmitButton className="w-full" size="lg">{d.auth.sendReset}</SubmitButton>
        </ActionForm>
        <Link href="/login" className="mt-6 block text-center text-sm text-brand hover:underline">{d.auth.backToLogin}</Link>
      </div>
    </div>
  );
}
