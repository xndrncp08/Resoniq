"use client";

import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { animate, useMotionValue, useReducedMotion, useTransform, motion, type AnimationPlaybackControls } from "motion/react";
import { clampValue, elasticValue, haptic, MAX, MIN, VelocityTracker, WEIGHTS, type Weight } from "@/components/ui/tactile/physics";

/**
 * A horizontal fader with the same physics as Knob: grab anywhere on the
 * track (the thumb jumps there, then follows), rubber-band past the ends,
 * glide on a flick. `smooth` (the default) is the master-volume feel: even
 * and linear with soft ends.
 */
export default function Slider({
  label,
  value,
  onChange,
  weight = "smooth",
  format = (v: number) => String(v),
  className = "",
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  weight?: Weight;
  format?: (v: number) => string;
  className?: string;
}) {
  const profile = WEIGHTS[weight];
  const reduce = useReducedMotion();
  const display = useMotionValue(value);
  const left = useTransform(display, (v) => `${v}%`);
  const fill = useTransform(display, (v) => clampValue(v) / 100);
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const tracker = useRef(new VelocityTracker());
  const running = useRef<AnimationPlaybackControls | null>(null);
  const lastEmitted = useRef(value);
  const atBound = useRef(false);

  useEffect(() => {
    if (dragging.current || value === lastEmitted.current) return;
    lastEmitted.current = value;
    running.current?.stop();
    if (reduce) display.set(value);
    else running.current = animate(display, value, { type: "spring", stiffness: 300, damping: 30 });
  }, [value, display, reduce]);

  useEffect(() => () => running.current?.stop(), []);

  const emit = (raw: number) => {
    const v = Math.round(clampValue(raw));
    if (v !== lastEmitted.current) {
      lastEmitted.current = v;
      onChange(v);
    }
  };

  const rawFromPointer = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * 100;
  };

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    running.current?.stop();
    dragging.current = true;
    tracker.current.reset();
    const raw = rawFromPointer(e.clientX);
    tracker.current.add(raw, e.timeStamp);
    display.set(reduce ? clampValue(raw) : elasticValue(raw, profile));
    emit(raw);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    const raw = rawFromPointer(e.clientX);
    tracker.current.add(raw, e.timeStamp);
    display.set(reduce ? clampValue(raw) : elasticValue(raw, profile));
    emit(raw);
    const past = raw < MIN || raw > MAX;
    if (past && !atBound.current) haptic(10);
    atBound.current = past;
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    dragging.current = false;
    const from = display.get();
    if (reduce) return;
    if (from < MIN || from > MAX) {
      running.current = animate(display, clampValue(from), { type: "spring", stiffness: profile.bounceStiffness, damping: profile.bounceDamping });
      return;
    }
    const velocity = tracker.current.velocity(e.timeStamp);
    if (Math.abs(velocity) < profile.flickThreshold) return;
    running.current = animate(display, from, {
      type: "inertia",
      velocity,
      power: profile.power,
      timeConstant: profile.timeConstant,
      min: MIN,
      max: MAX,
      bounceStiffness: profile.bounceStiffness,
      bounceDamping: profile.bounceDamping,
      onUpdate: emit,
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 };
    let next: number;
    if (e.key in step) next = value + step[e.key];
    else if (e.key === "Home") next = MIN;
    else if (e.key === "End") next = MAX;
    else return;
    e.preventDefault();
    onChange(clampValue(next));
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{label}</span>
      <div
        ref={track}
        role="slider"
        aria-label={label}
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={value}
        aria-valuetext={format(value)}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className="focus-ring relative h-6 min-w-24 flex-1 cursor-ew-resize touch-none rounded-full"
      >
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/[0.08]" />
        <motion.div
          style={{ scaleX: fill }}
          className="absolute inset-x-0 top-1/2 h-1 origin-left -translate-y-1/2 rounded-full bg-signal shadow-[0_0_8px_var(--color-signal)]"
        />
        <motion.div
          style={{ left }}
          className="absolute top-1/2 h-4 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-white/20 bg-[#1b212b] shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
        />
      </div>
      <span className="w-10 text-right font-mono text-[10px] tabular-nums text-ink/80">{format(value)}</span>
    </div>
  );
}
