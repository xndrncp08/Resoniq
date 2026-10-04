"use client";

import type { AmpSettings, CabinetSettings, PickupPosition } from "@/types/tone";
import Knob from "@/components/ui/tactile/Knob";
import ParametricEQ from "@/components/ui/tactile/ParametricEQ";
import RotarySwitch from "@/components/ui/tactile/RotarySwitch";
import type { Weight } from "@/components/ui/tactile/physics";
import { gainsFromAmp } from "@/lib/eq";

type AmpKnob = keyof Omit<AmpSettings, "family" | "model">;

// Gain is the heavy pot: big jumps in distortion should take deliberate travel.
const AMP_KNOBS: { key: AmpKnob; label: string; weight: Weight }[] = [
  { key: "gain", label: "Gain", weight: "heavy" },
  { key: "bass", label: "Bass", weight: "medium" },
  { key: "mids", label: "Mids", weight: "medium" },
  { key: "treble", label: "Treble", weight: "medium" },
  { key: "presence", label: "Presence", weight: "medium" },
];

const PICKUPS = ["Neck", "Neck/Middle", "Middle", "Bridge/Middle", "Bridge"] as const satisfies readonly PickupPosition[];

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
        {AMP_KNOBS.map(({ key, label, weight }) => (
          <Knob
            key={key}
            label={label}
            weight={weight}
            value={amp[key]}
            onChange={onAmpChange && ((v) => onAmpChange({ ...amp, [key]: v }))}
          />
        ))}
      </div>

      <div className="mt-5">
        <div className="mb-1 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>eq response{onAmpChange && <span className="normal-case tracking-normal"> · drag a band</span>}</span>
          <span className="normal-case tracking-normal">100 · 1k · 10k Hz</span>
        </div>
        <ParametricEQ gains={gainsFromAmp(amp)} onBandChange={onAmpChange && ((band, knob) => onAmpChange({ ...amp, [band]: knob }))} />
      </div>

      <div className="mt-5">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">pickup</div>
        <RotarySwitch label="Pickup position" options={PICKUPS} value={pickup} onChange={onPickupChange} format={(p) => p.replace("/", " / ")} />
      </div>
    </div>
  );
}
