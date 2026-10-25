import { createStore } from "zustand/vanilla";
import type { AmpSettings, CabinetSettings, PedalSlot, PickupPosition } from "@/types/tone";

export const AMP_KNOBS = ["gain", "bass", "mids", "treble", "presence"] as const;
export type AmpKnob = (typeof AMP_KNOBS)[number];

/** The part of a tone you can dial: what every rig view reads and writes. */
export type RigSound = { amp: AmpSettings; cabinet: CabinetSettings; pickup: PickupPosition; pedalboard: PedalSlot[] };

export type RigState = RigSound & {
  /** What the editor opened with; "reset" returns here. */
  baseline: RigSound;
  setKnob: (knob: AmpKnob, value: number) => void;
  setAmp: (amp: AmpSettings) => void;
  setPickup: (pickup: PickupPosition) => void;
  setPedalboard: (pedalboard: PedalSlot[]) => void;
  reset: () => void;
};

export type RigStore = ReturnType<typeof createRigStore>;

export const clampKnob = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : 0);

/**
 * One store per editor instance (never module-global), so two rigs on a page,
 * two users, or two server requests can't share state.
 */
export function createRigStore(initial: RigSound) {
  const baseline = structuredClone(initial);
  return createStore<RigState>()((set) => ({
    ...structuredClone(initial),
    baseline,
    setKnob: (knob, value) =>
      set((s) => {
        const next = clampKnob(value);
        return s.amp[knob] === next ? s : { amp: { ...s.amp, [knob]: next } };
      }),
    setAmp: (amp) => set({ amp: { ...amp, ...Object.fromEntries(AMP_KNOBS.map((k) => [k, clampKnob(amp[k])])) } }),
    setPickup: (pickup) => set({ pickup }),
    setPedalboard: (pedalboard) => set({ pedalboard }),
    reset: () => set(structuredClone(baseline)),
  }));
}

export const soundOf = ({ amp, cabinet, pickup, pedalboard }: RigSound): RigSound => ({ amp, cabinet, pickup, pedalboard });

export const isDirty = (s: RigState) => JSON.stringify(soundOf(s)) !== JSON.stringify(s.baseline);
