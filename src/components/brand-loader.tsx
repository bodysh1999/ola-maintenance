import { DEFAULT_LOGO } from './brand';

/**
 * Branded loading indicator.
 *  - fullscreen: purple screen with the logo (first load / login / redirects)
 *  - inline: inside the app shell while a page loads (sidebar stays visible)
 */
export function BrandLoader({ fullscreen = false, label = 'جارٍ التحميل…' }: { fullscreen?: boolean; label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        fullscreen
          ? 'texture-lines fixed inset-0 z-[100] grid place-items-center bg-brand'
          : 'grid min-h-[60vh] place-items-center'
      }
    >
      <div className="flex flex-col items-center">
        <div className="relative grid h-28 w-28 place-items-center">
          {/* rotating accent arc */}
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-accent [animation-duration:1.4s]" />
          {/* breathing ring */}
          <span className={`absolute inset-2 animate-ping rounded-full [animation-duration:2.2s] ${fullscreen ? 'bg-white/10' : 'bg-brand/10'}`} />
          <span className={`relative grid h-20 w-20 place-items-center rounded-2xl shadow-lift ${fullscreen ? 'bg-white/10 ring-1 ring-white/15 backdrop-blur' : 'bg-brand'}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={DEFAULT_LOGO} alt="" className="h-12 w-16 object-contain" />
          </span>
        </div>
        <div className={`mt-6 h-1 w-32 overflow-hidden rounded-full ${fullscreen ? 'bg-white/15' : 'bg-brand/10'}`}>
          <span className="block h-full w-1/3 animate-[loader-slide_1.1s_ease-in-out_infinite] rounded-full bg-accent" />
        </div>
        <p className={`mt-3 text-sm ${fullscreen ? 'text-white/70' : 'text-stone-450'}`}>{label}</p>
      </div>
    </div>
  );
}
