"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type PointerEvent } from "react";
import type { KnobLook } from "@/components/studio/looks";

const START = -225;
const SWEEP = 270;
const rad = (a: number) => (a * Math.PI) / 180;

/** Shared drag and keyboard behaviour for knobs and faders (role="slider"). */
function useSlider({ value, min, max, step, onChange, disabled, axis = "y" }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; disabled: boolean; axis?: "y" | "fader" }) {
  const drag = useRef<{ y: number; v: number; h: number } | null>(null);
  const snap = (v: number) => Math.round(Math.max(min, Math.min(max, v)) / step) * step;
  const emit = (v: number) => {
    const next = Number(snap(v).toFixed(4));
    if (next !== value) onChange(next);
  };
  return {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      if (disabled || e.button > 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.focus();
      drag.current = { y: e.clientY, v: value, h: e.currentTarget.getBoundingClientRect().height };
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const d = drag.current;
      if (!d) return;
      // Knobs: 200 px of travel for the full range (Shift for fine). Faders follow the finger.
      const travel = axis === "fader" ? Math.max(40, d.h - 24) : 200;
      d.v = Math.max(min, Math.min(max, d.v + ((d.y - e.clientY) / travel) * (max - min) * (e.shiftKey ? 0.2 : 1)));
      d.y = e.clientY;
      emit(d.v);
    },
    onPointerUp: () => void (drag.current = null),
    onPointerCancel: () => void (drag.current = null),
    onKeyDown(e: KeyboardEvent<HTMLElement>) {
      const moves: Record<string, number> = { ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step, PageUp: step * 10, PageDown: -step * 10 };
      let next: number | null = null;
      if (e.key in moves) next = value + moves[e.key] * (e.shiftKey ? 10 : 1);
      if (e.key === "Home") next = min;
      if (e.key === "End") next = max;
      if (next === null) return;
      e.preventDefault();
      emit(next);
    },
  };
}

