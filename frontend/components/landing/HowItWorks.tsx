"use client";

import { useRef } from "react";
import Reveal from "@/components/motion/Reveal";
import { gsap, REDUCED_MOTION, useGSAP } from "@/lib/gsap";

const stages = [
  { name: "Recording", note: "measured as a full mix" },
  { name: "Pedals", note: "drive, mod, dynamics" },
  { name: "Amp", note: "voicing + gain structure" },
  { name: "Cabinet", note: "speaker + enclosure" },
  { name: "Time FX", note: "delay, reverb" },
  { name: "EQ", note: "final tonal shape" },
];

const LIT_BORDER = "rgba(255, 138, 61, 0.45)";
const LIT_NUMBER = "#37E6C9";

export default function HowItWorks() {
  const chainRef = useRef<HTMLDivElement>(null);

  // One scrubbed GSAP timeline: the signal line fills left to right as the
  // chain scrolls through the viewport, and each stage lights up when the
  // signal reaches it. Scrub smoothing keeps wheel steps from jumping.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(`not ${REDUCED_MOTION}`, () => {
        const cards = gsap.utils.toArray<HTMLElement>("[data-stage]");
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: { trigger: chainRef.current, start: "top 80%", end: "bottom 45%", scrub: 0.6 },
        });
        tl.fromTo("[data-signal-line]", { scaleX: 0 }, { scaleX: 1, duration: 1 }, 0);
        cards.forEach((card, i) => {
          const at = i / (cards.length - 1);
          tl.fromTo(card, { borderColor: "rgba(255,255,255,0.08)" }, { borderColor: LIT_BORDER, duration: 0.06 }, at * 0.94);
          tl.fromTo(card.querySelector("[data-stage-number]"), { color: "#8B93A1" }, { color: LIT_NUMBER, duration: 0.06 }, at * 0.94);
        });
      });
      // Reduced motion: the finished state, no scroll coupling.
      mm.add(REDUCED_MOTION, () => {
        gsap.set("[data-signal-line]", { scaleX: 1 });
      });
    },
    { scope: chainRef },
  );

  return (
    <section id="how-it-works" className="relative mx-auto max-w-6xl scroll-mt-28 px-6 py-32">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">how it works</p>
        <h2 className="mt-3 max-w-lg text-balance font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Resoniq reconstructs the signal chain, stage by stage.
        </h2>
        <p className="mt-4 max-w-xl text-pretty font-body text-sm leading-relaxed text-muted">
          The guitar isn&apos;t separated out of the mix first, so busy arrangements blur the reading. Sparse,
          guitar-forward recordings give the clearest results.
        </p>
      </Reveal>

      <div ref={chainRef} className="relative mt-16">
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
