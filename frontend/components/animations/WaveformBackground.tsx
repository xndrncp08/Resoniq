"use client";

import { motion, useReducedMotion } from "motion/react";

const traces = [
  { path: "M0,120 C 150,60 300,180 450,120 S 750,60 900,120 S 1200,180 1350,120", opacity: 0.5, dur: 14, color: "var(--color-signal)" },
  { path: "M0,140 C 120,190 320,90 480,140 S 760,190 920,140 S 1180,90 1350,140", opacity: 0.28, dur: 18, color: "var(--color-copper)" },
  { path: "M0,100 C 200,40 340,160 500,100 S 800,40 960,100 S 1240,160 1350,100", opacity: 0.18, dur: 22, color: "var(--color-signal)" },
];

/**
 * Signature element: three overlapping oscilloscope traces, like three
 * pickups reading the same string at slightly different phase. On load
 * each trace sweeps across left to right (a scope's beam drawing its
 * first pass), then they drift and breathe at different speeds.
 *
 * Reduced motion: traces render fully drawn and still. The drift is a
 * transform, which MotionConfig already drops; the draw-in isn't, so it
 * is skipped here explicitly.
 */
export default function WaveformBackground() {
  const reduce = useReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <svg viewBox="0 0 1350 240" preserveAspectRatio="none" className="absolute left-0 top-1/3 h-[240px] w-full">
        {traces.map((t, i) => (
          <motion.path
            key={i}
            d={t.path}
            fill="none"
            stroke={t.color}
            strokeWidth={1.5}
            strokeOpacity={t.opacity}
            initial={reduce ? false : { pathLength: 0, x: 0 }}
            animate={{ pathLength: 1, x: [-40, 40, -40] }}
            transition={{
              pathLength: { type: "spring", duration: 1.6, bounce: 0, delay: 0.1 + i * 0.12 },
              x: { duration: t.dur, repeat: Infinity, ease: "easeInOut" },
            }}
          />
        ))}
      </svg>
      {/* radial glow anchoring the hero headline, like a tube socket underlight */}
      <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] max-w-[120vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-copper/10 blur-[140px]" />
    </div>
  );
}