function KnobArt({ look, size, angle, t, accent, id }: { look: KnobLook; size: number; angle: number; t: number; accent: string; id: string }) {
  const c = size / 2;
  const r = size / 2 - 2;
  const tip = (len: number) => [c + len * Math.cos(rad(angle)), c + len * Math.sin(rad(angle))] as const;
  if (look === "rack") {
    const arc = (a0: number, a1: number) => {
      const p = (a: number) => [c + r * Math.cos(rad(a)), c + r * Math.sin(rad(a))];
      const [x0, y0] = p(a0);
      const [x1, y1] = p(a1);
      return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
    };
    const [x, y] = tip(r - 9);
    return (
      <>
        <defs>
          <radialGradient id={`${id}b`} cx="40%" cy="30%" r="75%"><stop offset="0%" stopColor="#3a3f48" /><stop offset="70%" stopColor="#171a1f" /><stop offset="100%" stopColor="#0b0c0f" /></radialGradient>
        </defs>
        <path d={arc(START, START + SWEEP)} stroke="rgba(255,255,255,0.09)" strokeWidth={3} fill="none" strokeLinecap="round" />
        {t > 0.002 && <path d={arc(START, angle)} stroke={accent} strokeWidth={3} fill="none" strokeLinecap="round" />}
        <circle cx={c} cy={c} r={r - 6} fill={`url(#${id}b)`} stroke="rgba(255,255,255,0.1)" />
        <line x1={c} y1={c} x2={x} y2={y} stroke="#f3efe8" strokeWidth={2.5} strokeLinecap="round" />
      </>
    );
  }
  const shadow = <ellipse cx={c} cy={c + r * 0.12} rx={r * 0.98} ry={r * 0.98} fill="rgba(0,0,0,.45)" filter={`url(#${id}s)`} />;
  const blur = <filter id={`${id}s`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation={size / 28} /></filter>;
  if (look === "chicken") {
    // A bakelite pointer knob: round body with a long tapered pointer.
    const len = r * 0.98;
    return (
      <>
        <defs>{blur}<radialGradient id={`${id}b`} cx="35%" cy="28%" r="80%"><stop offset="0%" stopColor="#4a4a4e" /><stop offset="55%" stopColor="#141416" /><stop offset="100%" stopColor="#050506" /></radialGradient></defs>
        {shadow}
        <g transform={`rotate(${angle + 90} ${c} ${c})`}>
          <path d={`M ${c - r * 0.28} ${c} L ${c} ${c - len} L ${c + r * 0.28} ${c} Z`} fill={`url(#${id}b)`} stroke="rgba(255,255,255,.08)" />
          <line x1={c} y1={c - r * 0.2} x2={c} y2={c - len + 3} stroke="#f3efe8" strokeWidth={Math.max(1.5, size / 30)} strokeLinecap="round" />
        </g>
        <circle cx={c} cy={c} r={r * 0.62} fill={`url(#${id}b)`} stroke="rgba(255,255,255,.1)" />
        <circle cx={c - r * 0.18} cy={c - r * 0.22} r={r * 0.2} fill="rgba(255,255,255,.07)" />
      </>
    );
  }
  if (look === "knurled") {
    const [x, y] = tip(r * 0.58);
    const ridges = Array.from({ length: 36 }, (_, i) => i * 10);
    return (
      <>
        <defs>{blur}<linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#f4f6f8" /><stop offset="45%" stopColor="#a9afb6" /><stop offset="100%" stopColor="#5d6268" /></linearGradient>
          <radialGradient id={`${id}t`} cx="40%" cy="35%" r="75%"><stop offset="0%" stopColor="#ffffff" /><stop offset="60%" stopColor="#c3c8ce" /><stop offset="100%" stopColor="#80868d" /></radialGradient></defs>
        {shadow}
        <circle cx={c} cy={c} r={r * 0.92} fill={`url(#${id}b)`} />
        {ridges.map((a) => <line key={a} x1={c + r * 0.78 * Math.cos(rad(a))} y1={c + r * 0.78 * Math.sin(rad(a))} x2={c + r * 0.92 * Math.cos(rad(a))} y2={c + r * 0.92 * Math.sin(rad(a))} stroke="rgba(0,0,0,.35)" strokeWidth={1} />)}
        <circle cx={c} cy={c} r={r * 0.72} fill={`url(#${id}t)`} />
        <line x1={c} y1={c} x2={x} y2={y} stroke={accent} strokeWidth={Math.max(2, size / 22)} strokeLinecap="round" />
      </>
    );
  }
  if (look === "skirted") {
    // A cap over a metal skirt printed 1–10; the numbers turn with it.
    const nums = Array.from({ length: 10 }, (_, i) => i + 1);
    const [x, y] = tip(r * 0.92);
    return (
      <>
        <defs>{blur}<radialGradient id={`${id}k`} cx="50%" cy="40%" r="70%"><stop offset="0%" stopColor="#f0f2f4" /><stop offset="100%" stopColor="#8b9198" /></radialGradient>
          <radialGradient id={`${id}b`} cx="38%" cy="30%" r="80%"><stop offset="0%" stopColor="#3c3c40" /><stop offset="60%" stopColor="#111113" /><stop offset="100%" stopColor="#000" /></radialGradient></defs>
        {shadow}
        <circle cx={c} cy={c} r={r * 0.98} fill={`url(#${id}k)`} />
        <g transform={`rotate(${angle - START} ${c} ${c})`}>
          {size >= 48 && nums.map((n, i) => {
            const a = START + ((i + 1) / 10) * SWEEP;
            const tx = c + r * 0.8 * Math.cos(rad(a));
            const ty = c + r * 0.8 * Math.sin(rad(a));
            return <text key={n} x={tx} y={ty} fontSize={size / 9} textAnchor="middle" dominantBaseline="central" fill="#1d1f22" fontFamily="ui-sans-serif,system-ui" fontWeight={700} transform={`rotate(${a + 90} ${tx} ${ty})`}>{n}</text>;
          })}
        </g>
        <circle cx={c} cy={c} r={r * 0.6} fill={`url(#${id}b)`} stroke="rgba(255,255,255,.12)" />
        <line x1={c + r * 0.62 * Math.cos(rad(angle))} y1={c + r * 0.62 * Math.sin(rad(angle))} x2={x} y2={y} stroke="#111" strokeWidth={2} strokeLinecap="round" />
        <circle cx={c - r * 0.15} cy={c - r * 0.2} r={r * 0.2} fill="rgba(255,255,255,.06)" />
      </>
    );
  }
  if (look === "dome") {
    const [x, y] = tip(r * 0.66);
    const [sx, sy] = tip(r * 0.3);
    return (
      <>
        <defs>{blur}<radialGradient id={`${id}b`} cx="38%" cy="28%" r="80%"><stop offset="0%" stopColor="#5a4146" /><stop offset="45%" stopColor="#2c1a1e" /><stop offset="100%" stopColor="#0d0708" /></radialGradient></defs>
        {shadow}
        <circle cx={c} cy={c} r={r * 0.95} fill="#1a1012" />
        <circle cx={c} cy={c} r={r * 0.82} fill={`url(#${id}b)`} />
        <line x1={sx} y1={sy} x2={x} y2={y} stroke={accent} strokeWidth={Math.max(2, size / 20)} strokeLinecap="round" />
        <ellipse cx={c - r * 0.2} cy={c - r * 0.32} rx={r * 0.32} ry={r * 0.18} fill="rgba(255,255,255,.14)" />
      </>
    );
  }
  // Pedal knob: small black cap with a white line.
  const [x, y] = tip(r * 0.8);
  return (
    <>
      <defs>{blur}<radialGradient id={`${id}b`} cx="40%" cy="30%" r="80%"><stop offset="0%" stopColor="#4a4a4e" /><stop offset="60%" stopColor="#151517" /><stop offset="100%" stopColor="#030303" /></radialGradient></defs>
      {shadow}
      <circle cx={c} cy={c} r={r * 0.95} fill={`url(#${id}b)`} stroke="rgba(255,255,255,.12)" />
      <line x1={c + r * 0.25 * Math.cos(rad(angle))} y1={c + r * 0.25 * Math.sin(rad(angle))} x2={x} y2={y} stroke="#f3efe8" strokeWidth={Math.max(1.8, size / 18)} strokeLinecap="round" />
    </>
  );
}

/**
 * A rotary control drawn as real hardware, and a real slider for assistive
 * tech and keyboards. Drag up or down (Shift for fine moves), double-click to
 * return to its default, arrows step by `step`, Page keys by ten steps,
 * Home/End to the ends. `scale` prints 0–10 around it in the panel's ink.
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
  look = "rack",
  ink,
  scale = false,
  readOnly = false,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  format?: (v: number) => string;
  onChange?: (v: number) => void;
  size?: number;
  disabled?: boolean;
  accent?: string;
  look?: KnobLook;
  /** Label colour, for printing on a faceplate. */
  ink?: string;
  scale?: boolean;
  readOnly?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const t = (value - min) / (max - min);
  const angle = START + t * SWEEP;
  const slider = useSlider({ value, min, max, step, onChange: onChange ?? (() => {}), disabled: disabled || readOnly });
  const pad = scale ? Math.round(size * 0.26) : 0;
  const box = size + pad * 2;
  const ticks = scale ? Array.from({ length: 11 }, (_, i) => i) : [];
  const art = (
    <svg width={box} height={box} viewBox={`${-pad} ${-pad} ${box} ${box}`} aria-hidden className="overflow-visible">
      {ticks.map((i) => {
        const a = START + (i / 10) * SWEEP;
        const r1 = size / 2 + 1;
        const r2 = size / 2 + (i % 5 === 0 ? 5 : 3);
        const c = size / 2;
        return (
          <g key={i}>
            <line x1={c + r1 * Math.cos(rad(a))} y1={c + r1 * Math.sin(rad(a))} x2={c + r2 * Math.cos(rad(a))} y2={c + r2 * Math.sin(rad(a))} stroke={ink} strokeOpacity={0.7} strokeWidth={1} />
            {size >= 44 && i % 2 === 0 && <text x={c + (size / 2 + pad * 0.68) * Math.cos(rad(a))} y={c + (size / 2 + pad * 0.68) * Math.sin(rad(a))} fontSize={Math.max(7, size / 8)} fill={ink} fillOpacity={0.8} textAnchor="middle" dominantBaseline="central" fontFamily="ui-monospace,monospace">{i}</text>}
          </g>
        );
      })}
      <KnobArt look={look} size={size} angle={angle} t={t} accent={accent} id={id} />
    </svg>
  );
  if (readOnly) {
    return (
      <div className="flex min-w-0 flex-col items-center gap-1" role="img" aria-label={`${label} ${format(value)}`}>
        {art}
        <span className="max-w-full truncate font-mono text-[9px] uppercase tracking-[0.14em]" style={{ color: ink ?? "var(--color-muted)" }}>{label}</span>
      </div>
    );
  }
  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-labelledby={`${id}l`}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Number(value.toFixed(2))}
        aria-valuetext={format(value)}
        aria-disabled={disabled || undefined}
        {...slider}
        onDoubleClick={() => !disabled && defaultValue !== undefined && onChange?.(defaultValue)}
        className={`focus-ring tap-clean relative touch-none select-none rounded-full ${disabled ? "opacity-40" : "cursor-ns-resize"}`}
      >
        {art}
      </div>
      <span id={`${id}l`} className="max-w-full truncate font-mono text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: ink ?? "var(--color-muted)" }}>{label}</span>
      <span className="font-mono text-[10px] tabular-nums" style={{ color: ink ?? "var(--color-ink)", opacity: 0.75 }} aria-hidden>{format(value)}</span>
    </div>
  );
}

