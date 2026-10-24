'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, LocateFixed, MapPin, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from './client';
import { buttonClass, cx } from './ui';

/**
 * Refreshes the page the moment something relevant changes (Supabase Realtime; RLS decides what each user receives).
 * A slow poll stays as a safety net in case the socket drops.
 */
export function LiveRefresh({ requestId, userId, fallbackSeconds = 120 }: { requestId?: string; userId?: string; fallbackSeconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const sb = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => router.refresh(), 400); };
    const ch = sb.channel(`live-${requestId ?? ''}-${userId ?? ''}-${Math.random().toString(36).slice(2, 8)}`);
    if (requestId) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_requests', filter: `id=eq.${requestId}` }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'request_notes', filter: `request_id=eq.${requestId}` }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `request_id=eq.${requestId}` }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders', filter: `request_id=eq.${requestId}` }, refresh);
    }
    if (userId) ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, refresh);
    ch.subscribe();
    const poll = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, fallbackSeconds * 1000);
    return () => { clearInterval(poll); if (timer) clearTimeout(timer); sb.removeChannel(ch); };
  }, [requestId, userId, fallbackSeconds, router]);
  return null;
}

// ------------------------------------------------------------------ inline document viewer
export function DocPreview({ url, title, mime }: { url: string; title: string; mime: string | null }) {
  const { d } = useI18n();
  const [open, setOpen] = useState(false);
  const isImg = !!mime?.startsWith('image/');
  const isPdf = mime === 'application/pdf' || /\.pdf(\?|$)/i.test(url);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [open]);
  if (!isImg && !isPdf) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand px-3 text-xs font-medium text-white hover:bg-brand/90">
        <Eye className="h-3.5 w-3.5" />{d.live.view}
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex flex-col bg-ink/80 p-2 backdrop-blur-sm sm:p-6" onClick={() => setOpen(false)}>
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 pb-2 text-white" onClick={(e) => e.stopPropagation()}>
            <span className="truncate text-sm font-medium">{title}</span>
            <div className="flex items-center gap-2">
              <a href={url} target="_blank" rel="noreferrer" className="rounded-lg bg-white/15 px-3 py-1.5 text-xs hover:bg-white/25">{d.portal.download}</a>
              <button type="button" aria-label="close" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-full bg-white/15 hover:bg-white/25"><X className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="mx-auto min-h-0 w-full max-w-5xl flex-1 overflow-hidden rounded-xl bg-white" onClick={(e) => e.stopPropagation()}>
            {isImg
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={url} alt={title} className="h-full w-full object-contain" />
              : <iframe src={url} title={title} className="h-full w-full" />}
          </div>
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------------ live technician location
type Loc = { lat: number; lng: number; updated_at: string } | null;

function osmEmbed(lat: number, lng: number, zoom = 0.012) {
  const bbox = [lng - zoom, lat - zoom * 0.7, lng + zoom, lat + zoom * 0.7].map((n) => n.toFixed(5)).join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(5)},${lng.toFixed(5)}`;
}

/** Owner / staff: map of the technician's position while on the way (updates live) */
export function LiveTechMap({ requestId, initial }: { requestId: string; initial: Loc }) {
  const { d } = useI18n();
  const [loc, setLoc] = useState<Loc>(initial);
  useEffect(() => {
    const sb = createClient();
    const ch = sb.channel(`loc-${requestId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tech_locations', filter: `request_id=eq.${requestId}` }, (p: { eventType: string; new: unknown }) => {
        if (p.eventType === 'DELETE') setLoc(null);
        else { const n = p.new as { lat: number; lng: number; updated_at: string }; setLoc({ lat: n.lat, lng: n.lng, updated_at: n.updated_at }); }
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [requestId]);
  if (!loc) return null;
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(loc.updated_at)) / 60000));
  return (
    <div className="border-b border-sand-100">
      <iframe key={`${loc.lat},${loc.lng}`} src={osmEmbed(loc.lat, loc.lng)} title={d.live.techLocation} className="h-56 w-full" loading="lazy" />
      <div className="flex items-center justify-between gap-2 px-5 py-2 text-xs text-stone-450">
        <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-sky-600" />{d.live.techLocation} · {mins < 1 ? d.live.justNow : d.live.minsAgo.replace('{n}', String(mins))}</span>
        <a href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`} target="_blank" rel="noreferrer" className="text-brand hover:underline">Google Maps</a>
      </div>
    </div>
  );
}

/** Technician: shares GPS position every ~30s while the page is open and the order is "on the way" */
export function ShareLocation({ workOrderId }: { workOrderId: string }) {
  const { d } = useI18n();
  const [on, setOn] = useState(true);
  const [state, setState] = useState<'idle' | 'sharing' | 'denied' | 'error'>('idle');
  const last = useRef(0);
  useEffect(() => {
    if (!on || !('geolocation' in navigator)) return;
    const sb = createClient();
    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        if (Date.now() - last.current < 30_000) return;
        last.current = Date.now();
        const { error } = await sb.rpc('tech_share_location', {
          p_wo: workOrderId, p_lat: pos.coords.latitude, p_lng: pos.coords.longitude, p_accuracy: Math.round(pos.coords.accuracy),
        });
        setState(error ? 'error' : 'sharing');
      },
      (err) => setState(err.code === err.PERMISSION_DENIED ? 'denied' : 'error'),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [on, workOrderId]);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-xs ring-1 ring-sky-200">
      <span className={cx('flex items-center gap-1.5', state === 'sharing' ? 'text-sky-800' : 'text-stone-450')}>
        <LocateFixed className={cx('h-3.5 w-3.5', state === 'sharing' && on && 'animate-pulse')} />
        {!on ? d.live.sharingOff : state === 'denied' ? d.live.denied : state === 'sharing' ? d.live.sharing : d.live.starting}
      </span>
      <button type="button" onClick={() => setOn(!on)} className={buttonClass('ghost', 'sm', 'h-7 px-2 text-xs')}>{on ? d.live.stop : d.live.start}</button>
    </div>
  );
}
