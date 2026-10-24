'use client';

import Link from 'next/link';
import { useOptimistic, useState, useTransition } from 'react';
import { CalendarClock, GripVertical, Phone } from 'lucide-react';
import { moveLead } from '@/app/actions/sales';
import { useI18n } from '@/components/client';
import { cx } from '@/components/ui';

export type BoardLead = {
  id: string; ref_no: string; full_name: string; phone: string; status: string; kind: string; what: string;
  assignee: string | null; follow_up_at: string | null; created_at: string;
};

const COL_TONE: Record<string, string> = {
  new: 'border-t-sky-400', contacted: 'border-t-indigo-400', scheduled: 'border-t-violet-400', visited: 'border-t-fuchsia-400',
  negotiating: 'border-t-amber-400', booked: 'border-t-teal-400', won: 'border-t-emerald-500', lost: 'border-t-rose-400',
};

export function LeadBoard({ leads, columns, today }: { leads: BoardLead[]; columns: string[]; today: string }) {
  const { d } = useI18n();
  const s = d.sales;
  const [items, setOptimistic] = useOptimistic(leads, (cur: BoardLead[], m: { id: string; status: string }) => cur.map((l) => (l.id === m.id ? { ...l, status: m.status } : l)));
  const [, start] = useTransition();
  const [over, setOver] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const move = (id: string, status: string) => {
    const lead = items.find((l) => l.id === id);
    if (!lead || lead.status === status) return;
    setErr(null);
    start(async () => {
      setOptimistic({ id, status });
      const r = await moveLead(id, status);
      if (r?.error) setErr(r.error);
    });
  };

  return (
    <div>
      {err && <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{err}</p>}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map((col) => {
          const list = items.filter((l) => l.status === col);
          return (
            <section key={col}
              onDragOver={(e) => { e.preventDefault(); setOver(col); }}
              onDragLeave={() => setOver((o) => (o === col ? null : o))}
              onDrop={(e) => { e.preventDefault(); setOver(null); move(e.dataTransfer.getData('text/plain'), col); }}
              className={cx('flex w-72 shrink-0 flex-col rounded-2xl border-t-4 bg-sand-50 p-2 transition', COL_TONE[col], over === col && 'bg-brand/[.06] ring-2 ring-brand/30')}>
              <header className="flex items-center justify-between px-2 py-2 text-sm font-semibold">
                {s.status[col as keyof typeof s.status]}
                <span className="rounded-full bg-white px-2 text-xs font-medium text-stone-450">{list.length}</span>
              </header>
              <div className="flex min-h-24 flex-col gap-2">
                {list.map((l) => {
                  const due = l.follow_up_at && l.follow_up_at <= today && !['won', 'lost'].includes(l.status);
                  return (
                    <article key={l.id} draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', l.id); e.dataTransfer.effectAllowed = 'move'; }}
                      className="group cursor-grab rounded-xl bg-white p-3 text-sm shadow-sm ring-1 ring-sand-200 active:cursor-grabbing">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/sales/${l.id}`} className="font-medium hover:text-brand">{l.full_name}</Link>
                        <GripVertical className="h-4 w-4 shrink-0 text-stone-300 group-hover:text-stone-450" />
                      </div>
                      <div className="mt-0.5 text-xs text-stone-450">{s.kind[l.kind as keyof typeof s.kind]}{l.what ? ` · ${l.what}` : ''}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-450">
                        <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1 hover:text-brand" dir="ltr"><Phone className="h-3 w-3" />{l.phone}</a>
                        {l.follow_up_at && (
                          <span className={cx('inline-flex items-center gap-1', due && 'font-medium text-rose-700')}><CalendarClock className="h-3 w-3" />{l.follow_up_at}</span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2 border-t border-sand-100 pt-2 text-xs">
                        <span className={l.assignee ? 'text-ink/70' : 'text-stone-400'}>{l.assignee ?? d.common.unassigned}</span>
                        {/* touch screens can't drag: quick stage picker */}
                        <select aria-label={d.common.status} value={l.status} onChange={(e) => move(l.id, e.target.value)}
                          className="h-7 rounded-lg border border-sand-200 bg-white px-1 text-xs lg:hidden">
                          {columns.map((c) => <option key={c} value={c}>{s.status[c as keyof typeof s.status]}</option>)}
                        </select>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