/** A vertical fader (graphic EQ band). Same keyboard and drag rules as the knobs. */
export function Fader({ label, value, min = 0, max = 10, step = 0.1, defaultValue, format = (v) => v.toFixed(1), onChange, ink = "#1d1f22", height = 120 }: { label: string; value: number; min?: number; max?: number; step?: number; defaultValue?: number; format?: (v: number) => string; onChange: (v: number) => void; ink?: string; height?: number }) {
  const id = useId();
  const slider = useSlider({ value, min, max, step, onChange, disabled: false, axis: "fader" });
  const t = (value - min) / (max - min);
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={id}
        aria-orientation="vertical"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Number(value.toFixed(2))}
        aria-valuetext={format(value)}
        {...slider}
        onDoubleClick={() => defaultValue !== undefined && onChange(defaultValue)}
        className="focus-ring tap-clean relative w-8 cursor-ns-resize touch-none select-none rounded"
        style={{ height }}
      >
        <span aria-hidden className="absolute left-1/2 top-2 bottom-2 w-1 -translate-x-1/2 rounded-full bg-black/70 shadow-[inset_0_1px_2px_rgba(0,0,0,.8)]" />
        <span aria-hidden className="absolute left-1 right-1 top-1/2 h-px" style={{ background: ink, opacity: 0.35 }} />
        <span aria-hidden className="absolute left-1/2 h-5 w-7 -translate-x-1/2 rounded-sm border border-black/50 bg-[linear-gradient(180deg,#f4f4f4,#9a9ea4_45%,#e8e8e8_50%,#8a8e94)] shadow-[0_2px_3px_rgba(0,0,0,.5)]" style={{ bottom: `calc(${t} * (100% - 1.25rem))` }}>
          <span className="absolute inset-x-1 top-1/2 h-px bg-black/70" />
        </span>
      </div>
      <span id={id} className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em]" style={{ color: ink }}>{label}</span>
    </div>
  );
}

