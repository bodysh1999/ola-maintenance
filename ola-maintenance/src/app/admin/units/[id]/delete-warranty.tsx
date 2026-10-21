'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { deleteWarranty } from '@/app/actions/admin';
import { useI18n } from '@/components/client';

export function DeleteWarrantyButton({ id }: { id: string }) {
  const { d } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" aria-label={d.common.delete} disabled={pending}
      onClick={() => { if (confirm(`${d.common.delete}?`)) start(async () => { await deleteWarranty(id); router.refresh(); }); }}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-stone-400 hover:bg-rose-50 hover:text-rose-600">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}
