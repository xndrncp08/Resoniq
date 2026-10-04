"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { animate, useMotionValue, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { clampValue, elasticValue, haptic, MAX, MIN, VelocityTracker, WEIGHTS, type Weight } from "@/components/ui/tactile/physics";

const SWEEP = 270; // degrees of travel, 7 o'clock to 5 o'clock
const START = -135;

// Rounded so server and browser agree: Math.cos/sin can differ in the last
// floating-point digit between engines, which is a hydration mismatch.
const round3 = (n: number) => Math.round(n * 1000) / 1000;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: round3(cx + r * Math.cos(rad)), y: round3(cy + r * Math.sin(rad)) };
}

function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const a = polar(cx, cy, r, from);
  const b = polar(cx, cy, r, to);
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${b.x} ${b.y}`;
}

function geometry(size: number) {
  const c = size / 2;
  return { c, trackR: c - 3, bodyR: c - 9 };
}

/** Arc + pointer for a displayed value, which may sit slightly past 0..100 while rubber-banding. */
function shapes(size: number, v: number) {
  const { c, trackR, bodyR } = geometry(size);
  const angle = START + (v / 100) * SWEEP;
  const arcTo = START + (clampValue(v) / 100) * SWEEP;
  return {
    arc: v > 0.5 ? arc(c, c, trackR, START, arcTo) : "",
    from: polar(c, c, bodyR * 0.35, angle),
    to: polar(c, c, bodyR * 0.85, angle),
  };
}

/**
 * A rotary control with physical feel (see physics.ts).
 *
 * - Drag vertically (Shift for fine). Travel per sweep depends on `weight`:
 *   gain is `heavy`, tone-stack EQ `medium`, pedal trims `light`.
 * - Push past either end and it rubber-bands, with a short pulse on the arc
 *   (and a vibration where supported); let go and it springs back.
 * - Flick and release: it keeps turning on Motion's inertia, slowing by its
 *   weight and bouncing off the ends. A slow release stops where it is.
 * - Keys (arrows, PageUp/PageDown, Home/End) and outside changes (reset, a
 *   new recipe) settle on a spring.
 *
 * Rendering goes straight to the SVG from a motion value, so a board of
 * knobs moving never re-renders React per frame. The value reported via
 * onChange is always a whole number in 0..100. Without onChange it's
 * read-only. Reduced motion: no glide, no rubber band, no springs.
 */
export default function Knob({
  label,
  value,
  onChange,
  size = 64,
  weight = "medium",
  disabled = false,
}: {
  label: string;
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  weight?: Weight;
  disabled?: boolean;
}) {
  const profile = WEIGHTS[weight];
  const reduce = useReducedMotion();
  const interactive = !!onChange && !disabled;
  const display = useMotionValue(value);
  const thud = useMotionValue(0);
  const arcRef = useRef<SVGPathElement>(null);
  const glowRef = useRef<SVGPathElement>(null);
  const pointerRef = useRef<SVGLineElement>(null);
  const gesture = useRef<{ startY: number; startValue: number; atBound: boolean } | null>(null);
  const tracker = useRef(new VelocityTracker());
  const running = useRef<AnimationPlaybackControls | null>(null);
  const lastEmitted = useRef(value);
  const onChangeRef = useRef(onChange);
  // React paints the first frame only; afterwards the motion value owns these attributes.
  const [initial] = useState(() => shapes(size, value));
  const { c, trackR, bodyR } = geometry(size);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Motion value -> SVG.
  useEffect(() => {
    const paint = (v: number) => {
      const s = shapes(size, v);
      arcRef.current?.setAttribute("d", s.arc);
      const line = pointerRef.current;
      if (line) {
        line.setAttribute("x1", String(s.from.x));
        line.setAttribute("y1", String(s.from.y));
        line.setAttribute("x2", String(s.to.x));
        line.setAttribute("y2", String(s.to.y));
      }
    };
    const offDisplay = display.on("change", paint);
    const offThud = thud.on("change", (t) => glowRef.current?.setAttribute("stroke-opacity", String(t)));
    return () => {
      offDisplay();
      offThud();
    };
  }, [display, thud, size]);

  // Outside changes (keys, reset, a new recipe) settle on a spring. Values this
  // knob emitted itself are already where they should be.
  useEffect(() => {
    if (gesture.current || value === lastEmitted.current) return;
    lastEmitted.current = value;
    running.current?.stop();
    running.current = reduce
      ? (display.set(value), null)
      : animate(display, value, { type: "spring", stiffness: profile.bounceStiffness * 0.5, damping: profile.bounceDamping * 0.7 });
  }, [value, display, reduce, profile]);

  useEffect(() => () => running.current?.stop(), []);

  function emit(raw: number) {
    const v = Math.round(clampValue(raw));
    if (v !== lastEmitted.current) {
      lastEmitted.current = v;
      onChangeRef.current?.(v);
    }
  }

  function pulse() {
    haptic(10);
    if (!reduce) animate(thud, [0.9, 0], { duration: 0.35, ease: "easeOut" });
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!interactive || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    running.current?.stop();
    const startValue = clampValue(display.get());
    gesture.current = { startY: e.clientY, startValue, atBound: false };
    tracker.current.reset();
    tracker.current.add(startValue, e.timeStamp);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g) return;
    const scale = e.shiftKey ? 0.25 : 1;
    const raw = g.startValue + ((g.startY - e.clientY) / profile.travelPx) * (MAX - MIN) * scale;
    display.set(reduce ? clampValue(raw) : elasticValue(raw, profile));
    tracker.current.add(raw, e.timeStamp);
    emit(raw);
    const past = raw < MIN || raw > MAX;
    if (past && !g.atBound) pulse();
    g.atBound = past;
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (!gesture.current) return;
    gesture.current = null;
    const from = display.get();
    if (reduce) {
      display.set(clampValue(from));
      return;
    }
    if (from < MIN || from > MAX) {
      // Released past an end: spring back to it.
      running.current = animate(display, clampValue(from), {
        type: "spring",
        stiffness: profile.bounceStiffness,
        damping: profile.bounceDamping,
      });
      return;
    }
    const velocity = tracker.current.velocity(e.timeStamp);
    if (Math.abs(velocity) < profile.flickThreshold) return;
    // A flick: keep turning, slow down by weight, bounce off the ends.
    running.current = animate(display, from, {
      type: "inertia",
      velocity,
      power: profile.power,
      timeConstant: profile.timeConstant,
      min: MIN,
      max: MAX,
      bounceStiffness: profile.bounceStiffness,
      bounceDamping: profile.bounceDamping,
      onUpdate: (v) => emit(v),
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!interactive) return;
    const step: Record<string, number> = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 };
    let next: number;
    if (e.key in step) next = value + step[e.key];
    else if (e.key === "Home") next = MIN;
    else if (e.key === "End") next = MAX;
    else return;
    e.preventDefault();
    if ((next < MIN && value === MIN) || (next > MAX && value === MAX)) pulse();
    onChangeRef.current?.(clampValue(next));
  }

  return (
    <div className={`flex select-none flex-col items-center gap-1.5 ${disabled ? "opacity-40" : ""}`}>
      <div
        role="slider"
        aria-label={label}
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={clampValue(Math.round(value))}
        aria-readonly={!interactive || undefined}
        aria-disabled={disabled || undefined}
        tabIndex={interactive ? 0 : -1}
        data-weight={weight}
        className={`focus-ring relative rounded-full ${interactive ? "cursor-ns-resize touch-none" : ""}`}
        style={{ width: size, height: size }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="overflow-visible">
          <path d={arc(c, c, trackR, START, START + SWEEP)} stroke="rgba(255,255,255,0.08)" strokeWidth={3} fill="none" strokeLinecap="round" />
          {/* End-stop pulse: flashes when the knob is pushed into either end. */}
          <path
            ref={glowRef}
            d={arc(c, c, trackR, START, START + SWEEP)}
            stroke="var(--color-copper)"
            strokeOpacity={0}
            strokeWidth={6}
            fill="none"
            strokeLinecap="round"
            style={{ filter: "blur(3px)" }}
          />
          <path ref={arcRef} d={initial.arc} stroke="var(--color-copper)" strokeWidth={3} fill="none" strokeLinecap="round" />
          <circle cx={c} cy={c} r={bodyR} fill="#161b23" stroke="rgba(255,255,255,0.1)" />
          {/* Heavier pots get a knurled skirt, so weight reads before you touch them. */}
          {weight === "heavy" && <circle cx={c} cy={c} r={bodyR - 1.5} fill="none" stroke="rgba(255,255,255,0.09)" strokeDasharray="1.5 2.5" />}
          <circle cx={c} cy={c} r={bodyR - 4} fill="none" stroke="rgba(255,255,255,0.04)" />
          <line
            ref={pointerRef}
            x1={initial.from.x}
            y1={initial.from.y}
            x2={initial.to.x}
            y2={initial.to.y}
            stroke="var(--color-ink)"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </svg>
        <span className="pointer-events-none absolute inset-x-0 bottom-0 text-center font-mono text-[10px] tabular-nums text-ink/80">
          {clampValue(Math.round(value))}
        </span>
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{label}</span>
    </div>
  );
}
