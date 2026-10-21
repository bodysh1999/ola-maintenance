'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { ActionForm, SubmitButton, useI18n } from '@/components/client';
import { Textarea, cx } from '@/components/ui';
import { rateRequest, reopenRequest, respondQuote } from '@/app/actions/owner';

export function RatingForm({ requestId }: { requestId: string }) {
  const { d } = useI18n();
  const [score, setScore] = useState(0);
  const [hover, setHover] = useState(0);
  return (
    <ActionForm action={rateRequest}>
      <input type="hidden" name="request_id" value={requestId} />
      <input type="hidden" name="score" value={score} />
      <div className="flex justify-center gap-1.5 py-2" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-label={`${n}`} onClick={() => setScore(n)} onMouseEnter={() => setHover(n)} className="p-1 transition active:scale-90">
            <Star className={cx('h-9 w-9 transition', (hover || score) >= n ? 'fill-accent text-accent' : 'text-sand-300')} />
          </button>
        ))}
      </div>
      <Textarea name="comment" rows={2} placeholder={d.req.rateComment} className="mt-2 min-h-[64px]" maxLength={1000} />
      <SubmitButton variant="accent" className="mt-3 w-full">{d.req.rateSubmit}</SubmitButton>
    </ActionForm>
  );
}

export function ReopenForm({ requestId }: { requestId: string }) {
  const { d } = useI18n();
  const [open, setOpen] = useState(false);
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-rose-700 hover:underline">{d.req.reopen}</button>;
  }
  return (
    <ActionForm action={reopenRequest}>
      <input type="hidden" name="request_id" value={requestId} />
      <Textarea name="reason" required rows={2} placeholder={d.req.reopenReason} />
      <div className="mt-2 flex gap-2">
        <SubmitButton variant="danger" size="sm">{d.req.reopenBtn}</SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-stone-450">{d.common.cancel}</button>
      </div>
    </ActionForm>
  );
}

export function QuoteResponse({ quoteId }: { quoteId: string }) {
  const { d } = useI18n();
  return (
    <ActionForm action={respondQuote} className="mt-4">
      <input type="hidden" name="quote_id" value={quoteId} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="decision" value="approve">{d.req.approveQuote}</SubmitButton>
        <SubmitButton name="decision" value="decline" variant="outline" confirmText={d.req.declineQuote + '؟'}>{d.req.declineQuote}</SubmitButton>
      </div>
    </ActionForm>
  );
}
