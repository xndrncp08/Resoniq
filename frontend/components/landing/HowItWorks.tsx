"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useSpring } from "motion/react";
import Reveal from "@/components/motion/Reveal";
import { STAGGER_S } from "@/lib/motion";

const stages = [
  { name: "Recording", note: "measured as a full mix" },
  { name: "Pedals", note: "drive, mod, dynamics" },
  { name: "Amp", note: "voicing + gain structure" },
  { name: "Cabinet", note: "speaker + enclosure" },
  { name: "Time FX", note: "delay, reverb" },
  { name: "EQ", note: "final tonal shape" },
];

export default function HowItWorks() {
  const chainRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  // The signal line fills as the chain scrolls through the viewport, so the
  // reader "follows the signal" stage by stage. Smoothed with a spring so
  // wheel steps don't make it jump.
  const { scrollYProgress } = useScroll({ target: chainRef, offset: ["start 85%", "end 55%"] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });

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
          <motion.div
            style={{ scaleX: reduce ? 1 : progress }}
            className="h-full origin-left bg-gradient-to-r from-signal/70 to-copper/70"
          />
        </div>

        <ol className="relative grid gap-3 sm:grid-cols-6 sm:gap-4">
          {stages.map((s, i) => (
            <li key={s.name}>
              <Reveal
                delay={i * STAGGER_S}
                y={10}
                // Opaque, so the signal line shows only in the gaps between stages.
                className="h-full rounded-2xl border border-white/[0.08] bg-bg-elevated px-4 py-6 text-center transition-colors duration-300 hover:border-copper/40"
              >
                <div className="font-mono text-[10px] tabular-nums text-muted">{String(i + 1).padStart(2, "0")}</div>
                <div className="mt-1 font-display text-base font-medium">{s.name}</div>
                <div className="mt-1 font-mono text-[11px] text-muted">{s.note}</div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
