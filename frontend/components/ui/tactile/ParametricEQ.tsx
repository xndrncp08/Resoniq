"use client";

import { useId, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { BANDS, logFrequencies, MAX_DB, responseDb, xForHz, type BandKey, type EqGains } from "@/lib/eq";
import { gsap, REDUCED_MOTION, useGSAP } from "@/lib/gsap";
import { haptic, rubberBand } from "@/components/ui/tactile/physics";

const W = 600;
const H = 140;
const DB_RANGE = MAX_DB + 3; // headroom above the largest boost
const FREQS = logFrequencies(96);
const GRID_HZ = [100, 1000, 10000];
const OVERTRAVEL_DB = 2.5; // rubber-band past ±MAX_DB

const yForDb = (db: number) => H / 2 - (db / DB_RANGE) * (H / 2 - 8);
const dbForY = (y: number) => ((H / 2 - y) / (H / 2 - 8)) * DB_RANGE;
const fmt = (n: number) => n.toFixed(1);
const dbToKnob = (db: number) => Math.round(Math.max(0, Math.min(100, (db / MAX_DB) * 50 + 50)));

const LABELS: Record<BandKey, string> = { bass: "Bass", mids: "Mids", treble: "Treble", presence: "Presence" };

function paths(gains: EqGains) {
  const dbs = responseDb(gains, FREQS);
  const line = FREQS.map((f, i) => `${i ? "L" : "M"}${fmt(xForHz(f) * W)} ${fmt(yForDb(dbs[i]))}`).join(" ");
  return { line, area: `${line} L${W} ${H / 2} L0 ${H / 2} Z` };
}

/**
 * The amp's tone stack as a frequency response (the same filters the signal
 * monitor plays through, see lib/eq.ts), with a handle per band.
 *
 * Read-only without `onBandChange`. With it, each handle drags up and down
 * to set that band: the curve follows the pointer immediately, pushing past
 * ±12 dB rubber-bands and springs back, and the handles are keyboard
 * sliders too. Changes from elsewhere (knobs, reset) tween the curve with
 * GSAP. Painted client-side only: float maths can differ in the last digit
 * between Node and the browser.
 */
export default function ParametricEQ({
  gains,
  onBandChange,
  className = "",
}: {
  gains: EqGains;
  /** Receives the band's new knob value (0-100, 50 = flat). */
  onBandChange?: (band: BandKey, knob: number) => void;
  className?: string;
}) {
  const root = useRef<SVGSVGElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const handleRefs = useRef<(SVGGElement | null)[]>([]);
  // Current (possibly mid-tween, possibly rubber-banded) gains.
  const shown = useRef<EqGains | null>(null);
  const drag = useRef<{ band: BandKey; atBound: boolean } | null>(null);
  const fillId = `eq-fill-${useId().replace(/:/g, "")}`;
  const interactive = !!onBandChange;

  const paint = () => {
    const g = shown.current;
    if (!g) return;
    const { line, area } = paths(g);
    lineRef.current?.setAttribute("d", line);
    areaRef.current?.setAttribute("d", area);
    BANDS.forEach((b, i) => {
      const y = yForDb(responseDb(g, [b.frequency])[0]);
      handleRefs.current[i]?.setAttribute("transform", `translate(${fmt(xForHz(b.frequency) * W)} ${fmt(y)})`);
    });
  };

  useGSAP(
    () => {
      if (drag.current) return; // the pointer is driving the curve
      if (!shown.current) {
        shown.current = { ...gains };
        paint();
        return;
      }
      const mm = gsap.matchMedia();
      mm.add({ reduce: REDUCED_MOTION, full: `not ${REDUCED_MOTION}` }, (ctx) => {
        gsap.to(shown.current, { ...gains, duration: ctx.conditions?.reduce ? 0 : 0.45, ease: "power3.out", overwrite: true, onUpdate: paint });
      });
    },
    { dependencies: [gains.bass, gains.mids, gains.treble, gains.presence], scope: root },
  );

  function svgY(e: PointerEvent<SVGElement>) {
    const ctm = root.current?.getScreenCTM();
    if (!ctm) return H / 2;
    return new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse()).y;
  }

  function onPointerDown(band: BandKey, e: PointerEvent<SVGGElement>) {
    if (!interactive || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    gsap.killTweensOf(shown.current);
    drag.current = { band, atBound: false };
  }

  function onPointerMove(e: PointerEvent<SVGGElement>) {
    const d = drag.current;
    if (!d || !shown.current) return;
    const raw = dbForY(svgY(e));
    const past = Math.abs(raw) > MAX_DB;
    // Shown with rubber band past the range; reported clamped.
    shown.current[d.band] = past ? Math.sign(raw) * (MAX_DB + rubberBand(Math.abs(raw) - MAX_DB, OVERTRAVEL_DB)) : raw;
    paint();
    if (past && !d.atBound) haptic(10);
    d.atBound = past;
    onBandChange?.(d.band, dbToKnob(raw));
  }

  function onPointerUp() {
    const d = drag.current;
    if (!d || !shown.current) return;
    drag.current = null;
    // Settle onto the committed value (springs back if it was rubber-banded).
    gsap.to(shown.current, {
      [d.band]: Math.max(-MAX_DB, Math.min(MAX_DB, shown.current[d.band])),
      duration: 0.5,
      ease: "elastic.out(1, 0.55)",
      onUpdate: paint,
    });
  }

  function onKeyDown(band: BandKey, e: KeyboardEvent<SVGGElement>) {
    if (!onBandChange) return;
    const step = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    onBandChange(band, Math.max(0, Math.min(100, dbToKnob(gains[band]) + step)));
  }

  return (
    <svg
      ref={root}
      viewBox={`0 0 ${W} ${H}`}
      className={`h-auto w-full touch-none overflow-visible ${className}`}
      role="group"
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
        <g
          key={b.key}
          ref={(el) => {
            handleRefs.current[i] = el;
          }}
          transform={`translate(${fmt(xForHz(b.frequency) * W)} ${H / 2})`}
          role={interactive ? "slider" : undefined}
          tabIndex={interactive ? 0 : undefined}
          aria-label={interactive ? `${LABELS[b.key]} band` : undefined}
          aria-valuemin={interactive ? 0 : undefined}
          aria-valuemax={interactive ? 100 : undefined}
          aria-valuenow={interactive ? dbToKnob(gains[b.key]) : undefined}
          aria-valuetext={interactive ? `${fmt(gains[b.key])} dB` : undefined}
          onPointerDown={(e) => onPointerDown(b.key, e)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={(e) => onKeyDown(b.key, e)}
          className={`outline-none ${interactive ? "cursor-ns-resize [&:focus-visible>circle:last-child]:stroke-signal" : ""}`}
        >
          {/* generous invisible hit area around the visible dot */}
          {interactive && <circle r={14} fill="transparent" />}
          <circle
            r={interactive ? 5 : 3}
            fill="var(--color-bg)"
            stroke="var(--color-copper)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ))}
    </svg>
  );
}
