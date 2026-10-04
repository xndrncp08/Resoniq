"use client";

import { useId } from "react";
import { LayoutGroup, motion } from "motion/react";
import type { AmpSettings, CabinetSettings, PickupPosition } from "@/types/tone";
import RotaryKnob from "@/components/tone/RotaryKnob";
import { spring } from "@/lib/motion";

const AMP_KNOBS: { key: keyof Omit<AmpSettings, "family" | "model">; label: string }[] = [
  { key: "gain", label: "Gain" },
  { key: "bass", label: "Bass" },
  { key: "mids", label: "Mids" },
  { key: "treble", label: "Treble" },
  { key: "presence", label: "Presence" },
];

const PICKUPS: PickupPosition[] = ["Neck", "Neck/Middle", "Middle", "Bridge/Middle", "Bridge"];

/** Amp faceplate + cab + pickup selector. Without onChange handlers it renders read-only. */
export default function AmpPanel({
  amp,
  cabinet,
  pickup,
  onAmpChange,
  onPickupChange,
}: {
  amp: AmpSettings;
  cabinet: CabinetSettings;
  pickup: PickupPosition;
  onAmpChange?: (amp: AmpSettings) => void;
  onPickupChange?: (pickup: PickupPosition) => void;
}) {
  const groupId = useId();
  return (
    <div className="glass rounded-panel p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">amp · {amp.family}</div>
          <div className="mt-1 font-display text-lg font-medium">{amp.model}</div>
        </div>
        <div className="text-right font-mono text-[11px] text-muted">
          {cabinet.type}
          <br />
          {cabinet.speaker}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-5 justify-items-center gap-2">
        {AMP_KNOBS.map(({ key, label }) => (
          <RotaryKnob
            key={key}
            label={label}
            value={amp[key]}
            onChange={onAmpChange && ((v) => onAmpChange({ ...amp, [key]: v }))}
          />
        ))}
      </div>

      <div className="mt-6">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">pickup</div>
        {/* The selected pill slides between positions (a shared layout animation). */}
        <LayoutGroup id={groupId}>
          <div role="radiogroup" aria-label="Pickup position" className="grid grid-cols-5 gap-1 rounded-full border border-white/10 p-1">
            {PICKUPS.map((p) => {
              const active = p === pickup;
              return (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={!onPickupChange}
                  onClick={() => onPickupChange?.(p)}
                  className={`focus-ring relative min-h-8 rounded-full px-1 py-1.5 font-mono text-[10px] transition-colors ${
                    active ? "text-bg" : "text-muted enabled:hover:text-ink"
                  } disabled:cursor-default`}
                >
                  {active && (
                    <motion.span layoutId="pickup-active" transition={spring.snappy} className="absolute inset-0 rounded-full bg-copper" />
                  )}
                  <span className="relative">{p.replace("/", " / ")}</span>
                </button>
              );
            })}
          </div>
        </LayoutGroup>
      </div>
    </div>
  );
}
