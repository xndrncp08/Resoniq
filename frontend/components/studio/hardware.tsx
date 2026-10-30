"use client";

import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { Footswitch, Led, StudioKnob, StudioSwitch } from "@/components/studio/controls";
import { AMP_LOOKS, CAB_LOOKS, brushed, grilleStyle, tolexStyle, type AmpLook } from "@/components/studio/looks";
import { AMP_DESIGNS, CAB_DESIGNS, EFFECT_DESIGNS, type AmpKnob, type AmpModelId, type AmpSwitch, type CabModelId, type Effect, type StudioPatch } from "@/lib/studio/patch";

const LOGO_FONT: Record<AmpLook["logo"]["font"], CSSProperties> = {
  script: { fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", fontWeight: 700, letterSpacing: "0.01em" },
  block: { fontFamily: "var(--font-display, ui-sans-serif)", fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase" },
  serif: { fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" },
  mono: { fontFamily: "ui-monospace, monospace", fontWeight: 600, letterSpacing: "0.3em", textTransform: "uppercase" },
};

function Screw({ className }: { className: string }) {
  return <span aria-hidden className={`absolute h-2 w-2 rounded-full bg-[radial-gradient(circle_at_35%_35%,#f4f4f4,#7d8288)] shadow-[0_1px_1px_rgba(0,0,0,.5)] ${className}`}><span className="absolute left-[1px] right-[1px] top-1/2 h-px -translate-y-1/2 rotate-45 bg-black/50" /></span>;
}

function Corners({ color }: { color: string | null }) {
  if (!color) return null;
  const c = "absolute h-4 w-4 rounded-[3px] shadow-[0_1px_2px_rgba(0,0,0,.6)]";
  const bg = { background: `radial-gradient(circle at 35% 30%,#fff8,transparent 55%),${color}` };
  return (
    <>
      <span aria-hidden className={`${c} -left-0.5 -top-0.5`} style={bg} />
      <span aria-hidden className={`${c} -right-0.5 -top-0.5`} style={bg} />
      <span aria-hidden className={`${c} -bottom-0.5 -left-0.5`} style={bg} />
      <span aria-hidden className={`${c} -bottom-0.5 -right-0.5`} style={bg} />
    </>
  );
}

/** The amp's jewel pilot lamp: lit while audio is actually running. */
function Jewel({ color, on, size = 18 }: { color: string; on: boolean; size?: number }) {
  return (
    <span aria-hidden className="relative inline-block rounded-full border border-black/50" style={{ width: size, height: size, background: on ? `radial-gradient(circle at 40% 35%,#fff,${color} 40%,${color}aa 70%,#200)` : `radial-gradient(circle at 40% 35%,#ffffff55,${color}44 45%,#1a0505)`, boxShadow: on ? `0 0 ${size}px ${color}, 0 0 ${size * 2}px ${color}66` : "inset 0 1px 3px rgba(0,0,0,.6)" }}>
      <span className="absolute inset-[18%] rounded-full" style={{ background: "repeating-conic-gradient(from 0deg,rgba(255,255,255,.18) 0 30deg,transparent 30deg 60deg)" }} />
    </span>
  );
}

// ── Amp head ───────────────────────────────────────────────────────────

export type AmpFaceProps = {
  model: AmpModelId;
  amp: StudioPatch["amp"];
  knobs: { key: AmpKnob; label: string }[];
  switches: { key: AmpSwitch; label: string }[];
  powered: boolean;
  onKnob?: (k: AmpKnob, v: number) => void;
  onSwitch?: (k: AmpSwitch, v: boolean) => void;
  onPower?: () => void;
  readOnly?: boolean;
  /** Smaller knobs, no grille text: for cards and profiles. */
  compact?: boolean;
  title?: string;
};

/** An amp head, front view: covering, grille with the logo, and a working faceplate. */
export function AmpFace({ model, amp, knobs, switches, powered, onKnob, onSwitch, onPower, readOnly = false, compact = false, title }: AmpFaceProps) {
  const look = AMP_LOOKS[model];
  const d = AMP_DESIGNS[model];
  const size = compact ? 34 : 50;
  return (
    <div className="relative mx-auto w-full max-w-4xl pt-3">
      {/* Carry handle */}
      <span aria-hidden className="absolute left-1/2 top-0 h-4 w-28 -translate-x-1/2 rounded-t-lg border border-b-0 border-black/60 bg-[linear-gradient(180deg,#2a2622,#0e0c0a)] shadow-[0_-1px_0_rgba(255,255,255,.08)_inset]" />
      <div className="relative rounded-[14px] p-2.5 shadow-[0_18px_40px_-12px_rgba(0,0,0,.8),0_2px_0_rgba(255,255,255,.06)_inset]" style={{ ...tolexStyle(look.tolex, look.grain), outline: look.piping ? `2px solid ${look.piping}` : undefined, outlineOffset: -6 }}>
        <Corners color={look.corners} />
        <div className={`relative flex items-center overflow-hidden rounded-md border border-black/50 shadow-[inset_0_2px_8px_rgba(0,0,0,.6)] ${compact ? "h-14" : "h-24 sm:h-32"}`} style={grilleStyle(look.grille)}>
          <span className={`absolute left-4 top-3 rounded px-2 py-0.5 ${compact ? "text-sm" : "text-lg sm:text-2xl"}`} style={{ ...LOGO_FONT[look.logo.font], color: look.logo.color, textShadow: "0 1px 1px rgba(0,0,0,.6), 0 -1px 0 rgba(255,255,255,.15)" }}>{title ?? d.name}</span>
          {look.grille.kind === "glass" && <span aria-hidden className="absolute inset-0 transition-opacity duration-300" style={{ opacity: powered ? 1 : 0.35, background: "radial-gradient(60% 90% at 50% 120%, #37e6c9aa, transparent 70%)" }} />}
        </div>
        <div className={`relative mt-2.5 rounded-md border border-black/50 shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_1px_2px_rgba(0,0,0,.6)] ${compact ? "px-2 py-2" : "px-3 py-3 sm:px-5"}`} style={{ background: look.panel.brushed ? brushed(look.panel.background) : look.panel.background }}>
          <Screw className="left-1.5 top-1.5" /><Screw className="right-1.5 top-1.5" /><Screw className="bottom-1.5 left-1.5" /><Screw className="bottom-1.5 right-1.5" />
          <div className={`flex flex-wrap items-end justify-center gap-x-1 gap-y-2 ${compact ? "" : "sm:justify-between sm:gap-x-2"}`}>
            {!compact && (
              <div className="hidden flex-col items-center gap-1 self-center sm:flex" aria-hidden>
                <span className="block h-6 w-6 rounded-full border-2 border-[#9aa0a6] bg-[radial-gradient(circle,#000_40%,#2a2a2a_42%,#55595e_70%)] shadow-[0_1px_2px_rgba(0,0,0,.6)]" />
                <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color: look.panel.ink }}>Input</span>
              </div>
            )}
            {switches.map((s) => (
              <StudioSwitch key={s.key} label={s.label} on={amp[s.key]} onChange={(v) => onSwitch?.(s.key, v)} disabled={readOnly} ink={look.panel.ink} />
            ))}
            {knobs.map((k) => (
              <StudioKnob key={k.key} label={k.label} value={amp[k.key]} defaultValue={5} onChange={(v) => onKnob?.(k.key, v)} look={look.knob} size={size} ink={look.panel.ink} accent={look.panel.accent} scale={!compact} readOnly={readOnly} />
            ))}
            <div className="flex items-end gap-2 sm:pl-2">
              <div className="flex flex-col items-center gap-1 pb-4"><Jewel color={look.jewel} on={powered} size={compact ? 12 : 18} /></div>
              {!readOnly && onPower && <StudioSwitch label="Power" on={powered} onChange={onPower} ink={look.panel.ink} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A small amp head for the signal chain and the amp library (no controls). */
export function MiniAmp({ model, powered = false, width = 120 }: { model: AmpModelId; powered?: boolean; width?: number }) {
  const look = AMP_LOOKS[model];
  return (
    <div aria-hidden className="relative rounded-[6px] p-1 shadow-[0_6px_12px_-6px_rgba(0,0,0,.8)]" style={{ ...tolexStyle(look.tolex, look.grain), width, outline: look.piping ? `1px solid ${look.piping}` : undefined, outlineOffset: -3 }}>
      <div className="relative flex h-8 items-start overflow-hidden rounded-[3px] border border-black/50 px-1.5 pt-0.5" style={grilleStyle(look.grille)}>
        <span className="truncate text-[9px]" style={{ ...LOGO_FONT[look.logo.font], color: look.logo.color }}>{AMP_DESIGNS[model].name}</span>
      </div>
      <div className="mt-1 flex h-4 items-center justify-between rounded-[2px] border border-black/50 px-1.5" style={{ background: look.panel.background }}>
        <span className="flex gap-[3px]">{AMP_DESIGNS[model].knobs.map((k) => <span key={k.key} className="h-2 w-2 rounded-full bg-black/80 ring-1 ring-white/20" />)}</span>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: powered ? look.jewel : "#3a1512", boxShadow: powered ? `0 0 6px ${look.jewel}` : undefined }} />
      </div>
    </div>
  );
}

// ── Cabinets ───────────────────────────────────────────────────────────

const LAYOUT: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 4: "grid-cols-2" };

/** A cabinet, front view; the speakers show through the cloth. */
export function CabFace({ model, width = 260, label = true }: { model: CabModelId; width?: number; label?: boolean }) {
  const look = CAB_LOOKS[model];
  const d = CAB_DESIGNS[model];
  const tall = d.speakers === 4 || d.speakers === 1;
  return (
    <div aria-hidden className="relative rounded-[10px] p-2 shadow-[0_14px_30px_-10px_rgba(0,0,0,.8)]" style={{ ...tolexStyle(look.tolex, look.grain), width, outline: look.piping ? `2px solid ${look.piping}` : undefined, outlineOffset: -5 }}>
      <div className="relative overflow-hidden rounded-[5px] border border-black/60 p-[8%]" style={{ ...grilleStyle(look.grille), aspectRatio: tall ? (d.speakers === 1 ? "1 / 0.95" : "1 / 0.9") : "1.9 / 1" }}>
        <div className={`grid h-full ${LAYOUT[d.speakers]} gap-[8%]`}>
          {Array.from({ length: d.speakers }, (_, i) => (
            <span key={i} className="mx-auto aspect-square h-full max-h-full rounded-full" style={{ background: "radial-gradient(circle,rgba(0,0,0,.28) 0 22%,rgba(0,0,0,.08) 23% 60%,rgba(0,0,0,.32) 62% 70%,transparent 72%)", width: d.size === 10 ? "86%" : "100%" }} />
          ))}
        </div>
        {label && <span className="absolute bottom-1.5 right-2 rounded-sm bg-black/60 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.2em] text-[#e9e2d0]">{d.name.split(" ")[0]}</span>}
      </div>
    </div>
  );
}

/**
 * A close-up of one speaker with the mic in front of it. Drag the mic (or use
 * the arrow keys) from the dust cap (0) to the cone's edge (10); further away
 * draws the mic smaller.
 */
export function SpeakerMic({ position, distance, onPosition, disabled = false }: { position: number; distance: number; onPosition: (v: number) => void; disabled?: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const W = 260;
  const c = W / 2;
  const R = 112;
  const set = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const x = ((clientX - box.left) / box.width) * W;
    onPosition(Math.round(Math.max(0, Math.min(10, ((x - c) / (R * 0.86)) * 10)) * 10) / 10);
  };
  const onKey = (e: KeyboardEvent) => {
    const step = { ArrowRight: 0.5, ArrowUp: 0.5, ArrowLeft: -0.5, ArrowDown: -0.5 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    onPosition(Math.max(0, Math.min(10, Math.round((position + step) * 10) / 10)));
  };
  const mx = c + (position / 10) * R * 0.86;
  const mr = 22 - distance * 1.2;
  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${W} ${W}`}
      className={`focus-ring tap-clean w-full max-w-[260px] touch-none select-none rounded-full ${disabled ? "opacity-40" : "cursor-ew-resize"}`}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label="Mic position on the speaker"
      aria-valuemin={0}
      aria-valuemax={10}
      aria-valuenow={position}
      aria-valuetext={position < 2 ? `${position.toFixed(1)}, at the centre` : position > 8 ? `${position.toFixed(1)}, at the edge` : position.toFixed(1)}
      aria-disabled={disabled || undefined}
      onKeyDown={disabled ? undefined : onKey}
      onPointerDown={(e: PointerEvent<SVGSVGElement>) => { if (disabled) return; e.currentTarget.setPointerCapture(e.pointerId); dragging.current = true; set(e.clientX); }}
      onPointerMove={(e) => dragging.current && set(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      <defs>
        <radialGradient id="cone" cx="50%" cy="45%" r="60%"><stop offset="0" stopColor="#3a3a3c" /><stop offset=".6" stopColor="#1b1b1c" /><stop offset="1" stopColor="#0a0a0a" /></radialGradient>
        <radialGradient id="cap" cx="40%" cy="35%" r="70%"><stop offset="0" stopColor="#5a5a5e" /><stop offset="1" stopColor="#0d0d0e" /></radialGradient>
        <linearGradient id="mic" x1="0" x2="1"><stop offset="0" stopColor="#6d7178" /><stop offset=".5" stopColor="#e9ebee" /><stop offset="1" stopColor="#5d6168" /></linearGradient>
      </defs>
      <circle cx={c} cy={c} r={R + 12} fill="#141414" stroke="#2c2c2e" strokeWidth={4} />
      <circle cx={c} cy={c} r={R} fill="url(#cone)" stroke="#2a2a2a" strokeWidth={8} />
      {[0.82, 0.66, 0.5].map((k) => <circle key={k} cx={c} cy={c} r={R * k} fill="none" stroke="rgba(255,255,255,.05)" />)}
      <circle cx={c} cy={c} r={R * 0.24} fill="url(#cap)" />
      {[0, 2.5, 5, 7.5, 10].map((v) => <line key={v} x1={c + (v / 10) * R * 0.86} y1={c + R + 2} x2={c + (v / 10) * R * 0.86} y2={c + R + 9} stroke="#8b93a1" strokeWidth={1.5} />)}
      {/* The mic, seen from the front: grille capsule with a shadow */}
      <ellipse cx={mx + 3} cy={c + 4} rx={mr} ry={mr} fill="rgba(0,0,0,.45)" />
      <circle cx={mx} cy={c} r={mr} fill="url(#mic)" stroke="#2a2c30" strokeWidth={1.5} />
      <circle cx={mx} cy={c} r={mr * 0.72} fill="none" stroke="rgba(0,0,0,.35)" strokeDasharray="2 2" />
    </svg>
  );
}

// ── Pedals ─────────────────────────────────────────────────────────────

function enclosure(color: string): CSSProperties {
  return { background: `linear-gradient(160deg,rgba(255,255,255,.22),transparent 35%,rgba(0,0,0,.28)),${color}` };
}

/** A pedal for the board: LED, tiny knob faces, name and a working footswitch. */
export function MiniPedal({ effect, onToggle, selected }: { effect: Effect; onToggle?: (on: boolean) => void; selected?: boolean }) {
  const d = EFFECT_DESIGNS[effect.type];
  const ink = d.ink === "dark" ? "#1b1b1b" : "#f3efe8";
  const shown = d.params.slice(0, effect.type === "eq" ? 0 : 3);
  return (
    <div className={`relative flex h-[132px] w-[88px] flex-col items-center rounded-[10px] border border-black/60 px-1.5 pb-2 pt-2 shadow-[0_8px_14px_-6px_rgba(0,0,0,.85),inset_0_1px_0_rgba(255,255,255,.25)] ${selected ? "ring-2 ring-copper ring-offset-2 ring-offset-bg-0" : ""} ${effect.on ? "" : "saturate-[.55]"}`} style={enclosure(d.color)}>
      <span aria-hidden className="flex h-5 items-center gap-1">
        {effect.type === "eq"
          ? [0, 1, 2, 3, 4, 5].map((i) => <span key={i} className="relative h-4 w-[3px] rounded bg-black/60"><span className="absolute left-1/2 h-1 w-2 -translate-x-1/2 rounded-[1px] bg-[#e5e5e5]" style={{ bottom: `${(effect.params[d.params[i].key] / 10) * 75}%` }} /></span>)
          : shown.map((p) => <span key={p.key} className="relative h-4 w-4 rounded-full bg-[radial-gradient(circle_at_40%_35%,#4a4a4e,#050505)]" style={{ transform: `rotate(${(effect.params[p.key] / 10) * 270 - 135}deg)` }}><span className="absolute left-1/2 top-0.5 h-1.5 w-px -translate-x-1/2 bg-white" /></span>)}
      </span>
      <span className="mt-2"><Led on={effect.on} size={7} /></span>
      <span className="mt-1.5 line-clamp-2 text-center font-display text-[11px] font-bold leading-tight" style={{ color: ink }}>{d.name}</span>
      <span className="font-mono text-[8px] uppercase tracking-[0.12em]" style={{ color: ink, opacity: 0.7 }}>{d.kind}</span>
      <span className="mt-auto">
        {onToggle ? <Footswitch on={effect.on} label={`${d.name} ${effect.on ? "on" : "bypassed"}`} onChange={onToggle} size={30} /> : <span className="block h-[30px] w-[30px] rounded-full bg-[radial-gradient(circle_at_40%_35%,#fff,#8d9197)]" />}
      </span>
    </div>
  );
}

/** The full-size pedal with every control. EQ shows faders; voiced pedals a selector. */
export function Stompbox({ effect, children, controls }: { effect: Effect; children?: ReactNode; controls: ReactNode }) {
  const d = EFFECT_DESIGNS[effect.type];
  const ink = d.ink === "dark" ? "#1b1b1b" : "#f3efe8";
  return (
    <div className="relative mx-auto flex w-full max-w-[340px] flex-col items-center rounded-[18px] border border-black/60 px-4 pb-5 pt-4 shadow-[0_24px_40px_-14px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.3)]" style={enclosure(d.color)}>
      <Screw className="left-2 top-2" /><Screw className="right-2 top-2" /><Screw className="bottom-2 left-2" /><Screw className="bottom-2 right-2" />
      {/* jacks */}
      <span aria-hidden className="absolute -left-1.5 top-16 h-5 w-2 rounded-l bg-[linear-gradient(90deg,#55595e,#c9ccd1)]" />
      <span aria-hidden className="absolute -right-1.5 top-16 h-5 w-2 rounded-r bg-[linear-gradient(90deg,#c9ccd1,#55595e)]" />
      <div className="flex w-full flex-wrap items-start justify-center gap-x-3 gap-y-2">{controls}</div>
      {children}
      <span className="mt-4"><Led on={effect.on} size={10} /></span>
      <p className="mt-3 text-center font-display text-2xl font-black leading-none tracking-tight" style={{ color: ink }}>{d.name}</p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: ink, opacity: 0.7 }}>{d.kind}</p>
    </div>
  );
}

export const pedalInk = (effect: Effect) => (EFFECT_DESIGNS[effect.type].ink === "dark" ? "#1b1b1b" : "#f3efe8");
