import type { LegalSection } from '@/lib/legal';

/** Renders a legal document (privacy policy / terms) */
export function LegalBody({ sections, meta }: { sections: LegalSection[]; meta: string }) {
  return (
    <article className="mx-auto max-w-3xl px-5 py-14 sm:px-8">
      <p className="mb-8 rounded-2xl bg-sand-100 px-4 py-3 text-sm text-ink/70">{meta}</p>
      <div className="space-y-9">
        {sections.map((sec) => (
          <section key={sec.title}>
            <h2 className="font-display text-xl font-bold text-brand">{sec.title}</h2>
            <div className="mt-3 space-y-3 text-[15px] leading-loose text-ink/85">
              {sec.body.map((b, i) => Array.isArray(b)
                ? <ul key={i} className="list-disc space-y-1.5 ps-5 marker:text-accent">{b.map((li) => <li key={li}>{li}</li>)}</ul>
                : <p key={i}>{b}</p>)}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
