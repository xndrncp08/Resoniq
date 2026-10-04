"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { animate, motion, useMotionValue, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { haptic, nearestDetent, rubberBand } from "@/components/ui/tactile/physics";

const SPREAD = 120; // degrees between the first and last detent
const DRAG_PX_PER_DEG = 1.6;

const detentAngle = (i: number, count: number) => -SPREAD / 2 + (SPREAD / Math.max(1, count - 1)) * i;
const OVERTRAVEL = 10; // max rubber-band past an end stop, degrees

/**
 * A detented rotary selector, like a 5-way pickup switch. Drag to turn it:
 * it moves freely, then snaps to the nearest position with a spring and a
 * click (and a vibration where supported). The labels around it are
 * buttons, so any position is one click away; arrow keys step through.
 */
export default function RotarySwitch<T extends string>({
  label,
  options,
  value,
  onChange,
  format = (v: T) => v,
  size = 56,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange?: (value: T) => void;
  format?: (v: T) => string;
  size?: number;
}) {
  const reduce = useReducedMotion();
  const detents = options.map((_, i) => detentAngle(i, options.length));
  const index = Math.max(0, options.indexOf(value));
  const angle = useMotionValue(detents[index]);
  const drag = useRef<{ y: number; x: number; from: number } | null>(null);
  const running = useRef<AnimationPlaybackControls | null>(null);
  const [clickKey, setClickKey] = useState(0);
  const interactive = !!onChange;

  useEffect(() => {
    if (drag.current) return;
    running.current?.stop();
    const target = detentAngle(index, options.length);
    if (reduce) angle.set(target);
    else running.current = animate(angle, target, { type: "spring", stiffness: 600, damping: 26 });
  }, [index, reduce, angle, options.length]);

  function select(i: number) {
    if (!onChange || i === index) return;
    haptic(6);
    setClickKey((k) => k + 1);
    onChange(options[i]);
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!interactive || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    running.current?.stop();
    drag.current = { x: e.clientX, y: e.clientY, from: angle.get() };
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    // Up or right turns clockwise.
    const raw = d.from + ((e.clientX - d.x) - (e.clientY - d.y)) / DRAG_PX_PER_DEG;
    const lo = detents[0];
    const hi = detents[detents.length - 1];
    angle.set(raw < lo ? lo + rubberBand(raw - lo, OVERTRAVEL) : raw > hi ? hi + rubberBand(raw - hi, OVERTRAVEL) : raw);
  }

  function onPointerUp() {
    if (!drag.current) return;
    drag.current = null;
    const i = nearestDetent(angle.get(), detents);
    if (i !== index) select(i);
    else running.current = animate(angle, detents[i], { type: "spring", stiffness: 600, damping: 26 });
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!interactive) return;
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    select(Math.max(0, Math.min(options.length - 1, index + step)));
  }

  return (
    <div className="flex items-center gap-4">
      <div
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={options.length - 1}
        aria-valuenow={index}
        aria-valuetext={format(value)}
        aria-readonly={!interactive || undefined}
        tabIndex={interactive ? 0 : -1}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className={`focus-ring relative flex-shrink-0 rounded-full ${interactive ? "cursor-grab touch-none active:cursor-grabbing" : ""}`}
        style={{ width: size, height: size }}
      >
        {/* detent ticks */}
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="absolute inset-0">
          {detents.map((d, i) => {
            const rad = ((d - 90) * Math.PI) / 180;
            const r1 = size / 2 - 2;
            const r2 = size / 2 - 6;
            const c = size / 2;
            const on = i === index;
            return (
              <line
                key={i}
                x1={(c + r1 * Math.cos(rad)).toFixed(2)}
                y1={(c + r1 * Math.sin(rad)).toFixed(2)}
                x2={(c + r2 * Math.cos(rad)).toFixed(2)}
                y2={(c + r2 * Math.sin(rad)).toFixed(2)}
                stroke={on ? "var(--color-copper)" : "rgba(255,255,255,0.18)"}
                strokeWidth={on ? 2 : 1.5}
                strokeLinecap="round"
              />
            );
          })}
        </svg>
        {/* the lever */}
        <motion.div
          style={{ rotate: angle }}
          className="absolute inset-[9px] rounded-full border border-white/10 bg-[#161b23] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_3px_8px_rgba(0,0,0,0.5)]"
        >
          <div className="absolute left-1/2 top-1 h-[42%] w-1 -translate-x-1/2 rounded-full bg-ink" />
        </motion.div>
        {/* click flash on each detent change */}
        <motion.span
          key={clickKey}
          aria-hidden
          initial={{ opacity: clickKey ? 0.8 : 0, scale: 0.85 }}
          animate={{ opacity: 0, scale: 1.25 }}
          transition={{ duration: 0.35 }}
          className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-copper/50"
        />
      </div>

      <div className="flex flex-wrap gap-1" role="group" aria-label={`${label} positions`}>
        {options.map((o, i) => (
          <button
            key={o}
            type="button"
            disabled={!interactive}
            aria-pressed={i === index}
            onClick={() => select(i)}
            className={`focus-ring rounded-full px-2 py-1 font-mono text-[10px] transition-colors ${
              i === index ? "bg-copper/15 text-copper" : "text-muted enabled:hover:text-ink"
            } disabled:cursor-default`}
          >
            {format(o)}
          </button>
        ))}
      </div>
    </div>
  );
}
