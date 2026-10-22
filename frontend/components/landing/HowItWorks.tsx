const stages = [
  { name: "Recording", note: "measured as a full mix" },
  { name: "Pedals", note: "drive, mod, dynamics" },
  { name: "Amp", note: "voicing + gain structure" },
  { name: "Cabinet", note: "speaker + enclosure" },
  { name: "Time FX", note: "delay, reverb" },
  { name: "EQ", note: "final tonal shape" },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="relative mx-auto max-w-6xl scroll-mt-28 px-6 py-32">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">how it works</p>
        <h2 className="mt-3 max-w-lg text-balance font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          A recording becomes a starting-point rig.
        </h2>
        <p className="mt-4 max-w-xl text-pretty font-body text-sm leading-relaxed text-muted">
          The guitar isn&apos;t separated out of the mix first, so busy arrangements blur the reading. Sparse,
          guitar-forward recordings give the clearest results.
        </p>
      </div>

      <div className="relative mt-16">
        {/* signal line behind the stages (desktop only, where they sit in a row) */}
        <div className="absolute inset-x-6 top-1/2 hidden h-px -translate-y-1/2 bg-white/[0.06] sm:block" aria-hidden>
          <div data-signal-line className="h-full origin-left bg-gradient-to-r from-signal/80 to-copper/80 shadow-[0_0_8px_var(--color-signal)]" />
        </div>

        <ol className="relative grid gap-3 sm:grid-cols-6 sm:gap-4">
          {stages.map((s, i) => (
            <li
              key={s.name}
              data-stage
              // Opaque, so the signal line shows only in the gaps between stages.
              className="h-full rounded-2xl border border-white/[0.08] bg-bg-elevated px-4 py-6 text-center"
            >
              <div data-stage-number className="font-mono text-[10px] tabular-nums text-muted">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="mt-1 font-display text-base font-medium">{s.name}</div>
              <div className="mt-1 font-mono text-[11px] text-muted">{s.note}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