/** A bat-handle toggle switch on a panel. */
export function StudioSwitch({ label, on, onChange, disabled = false, ink, offLabel }: { label: string; on: boolean; onChange: (on: boolean) => void; disabled?: boolean; ink?: string; offLabel?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} className="focus-ring tap-clean group flex flex-col items-center gap-1 rounded-lg px-1 disabled:opacity-40">
      <svg width="26" height="40" viewBox="0 0 26 40" aria-hidden>
        <defs>
          <linearGradient id="bat" x1="0" x2="1"><stop offset="0" stopColor="#8c9097" /><stop offset=".45" stopColor="#f7f8f9" /><stop offset="1" stopColor="#6d7178" /></linearGradient>
          <radialGradient id="nut" cx="40%" cy="35%"><stop offset="0" stopColor="#f2f3f5" /><stop offset="1" stopColor="#70757c" /></radialGradient>
        </defs>
        <polygon points="13,12 21,16.5 21,25.5 13,30 5,25.5 5,16.5" fill="url(#nut)" stroke="rgba(0,0,0,.4)" />
        <circle cx="13" cy="21" r="4" fill="#2a2c30" />
        <g style={{ transform: on ? "none" : "scaleY(-1)", transformOrigin: "13px 21px", transition: "transform 120ms" }}>
          <path d="M11.2 21 L10.2 4.5 Q13 1.5 15.8 4.5 L14.8 21 Z" fill="url(#bat)" stroke="rgba(0,0,0,.35)" strokeWidth=".6" />
        </g>
      </svg>
      <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color: ink ?? "var(--color-muted)" }}>{on || !offLabel ? label : offLabel}</span>
    </button>
  );
}

