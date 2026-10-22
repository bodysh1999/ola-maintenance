'use client';

import { Send } from 'lucide-react';
import { addNote } from '@/app/actions/common';
import { ActionForm, SubmitButton, useI18n } from './client';
import { Textarea } from './ui';

export function NoteForm({ requestId, allowInternal }: { requestId: string; allowInternal?: boolean }) {
  const { d } = useI18n();
  return (
    <ActionForm action={addNote} resetOnSuccess className="mt-4">
      <input type="hidden" name="request_id" value={requestId} />
      <Textarea name="body" required rows={2} placeholder={d.req.addNote} className="min-h-[72px]" maxLength={2000} />
      <div className="mt-2 flex items-center justify-between gap-3">
        {allowInternal ? (
          <label className="flex items-center gap-2 text-xs text-stone-450">
            <input type="checkbox" name="is_internal" className="h-4 w-4 rounded border-sand-300 text-brand focus:ring-brand" />
            {d.req.internal}
          </label>
        ) : <span />}
        <SubmitButton size="sm"><Send className="flip-rtl h-3.5 w-3.5" /> {d.req.send}</SubmitButton>
      </div>
    </ActionForm>
  );
}
