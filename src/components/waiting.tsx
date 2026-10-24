import { Clock, Siren } from 'lucide-react';
import type { Dict } from '@/lib/i18n';
import type { RequestOverview, WaitingOn } from '@/lib/types';
import { cx } from './ui';

export const whoOf = (w: WaitingOn): 'owner' | 'staff' | 'tech' => (w.startsWith('owner') ? 'owner' : w.startsWith('tech') ? 'tech' : 'staff');

export function ageLabel(since: string | null | undefined, d: Dict) {
  if (!since) return '';
  const h = Math.max(0, Math.floor((Date.now() - Date.parse(since)) / 36e5));
  return h >= 48 ? d.ops.days.replace('{n}', String(Math.floor(h / 24))) : d.ops.hours.replace('{n}', String(h));
}

const TONE = { owner: 'text-sky-700', staff: 'text-violet-700', tech: 'text-amber-700' } as const;

/** "Technician: Hasan — start the work · 2d" */
export function WaitingOnText({ r, d, long }: { r: Pick<RequestOverview, 'waiting_on' | 'waiting_since' | 'technician_name' | 'owner_name' | 'escalation_level'>; d: Dict; long?: boolean }) {
  if (!r.waiting_on) return <span className="text-stone-400">—</span>;
  const who = whoOf(r.waiting_on);
  const name = who === 'tech' ? r.technician_name : who === 'owner' ? r.owner_name : null;
  return (
    <div className={cx('leading-snug', long ? 'text-sm' : 'text-xs')}>
      <div className={cx('font-medium', TONE[who])}>{d.ops.who[who]}{name ? `: ${name}` : ''}</div>
      <div className="text-stone-450">{d.ops.waiting[r.waiting_on]}</div>
      <div className="mt-0.5 flex items-center gap-1.5 text-stone-450">
        <Clock className="h-3 w-3" />{ageLabel(r.waiting_since, d)}
        {!!r.escalation_level && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-50 px-1.5 text-[10px] font-medium text-rose-700 ring-1 ring-rose-200">
            <Siren className="h-3 w-3" />{d.ops.escLevel[r.escalation_level as 1 | 2]}
          </span>
        )}
      </div>
    </div>
  );
}
