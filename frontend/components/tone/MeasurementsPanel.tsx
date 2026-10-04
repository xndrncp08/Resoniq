"use client";

import { useEffect, useRef } from "react";
import { animate, createSpring, stagger, type Target } from "animejs";
import { useReducedMotion } from "motion/react";
import type { EngineAnalysis } from "@/types/engine";

type Metric = {
  key: string;
  label: string;
  format: (v: number) => string;
  /** Maps the value onto 0..1 for the meter; omitted for values without a natural scale. */
  meter?: (v: number) => number;
  hint: string;
};

const unit = (v: number) => Math.max(0, Math.min(1, v));

const METRICS: Metric[] = [
  { key: "brightness", label: "Brightness", format: (v) => v.toFixed(2), meter: unit, hint: "normalized spectral centroid" },
  { key: "centroid_hz", label: "Centroid", format: (v) => `${Math.round(v).toLocaleString("en-US")} Hz`, hint: "spectral center of mass" },
  { key: "rolloff_hz", label: "Rolloff", format: (v) => `${Math.round(v).toLocaleString("en-US")} Hz`, hint: "85% of energy below" },
  { key: "warmth", label: "Warmth", format: (v) => v.toFixed(2), meter: unit, hint: "energy below 500 Hz" },
  { key: "saturation", label: "Saturation", format: (v) => v.toFixed(2), meter: unit, hint: "spectral flatness, dB scale" },
  { key: "compression", label: "Compression", format: (v) => v.toFixed(2), meter: unit, hint: "inverse crest factor" },
  { key: "dynamic_range_db", label: "Crest factor", format: (v) => `${v.toFixed(1)} dB`, meter: (v) => unit(v / 30), hint: "peak to average" },
  { key: "attack_ms", label: "Attack", format: (v) => `${v.toFixed(1)} ms`, meter: (v) => unit(v / 60), hint: "onset to peak" },
  { key: "decay_db_per_s", label: "Decay", format: (v) => `${v.toFixed(0)} dB/s`, meter: (v) => unit(v / 80), hint: "post-onset fall" },
  { key: "estimated_reverb_tail_s", label: "Reverb tail", format: (v) => `${v.toFixed(2)} s`, meter: (v) => unit(v / 4), hint: "rough, not RT60" },
  { key: "tempo_bpm", label: "Tempo", format: (v) => `${Math.round(v)} bpm`, hint: "beat tracker estimate" },
  { key: "modulation_rate_hz", label: "Modulation", format: (v) => `${v.toFixed(2)} Hz`, hint: "amplitude LFO, if any" },
];

/**
 * The raw audio measurements the recipe was inferred from, so the numbers
 * behind the guess are visible. Rows stagger in and meters fill with
 * Anime.js; with reduced motion they render in their final state.
 */
export default function MeasurementsPanel({ features }: { features: EngineAnalysis["raw_features"] }) {
  const root = useRef<HTMLDListElement>(null);
  const reduce = useReducedMotion();
  const rows = METRICS.filter((m) => typeof features[m.key] === "number");

  useEffect(() => {
    const el = root.current;
    if (!el || reduce) return;
    const items = el.querySelectorAll<HTMLElement>("[data-metric]");
    const meters = el.querySelectorAll<HTMLElement>("[data-meter]");
    const enter = animate(items, {
      opacity: [0, 1],
      translateY: [8, 0],
      delay: stagger(35),
      duration: 420,
      ease: "outCubic",
    });
    const fill = animate(meters, {
      scaleX: { from: 0, to: (target?: Target) => Number((target as HTMLElement).dataset.meter) },
      delay: stagger(35, { start: 120 }),
      ease: createSpring({ stiffness: 140, damping: 18 }),
    });
    return () => {
      // Leave elements in their final state rather than mid-animation.
      enter.complete();
      fill.complete();
    };
  }, [reduce]);

  return (
    <section className="glass rounded-panel p-6" aria-labelledby="measurements-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="measurements-heading" className="font-mono text-xs uppercase tracking-[0.2em] text-signal">
          measurements
        </h2>
        <p className="font-mono text-[10px] text-muted">measured from the recording · the recipe is inferred from these</p>
      </div>
      <dl ref={root} className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.06] sm:grid-cols-3 lg:grid-cols-4">
        {rows.map((m) => {
          const value = features[m.key] as number;
          const level = m.meter?.(value);
          return (
            <div key={m.key} data-metric className="bg-bg-elevated px-4 py-3" title={m.hint}>
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{m.label}</dt>
              <dd className="mt-1 font-mono text-sm tabular-nums text-signal">{m.format(value)}</dd>
              {level !== undefined && (
                <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    data-meter={level}
                    className="h-full origin-left rounded-full bg-signal shadow-[0_0_6px_var(--color-signal)]"
                    style={{ transform: `scaleX(${level})` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </dl>
    </section>
  );
}