/** A pedal's status LED. */
export function Led({ on, color = "#ff3b30", size = 8 }: { on: boolean; color?: string; size?: number }) {
  return <span aria-hidden className="inline-block rounded-full" style={{ width: size, height: size, background: on ? color : "#3a1512", boxShadow: on ? `0 0 ${size}px ${color}, inset 0 -1px 2px rgba(0,0,0,.4)` : "inset 0 1px 2px rgba(0,0,0,.6)" }} />;
}

/** A metal stomp switch. It's a real toggle (bypass). */
export function Footswitch({ on, label, onChange, size = 40 }: { on: boolean; label: string; onChange: (on: boolean) => void; size?: number }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={(e) => { e.stopPropagation(); onChange(!on); }} className="focus-ring tap-clean rounded-full active:translate-y-px" style={{ width: size, height: size }}>
      <span aria-hidden className="block h-full w-full rounded-full border border-black/50 bg-[radial-gradient(circle_at_40%_35%,#ffffff,#b8bcc2_45%,#5e6268_80%)] shadow-[0_3px_5px_rgba(0,0,0,.55),inset_0_-2px_3px_rgba(0,0,0,.35)]">
        <span className="m-[22%] block h-[56%] w-[56%] rounded-full bg-[radial-gradient(circle_at_45%_40%,#e9ebee,#8d9197)] shadow-[inset_0_1px_2px_rgba(0,0,0,.4)]" />
      </span>
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
    <div className="flex flex-col items-center gap-1" data-meter={label}>
      <div aria-hidden className="relative h-16 w-1.5 overflow-hidden rounded-full bg-bg-0 ring-1 ring-line">
        <div ref={rmsBar} className="absolute inset-0 origin-bottom" style={{ transform: "scaleY(0)" }} />
        <div ref={peakBar} className="absolute inset-x-0 h-px bg-ink" style={{ bottom: "0%" }} />
      </div>
      <span aria-hidden className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">{label}</span>
      <span ref={text} className="font-mono text-[9px] tabular-nums text-ink-dim" data-peak>—</span>
    </div>
  );
}
