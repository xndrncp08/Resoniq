"use client";

import { useRef } from "react";
import { motion } from "motion/react";
import { ANALYSIS_STAGES, stageProgress, type StageEvent } from "@/lib/analysis-stages";
import { gsap, REDUCED_MOTION, useGSAP } from "@/lib/gsap";
import { spring } from "@/lib/motion";

const GROUPS = [
  { id: "upload", label: "Upload" },
  { id: "decode", label: "Decode" },
  { id: "measure", label: "Measure" },
  { id: "infer", label: "Infer" },
  { id: "recipe", label: "Recipe" },
] as const;

/**
 * The analysis as a signal path, driven by the stages python-engine actually
 * reports (nothing here is simulated). The path fills with a GSAP tween as
 * each stage arrives; the active node glows; measurement sub-steps tick off
 * under "Measure". With no stage info (the job is running in another tab and
 * this page is only polling), it says so instead of inventing progress.
 */
export default function AnalysisProgress({ stage }: { stage: StageEvent | null }) {
  const root = useRef<HTMLDivElement>(null);
  const current = stage ? ANALYSIS_STAGES.findIndex((s) => s.id === stage.stage) : -1;
  const progress = stage ? stageProgress(stage.index, stage.total) : 0;
  const activeGroup = current >= 0 ? ANALYSIS_STAGES[current].group : stage ? "decode" : null;
  const groupIndex = activeGroup ? GROUPS.findIndex((g) => g.id === activeGroup) : 0;
  const measureSteps = ANALYSIS_STAGES.filter((s) => s.group === "measure");
  const label = current >= 0 ? ANALYSIS_STAGES[current].label : stage?.stage ?? "Waiting for the engine";

  // Upload is already done when this shows, so the path starts one segment in.
  const fill = stage ? (1 + progress * (GROUPS.length - 1)) / GROUPS.length : 1 / GROUPS.length;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add({ reduce: REDUCED_MOTION, full: `not ${REDUCED_MOTION}` }, (ctx) => {
        gsap.to("[data-path-fill]", { scaleX: fill, duration: ctx.conditions?.reduce ? 0 : 0.6, ease: "power2.out", overwrite: true });
      });
    },
    { dependencies: [fill], scope: root },
  );

  return (
    <div ref={root} className="glass mx-auto max-w-2xl rounded-panel p-6">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">analyzing</p>
        <p className="font-mono text-[11px] tabular-nums text-muted">{stage ? `${stage.index + 1} / ${stage.total}` : "in progress"}</p>
      </div>

      <div
        role="progressbar"
        aria-label="Analysis progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={stage ? Math.round(progress * 100) : undefined}
        aria-valuetext={label}
        className="relative mt-6"
      >
        <div className="absolute inset-x-[10%] top-[11px] h-px bg-white/[0.08]" aria-hidden>
          <div
            data-path-fill
            className="h-full origin-left bg-gradient-to-r from-signal to-copper shadow-[0_0_8px_var(--color-signal)]"
            style={{ transform: `scaleX(${1 / GROUPS.length})` }}
          />
        </div>
        <ol className="relative grid grid-cols-5">
          {GROUPS.map((g, i) => {
            const done = i < groupIndex || (i === 0 && !!stage);
            const active = i === groupIndex && !!stage && i > 0;
            return (
              <li key={g.id} className="flex flex-col items-center gap-2">
                <span className="relative flex h-6 w-6 items-center justify-center">
                  {active && (
                    <motion.span
                      layoutId="analysis-active"
                      transition={spring.snappy}
                      className="absolute inset-0 rounded-full bg-signal/20 shadow-[0_0_14px_var(--color-signal)]"
                    />
                  )}
                  <span
                    className={`relative h-2.5 w-2.5 rounded-full transition-colors duration-300 ${
                      done ? "bg-signal" : active ? "animate-pulse bg-signal" : "bg-white/15"
                    }`}
                  />
                </span>
                <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${done || active ? "text-ink" : "text-muted"}`}>
                  {g.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Measurement sub-steps, ticking off under "Measure". */}
      <ul className="mt-5 flex flex-wrap justify-center gap-1.5" aria-label="Measurements">
        {measureSteps.map((m) => {
          const idx = ANALYSIS_STAGES.findIndex((s) => s.id === m.id);
          const state = current > idx ? "done" : current === idx ? "active" : "pending";
          return (
            <li
              key={m.id}
              className={`rounded-full border px-2 py-0.5 font-mono text-[10px] transition-colors duration-300 ${
                state === "done"
                  ? "border-signal/30 text-signal"
                  : state === "active"
                    ? "border-signal/60 bg-signal/10 text-ink"
                    : "border-white/10 text-muted"
              }`}
            >
              {m.label}
            </li>
          );
        })}
      </ul>

      <p role="status" aria-live="polite" className="mt-5 text-center font-body text-sm text-muted">
        {stage ? `${label}…` : "This song is being analyzed elsewhere (another tab or an earlier request). This page will update when it's done."}
      </p>
    </div>
  );
}
