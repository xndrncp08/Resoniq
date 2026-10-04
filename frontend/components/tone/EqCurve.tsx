"use client";

import { useId, useRef } from "react";
import { BANDS, logFrequencies, MAX_DB, responseDb, xForHz, type EqGains } from "@/lib/eq";
import { gsap, REDUCED_MOTION, useGSAP } from "@/lib/gsap";

const W = 600;
const H = 140;
const DB_RANGE = MAX_DB + 3; // headroom above the largest boost
const FREQS = logFrequencies(96);
const GRID_HZ = [100, 1000, 10000];

const yForDb = (db: number) => H / 2 - (db / DB_RANGE) * (H / 2 - 8);
const fmt = (n: number) => n.toFixed(1);

function paths(gains: EqGains) {
  const dbs = responseDb(gains, FREQS);
  const line = FREQS.map((f, i) => `${i ? "L" : "M"}${fmt(xForHz(f) * W)} ${fmt(yForDb(dbs[i]))}`).join(" ");
  return { line, area: `${line} L${W} ${H / 2} L0 ${H / 2} Z` };
}

/**
 * Frequency response of the amp's bass / mids / treble / presence knobs,
 * computed with the same filters the signal monitor plays through
 * (lib/eq.ts). Knob changes tween the curve with GSAP: a proxy object of
 * band gains eases to the new values and the path is recomputed per frame.
 */
export default function EqCurve({ gains, className = "" }: { gains: EqGains; className?: string }) {
  const root = useRef<SVGSVGElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const handleRefs = useRef<(SVGCircleElement | null)[]>([]);
  // Current (possibly mid-tween) gains; persists across renders.
  const shown = useRef<EqGains | null>(null);
  const fillId = `eq-fill-${useId().replace(/:/g, "")}`;

  useGSAP(
    () => {
      const paint = () => {
        const g = shown.current!;
        const { line, area } = paths(g);
        lineRef.current?.setAttribute("d", line);
        areaRef.current?.setAttribute("d", area);
        BANDS.forEach((b, i) => handleRefs.current[i]?.setAttribute("cy", fmt(yForDb(responseDb(g, [b.frequency])[0]))));
      };

      if (!shown.current) {
        shown.current = { ...gains };
        paint();
        return;
      }
      const mm = gsap.matchMedia();
      mm.add({ reduce: REDUCED_MOTION, full: `not ${REDUCED_MOTION}` }, (ctx) => {
        gsap.to(shown.current, {
          ...gains,
          duration: ctx.conditions?.reduce ? 0 : 0.45,
          ease: "power3.out",
          overwrite: true,
          onUpdate: paint,
        });
      });
    },
    { dependencies: [gains.bass, gains.mids, gains.treble, gains.presence], scope: root },
  );

  return (
    <svg
      ref={root}
      viewBox={`0 0 ${W} ${H}`}
      className={`h-auto w-full overflow-visible ${className}`}
      role="img"
      aria-label={`EQ curve: bass ${fmt(gains.bass)} dB, mids ${fmt(gains.mids)} dB, treble ${fmt(gains.treble)} dB, presence ${fmt(gains.presence)} dB`}
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-copper)" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--color-copper)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {GRID_HZ.map((hz) => (
        <line key={hz} x1={fmt(xForHz(hz) * W)} x2={fmt(xForHz(hz) * W)} y1={0} y2={H} stroke="rgba(255,255,255,0.05)" vectorEffect="non-scaling-stroke" />
      ))}
      <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      <path ref={areaRef} fill={`url(#${fillId})`} />
      <path ref={lineRef} fill="none" stroke="var(--color-copper)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {BANDS.map((b, i) => (
        <circle
          key={b.key}
          ref={(el) => {
            handleRefs.current[i] = el;
          }}
          cx={fmt(xForHz(b.frequency) * W)}
          cy={H / 2}
          r={3}
          fill="var(--color-bg)"
          stroke="var(--color-copper)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
