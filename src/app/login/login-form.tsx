'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Lock, LogIn, Mail } from 'lucide-react';
import { ActionForm, SubmitButton, useI18n } from '@/components/client';
import { cx } from '@/components/ui';
import { signIn } from '@/app/actions/common';

const field =
  'h-12 w-full rounded-xl border border-sand-300 bg-white pl-11 pr-4 text-left text-[15px] text-ink placeholder:text-stone-400 transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10';

export function LoginForm() {
  const { d } = useI18n();
  const [show, setShow] = useState(false);
  return (
    <ActionForm action={signIn} className="space-y-5">
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-ink/80">{d.auth.email}</span>
        <span className="relative block">
          <Mail className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-stone-400" />
          <input name="email" type="email" autoComplete="email" required dir="ltr" placeholder="name@example.com" className={field} />
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 flex items-center justify-between text-[13px] font-medium text-ink/80">
          {d.auth.password}
          <Link href="/forgot-password" className="text-xs font-normal text-brand hover:underline">{d.auth.forgot}</Link>
        </span>
        <span className="relative block">
          <Lock className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-stone-400" />
          <input name="password" type={show ? 'text' : 'password'} autoComplete="current-password" required dir="ltr" className={cx(field, 'pr-12')} />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'hide' : 'show'}
            className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-stone-400 hover:bg-sand-100 hover:text-ink">
            {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
          </button>
        </span>
      </label>

      <SubmitButton size="lg" className="h-12 w-full rounded-xl text-[15px] shadow-lift" pendingText={d.common.loading}>
        <LogIn className="flip-rtl h-[18px] w-[18px]" /> {d.auth.signIn}
      </SubmitButton>
    </ActionForm>
  );
}
