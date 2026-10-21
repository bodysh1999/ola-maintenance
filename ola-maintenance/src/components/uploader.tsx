'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Loader2, Trash2, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { deleteAttachment, registerAttachments } from '@/app/actions/common';
import { translateError } from '@/lib/i18n';
import { useI18n } from './client';
import { buttonClass, cx } from './ui';
import type { AttachmentKind } from '@/lib/types';

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export function safeName(name: string) {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '') : 'bin';
  return `${crypto.randomUUID()}.${ext}`;
}

/** Uploads straight from the browser to Supabase Storage (RLS checks the request folder), then registers rows. */
export async function uploadFiles(files: File[], requestId: string, kind: AttachmentKind, workOrderId?: string | null) {
  const supabase = createClient();
  const rows: Parameters<typeof registerAttachments>[0] = [];
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) throw new Error('FILE_TOO_LARGE');
    const path = `${requestId}/${safeName(f.name)}`;
    const { error } = await supabase.storage.from('attachments').upload(path, f, { contentType: f.type, upsert: false });
    if (error) throw new Error(error.message);
    rows.push({ request_id: requestId, work_order_id: workOrderId ?? null, kind, storage_path: path, file_name: f.name.slice(0, 180), mime_type: f.type, size_bytes: f.size });
  }
  if (rows.length) {
    const res = await registerAttachments(rows);
    if (res.error) throw new Error(res.error);
  }
}

export function Uploader({ requestId, workOrderId, kind, label, accept = 'image/*,video/*', capture, compact }: {
  requestId: string; workOrderId?: string | null; kind: AttachmentKind; label: string; accept?: string; capture?: boolean; compact?: boolean;
}) {
  const { d } = useI18n();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setBusy(true);
    setError(null);
    try {
      await uploadFiles(files, requestId, kind, workOrderId);
      router.refresh();
    } catch (err) {
      setError(translateError(d, (err as Error).message));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div>
      <input ref={input} type="file" multiple accept={accept} className="hidden" onChange={onChange} {...(capture ? { capture: 'environment' as const } : {})} />
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className={compact ? buttonClass('outline', 'sm') : cx('flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-sand-300 bg-sand-50 px-4 py-5 text-sm text-ink/70 transition hover:border-brand/40 hover:bg-white disabled:opacity-60')}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : capture ? <Camera className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
        {busy ? d.newReq.uploading : label}
      </button>
      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
    </div>
  );
}

export function DeleteAttachmentButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label="delete"
      disabled={pending}
      onClick={() => start(async () => { await deleteAttachment(id); router.refresh(); })}
      className="absolute end-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-rose-600 opacity-0 shadow transition group-hover:opacity-100 focus:opacity-100 max-lg:opacity-100"
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
    </button>
  );
}
