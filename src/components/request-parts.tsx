import { Check, FileText, Film, MessageSquare, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { MAIN_STAGES, STATUS_HEX } from '@/lib/constants';
import { fmtDateTime, fmtRelative, fmtVisit } from '@/lib/format';
import { fmt, type Dict } from '@/lib/i18n';
import type { ActivityLog, Attachment, AttachmentKind, Locale, RequestStatus } from '@/lib/types';
import { Alert, cx } from './ui';
import { DeleteAttachmentButton } from './uploader';

// ----------------------------------------------------------------- progress tracker
export function RequestProgress({ status, d, lastMainStatus }: { status: RequestStatus; d: Dict; lastMainStatus?: RequestStatus | null }) {
  const effective = MAIN_STAGES.includes(status) ? status : lastMainStatus ?? 'under_review';
  const idx = MAIN_STAGES.indexOf(effective);
  const side = !MAIN_STAGES.includes(status) ? status : null;

  return (
    <div>
      <ol className="grid grid-cols-8 gap-1">
        {MAIN_STAGES.map((s, i) => {
          const done = i < idx || (i === idx && s === 'completed');
          const current = i === idx && s !== 'completed';
          return (
            <li key={s} className="flex flex-col items-center text-center">
              <div className="flex w-full items-center">
                <span className={cx('h-0.5 flex-1', i === 0 ? 'opacity-0' : i <= idx ? 'bg-brand' : 'bg-sand-200')} />
                <span className={cx(
                  'grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold transition',
                  done ? 'bg-brand text-white' : current ? (side ? 'bg-amber-500 text-white ring-4 ring-amber-100' : 'bg-accent text-white ring-4 ring-accent/20') : 'bg-sand-100 text-stone-450',
                )}>
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className={cx('h-0.5 flex-1', i === MAIN_STAGES.length - 1 ? 'opacity-0' : i < idx ? 'bg-brand' : 'bg-sand-200')} />
              </div>
              <span className={cx('mt-2 hidden text-[11px] leading-tight sm:block', current || done ? 'font-medium text-ink' : 'text-stone-450')}>
                {d.status[s]}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-center text-sm font-medium sm:hidden">{d.status[status]}</p>
      {side && (
        <Alert tone={side === 'rejected' ? 'error' : 'warn'} className="mt-4">
          <strong className="font-semibold">{d.status[side]} — </strong>
          {d.req.side[side as keyof Dict['req']['side']]}
        </Alert>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- timeline
export function Timeline({ logs, d, locale }: { logs: ActivityLog[]; d: Dict; locale: Locale }) {
  if (!logs.length) return <p className="px-5 py-6 text-sm text-stone-450">{d.common.noData}</p>;
  return (
    <ol className="relative px-5 py-4">
      {logs.map((l, i) => {
        const color = l.to_status ? STATUS_HEX[l.to_status] : '#B08D57';
        const meta = l.meta as Record<string, string | number | undefined>;
        let title = d.log[l.action as keyof Dict['log']] ?? l.action;
        if (l.action === 'status_changed' && l.to_status) title = d.status[l.to_status];
        if (l.action === 'priority_changed' && meta.to) title += ` → ${d.priority[meta.to as keyof Dict['priority']]}`;
        if (l.action === 'warranty_changed' && meta.to) title += ` → ${d.warranty[meta.to as keyof Dict['warranty']]}`;
        if (l.action === 'technician_assigned' && meta.technician) title += `: ${meta.technician}`;
        if ((l.action === 'visit_scheduled' || l.action === 'visit_rescheduled') && meta.starts_at) title += ` — ${fmtVisit(String(meta.starts_at), locale)}`;
        if (l.action === 'rated' && meta.score) title += ` ★ ${meta.score}/5`;
        if (l.action === 'on_the_way' && meta.eta) title += ` — ${d.portal.minutes.replace('{n}', String(meta.eta))}`;
        if (l.action.startsWith('quote') && meta.amount) title += ` (${meta.amount} ${d.common.sar})`;
        return (
          <li key={l.id} className="relative flex gap-3 pb-5 last:pb-0">
            {i < logs.length - 1 && <span className="absolute start-[7px] top-5 h-full w-px bg-sand-200" />}
            <span className="relative mt-1 h-[15px] w-[15px] shrink-0 rounded-full border-[3px] border-white ring-1 ring-sand-200" style={{ background: color }} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-sm font-medium text-ink">{title}</span>
                <time className="text-xs text-stone-450" title={fmtDateTime(l.created_at, locale)}>{fmtRelative(l.created_at, locale)}</time>
              </div>
              <div className="text-xs text-stone-450">
                {l.actor_name || d.log.system}{l.actor_role ? ` · ${d.roles[l.actor_role]}` : ''}
              </div>
              {l.note && <p className="mt-1.5 rounded-lg bg-sand-50 px-3 py-2 text-[13px] text-ink/80">{l.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ----------------------------------------------------------------- attachments
export async function withSignedUrls(rows: Attachment[]): Promise<Attachment[]> {
  if (!rows.length) return rows;
  const supabase = await createClient();
  const { data } = await supabase.storage.from('attachments').createSignedUrls(rows.map((r) => r.storage_path), 60 * 60);
  const map = new Map((data ?? []).map((x) => [x.path, x.signedUrl]));
  return rows.map((r) => ({ ...r, url: map.get(r.storage_path) ?? undefined }));
}

export function AttachmentGrid({ items, d, canDeleteOwn, currentUserId, emptyText }: {
  items: Attachment[]; d: Dict; canDeleteOwn?: boolean; currentUserId?: string; emptyText?: string;
}) {
  if (!items.length) return <p className="text-sm text-stone-450">{emptyText ?? d.common.noData}</p>;
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {items.map((a) => {
        const isImg = a.mime_type?.startsWith('image/');
        const isVideo = a.mime_type?.startsWith('video/');
        return (
          <div key={a.id} className="group relative aspect-square overflow-hidden rounded-xl border border-sand-200 bg-sand-50">
            <a href={a.url} target="_blank" rel="noreferrer" className="block h-full w-full" title={a.file_name}>
              {isImg && a.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.url} alt={a.file_name} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
              ) : (
                <div className="grid h-full w-full place-items-center p-2 text-center text-[11px] text-stone-450">
                  {isVideo ? <Film className="mb-1 h-6 w-6" /> : <FileText className="mb-1 h-6 w-6" />}
                  <span className="line-clamp-2 break-all">{a.file_name}</span>
                </div>
              )}
            </a>
            {canDeleteOwn && (a as Attachment & { uploaded_by?: string }).uploaded_by === currentUserId && (
              <DeleteAttachmentButton id={a.id} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function filterKind(items: Attachment[], kinds: AttachmentKind[]) {
  return items.filter((a) => kinds.includes(a.kind));
}

// ----------------------------------------------------------------- notes
export type NoteRow = { id: string; body: string; is_internal: boolean; author_name: string | null; author_role: string | null; author_id: string | null; created_at: string };

export function NotesList({ notes, d, locale, meId }: { notes: NoteRow[]; d: Dict; locale: Locale; meId: string }) {
  if (!notes.length) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-stone-450">
        <MessageSquare className="h-4 w-4" /> {d.common.noData}
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {notes.map((n) => {
        const mine = n.author_id === meId;
        return (
          <li key={n.id} className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
            <div className={cx(
              'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm',
              n.is_internal ? 'border border-dashed border-amber-300 bg-amber-50' : mine ? 'bg-brand text-white' : 'bg-sand-100 text-ink',
            )}>
              <div className={cx('mb-0.5 flex items-center gap-1.5 text-[11px]', mine && !n.is_internal ? 'text-white/70' : 'text-stone-450')}>
                {n.is_internal && <Lock className="h-3 w-3" />}
                <span>{n.author_name}</span>
                {n.author_role && <span>· {d.roles[n.author_role as keyof Dict['roles']]}</span>}
                <span>· {fmtRelative(n.created_at, locale)}</span>
              </div>
              <p className="whitespace-pre-wrap leading-relaxed">{n.body}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function notifText(d: Dict, type: string, payload: Record<string, unknown>) {
  const tpl = (d.notif as Record<string, string>)[type] ?? type;
  return fmt(tpl, {
    ref: payload.ref_no ?? payload.ref, score: payload.score, tech: payload.tech, title: payload.title, unit: payload.unit, days: payload.days,
    date: payload.end_date ?? payload.date, level: payload.level, name: payload.name, count: payload.count, from: payload.from, to: payload.to,
    no: payload.no, supplier: payload.supplier, amount: typeof payload.amount === 'number' ? payload.amount.toLocaleString('en-US') : payload.amount,
  });
}

