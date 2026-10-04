"use client";

import { useEffect, useRef, useState } from "react";
import { animate, createSpring, type JSAnimation } from "animejs";
import { useReducedMotion } from "motion/react";

const SWEEP = 270; // degrees of travel, 7 o'clock to 5 o'clock
const START = -135;
const DRAG_RANGE_PX = 180; // vertical drag distance for a full 0-100 sweep

// Rounded so server and browser agree: Math.cos/sin can differ in the last
// floating-point digit between engines, which is a hydration mismatch.
const round = (n: number) => Math.round(n * 1000) / 1000;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: round(cx + r * Math.cos(rad)), y: round(cy + r * Math.sin(rad)) };
}

function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const a = polar(cx, cy, r, from);
  const b = polar(cx, cy, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
}

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

// A slightly underdamped spring: the pointer swings past and settles, the
// way a real knob's indicator reads when you flick it.
const KNOB_SPRING = createSpring({ mass: 1, stiffness: 240, damping: 18 });

function geometry(size: number) {
  const c = size / 2;
  return { c, trackR: c - 3, bodyR: c - 9 };
}

/** Arc + pointer for a (possibly fractional, mid-animation) value. */
function shapes(size: number, v: number) {
  const { c, trackR, bodyR } = geometry(size);
  const angle = START + (Math.max(0, Math.min(100, v)) / 100) * SWEEP;
  const from = polar(c, c, bodyR * 0.35, angle);
  const to = polar(c, c, bodyR * 0.85, angle);
  return { arc: v > 0.5 ? arc(c, c, trackR, START, angle) : "", from, to };
}

/**
 * 0-100 rotary control. Drag vertically (Shift for fine), or use arrow
 * keys / PageUp / PageDown / Home / End when focused. With no onChange it
 * renders read-only (e.g. on the public recipe page).
 *
 * Dragging moves the pointer 1:1. Any other change (keys, reset, a new
 * recipe) settles on an Anime.js spring, painted straight to the SVG so a
 * board of knobs animating doesn't re-render React every frame.
 */
export default function RotaryKnob({
  label,
  value,
  onChange,
  size = 64,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  disabled?: boolean;
}) {
  const drag = useRef<{ y: number; value: number } | null>(null);
  const arcRef = useRef<SVGPathElement>(null);
  const pointerRef = useRef<SVGLineElement>(null);
  const shown = useRef(value);
  const anim = useRef<JSAnimation | null>(null);
  const reduce = useReducedMotion();
  const interactive = !!onChange && !disabled;
  const { c, trackR, bodyR } = geometry(size);
  // React paints the first frame only; after that the effect owns these
  // attributes, so a re-render can't snap the pointer ahead of the spring.
  const [initial] = useState(() => shapes(size, value));

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

    anim.current?.cancel();
    if (drag.current || reduce || shown.current === value) {
      shown.current = value;
      paint(value);
      return;
    }
    const state = { v: shown.current };
    anim.current = animate(state, {
      v: value,
      ease: KNOB_SPRING,
      onUpdate: () => {
        shown.current = state.v;
        paint(state.v);
      },
    });
    return () => {
      anim.current?.cancel();
    };
  }, [value, size, reduce]);

  function set(v: number) {
    if (interactive) onChange(clamp(v));
  }

  return (
    <div className={`flex select-none flex-col items-center gap-1.5 ${disabled ? "opacity-40" : ""}`}>
      <div
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamp(value)}
        aria-readonly={!interactive || undefined}
        aria-disabled={disabled || undefined}
        tabIndex={interactive ? 0 : -1}
        className={`focus-ring relative rounded-full ${interactive ? "cursor-ns-resize touch-none" : ""}`}
        style={{ width: size, height: size }}
        onPointerDown={(e) => {
          if (!interactive) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { y: e.clientY, value };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const scale = e.shiftKey ? 0.25 : 1;
          set(drag.current.value + ((drag.current.y - e.clientY) / DRAG_RANGE_PX) * 100 * scale);
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={(e) => {
          const step: Record<string, number> = {
            ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10,
          };
          if (e.key in step) set(value + step[e.key]);
          else if (e.key === "Home") set(0);
          else if (e.key === "End") set(100);
          else return;
          e.preventDefault();
        }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
          <path d={arc(c, c, trackR, START, START + SWEEP)} stroke="rgba(255,255,255,0.08)" strokeWidth={3} fill="none" strokeLinecap="round" />
          <path ref={arcRef} d={initial.arc} stroke="var(--color-copper)" strokeWidth={3} fill="none" strokeLinecap="round" />
          <circle cx={c} cy={c} r={bodyR} fill="#161b23" stroke="rgba(255,255,255,0.1)" />
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
          {clamp(value)}
        </span>
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{label}</span>
    </div>
  );
}
