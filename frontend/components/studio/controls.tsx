"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type PointerEvent } from "react";

const START = -225;
const SWEEP = 270;

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

/**
 * The studio's knob: a real slider for assistive tech and keyboards. Drag up
 * or down (Shift for fine moves), double-click to return to its default,
 * arrows step by `step`, Page keys by ten steps, Home/End to the ends.
 */
export function StudioKnob({
  label,
  value,
  min = 0,
  max = 10,
  step = 0.1,
  defaultValue,
  format = (v) => v.toFixed(1),
  onChange,
  size = 56,
  disabled = false,
  accent = "var(--color-copper)",
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  size?: number;
  disabled?: boolean;
  accent?: string;
}) {
  const id = useId();
  const drag = useRef<{ y: number; v: number } | null>(null);
  const snap = (v: number) => Math.round(Math.max(min, Math.min(max, v)) / step) * step;
  const t = (value - min) / (max - min);
  const angle = START + t * SWEEP;
  const c = size / 2;
  const r = size / 2 - 5;

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus();
    drag.current = { y: e.clientY, v: value };
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const delta = ((d.y - e.clientY) / 200) * (max - min) * (e.shiftKey ? 0.2 : 1);
    d.y = e.clientY;
    d.v = Math.max(min, Math.min(max, d.v + delta));
    const next = snap(d.v);
    if (next !== value) onChange(Number(next.toFixed(4)));
  }
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, number> = { ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step, PageUp: step * 10, PageDown: -step * 10 };
    let next: number | null = null;
    if (e.key in moves) next = value + moves[e.key] * (e.shiftKey ? 10 : 1);
    if (e.key === "Home") next = min;
    if (e.key === "End") next = max;
    if (next === null) return;
    e.preventDefault();
    onChange(Number(snap(next).toFixed(4)));
  }

  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5">
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-labelledby={id}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Number(value.toFixed(2))}
        aria-valuetext={`${format(value)}`}
        aria-disabled={disabled || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onDoubleClick={() => defaultValue !== undefined && onChange(defaultValue)}
        onKeyDown={onKeyDown}
        className={`focus-ring tap-clean relative touch-none select-none rounded-full ${disabled ? "opacity-40" : "cursor-ns-resize"}`}
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
          <defs>
            <radialGradient id={`${id}-body`} cx="40%" cy="30%" r="75%">
              <stop offset="0%" stopColor="#3a3f48" />
              <stop offset="70%" stopColor="#171a1f" />
              <stop offset="100%" stopColor="#0b0c0f" />
            </radialGradient>
          </defs>
          <path d={arc(c, c, r, START, START + SWEEP)} stroke="rgba(255,255,255,0.09)" strokeWidth={3} fill="none" strokeLinecap="round" />
          {t > 0.002 && <path d={arc(c, c, r, START, angle)} stroke={accent} strokeWidth={3} fill="none" strokeLinecap="round" />}
          <circle cx={c} cy={c} r={r - 6} fill={`url(#${id}-body)`} stroke="rgba(255,255,255,0.1)" />
          <line x1={c} y1={c} x2={c + (r - 9) * Math.cos((angle * Math.PI) / 180)} y2={c + (r - 9) * Math.sin((angle * Math.PI) / 180)} stroke="#f3efe8" strokeWidth={2.5} strokeLinecap="round" />
        </svg>
      </div>
      <span id={id} className="max-w-full truncate font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{label}</span>
      <span className="font-mono text-[11px] tabular-nums text-ink" aria-hidden>{format(value)}</span>
    </div>
  );
}

/** A two-position switch drawn as a lit toggle. */
export function StudioSwitch({ label, on, onChange, disabled = false }: { label: string; on: boolean; onChange: (on: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="focus-ring tap-clean group flex flex-col items-center gap-1.5 rounded-lg px-1 disabled:opacity-40"
    >
      <span className={`relative flex h-9 w-5 items-start justify-center rounded-full border p-0.5 transition-colors ${on ? "border-copper/60 bg-copper/15" : "border-line-strong bg-bg-0"}`}>
        <span className={`h-3.5 w-3.5 rounded-full shadow transition-transform duration-150 ${on ? "translate-y-0 bg-copper shadow-[0_0_10px_var(--color-copper)]" : "translate-y-[18px] bg-muted"}`} />
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted group-hover:text-ink">{label}</span>
    </button>
  );
}

/**
 * Peak/RMS meter fed by a level getter (real analyser data). Draws straight
 * to the DOM on animation frames, so it never re-renders React.
 */
export function Meter({ read, label }: { read: (() => { rms: number; peak: number }) | null; label: string }) {
  const rmsBar = useRef<HTMLDivElement>(null);
  const peakBar = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!read) {
      if (rmsBar.current) rmsBar.current.style.transform = "scaleY(0)";
      if (peakBar.current) peakBar.current.style.bottom = "0%";
      if (text.current) text.current.textContent = "—";
      return;
    }
    let raf = 0;
    let hold = -100;
    let holdAt = 0;
    const frac = (db: number) => Math.max(0, Math.min(1, (db + 60) / 60));
    const tick = (now: number) => {
      const { rms, peak } = read();
      if (peak > hold || now - holdAt > 900) {
        hold = peak;
        holdAt = now;
      }
      if (rmsBar.current) {
        rmsBar.current.style.transform = `scaleY(${frac(rms)})`;
        rmsBar.current.style.background = peak > -1 ? "var(--color-danger)" : "linear-gradient(to top, var(--color-signal), var(--color-copper))";
      }
      if (peakBar.current) peakBar.current.style.bottom = `${frac(hold) * 100}%`;
      if (text.current) text.current.textContent = hold <= -99 ? "−∞" : hold.toFixed(1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [read]);
  return (
    <div className="flex flex-col items-center gap-1" aria-hidden>
      <div className="relative h-16 w-1.5 overflow-hidden rounded-full bg-bg-0 ring-1 ring-line">
        <div ref={rmsBar} className="absolute inset-0 origin-bottom" style={{ transform: "scaleY(0)" }} />
        <div ref={peakBar} className="absolute inset-x-0 h-px bg-ink" style={{ bottom: "0%" }} />
      </div>
      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">{label}</span>
      <span ref={text} className="font-mono text-[9px] tabular-nums text-ink-dim">—</span>
    </div>
  );
}
