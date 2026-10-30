import { useEffect } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { deviceStorage } from "@/lib/consent";
import { MAX_BPM, MIN_BPM } from "@/lib/practice";
import { isGearProfile, type GearProfileId } from "@/lib/gear-translate";
import { isMidiSignature } from "@/lib/midi";

/**
 * Per-device preferences: how this browser should render, and where you left
 * the practice tools. Nothing here is account data, so it lives in
 * localStorage and is the same whoever signs in on this device.
 */
export type Preferences = {
  /** Interactive 3D views. "auto": on capable devices, on request on low-power ones; "on": always; "off": never. */
  scene3d: "auto" | "on" | "off";
  metronome: { bpm: number; beats: number; volume: number };
  /** The kind of gear analysis suggestions are translated for. */
  gear: GearProfileId;
  /** Gig Mode: the MIDI messages (learned from a footswitch) that step the setlist, and where program changes go. */
  midi: { next: string | null; prev: string | null; output: string | null; channel: number };
  setScene3d: (mode: Preferences["scene3d"]) => void;
  setGear: (gear: GearProfileId) => void;
  setMetronome: (patch: Partial<Preferences["metronome"]>) => void;
  setMidi: (patch: Partial<Preferences["midi"]>) => void;
};

export const DEFAULT_MIDI: Preferences["midi"] = { next: null, prev: null, output: null, channel: 1 };
export function sanitizeMidi(m: Partial<Preferences["midi"]> | undefined): Preferences["midi"] {
  return {
    next: isMidiSignature(m?.next) ? m.next : null,
    prev: isMidiSignature(m?.prev) ? m.prev : null,
    output: typeof m?.output === "string" && m.output.length <= 200 ? m.output : null,
    channel: Math.round(clamp(m?.channel, 1, 16, 1)),
  };
}

export const DEFAULT_METRONOME = { bpm: 80, beats: 4, volume: 0.5 };

const clamp = (v: unknown, lo: number, hi: number, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback);

/** localStorage is user-editable: never trust what comes back. */
export function sanitizeMetronome(m: Partial<Preferences["metronome"]> | undefined): Preferences["metronome"] {
  return {
    bpm: Math.round(clamp(m?.bpm, MIN_BPM, MAX_BPM, DEFAULT_METRONOME.bpm)),
    beats: Math.round(clamp(m?.beats, 2, 7, DEFAULT_METRONOME.beats)),
    volume: clamp(m?.volume, 0, 1, DEFAULT_METRONOME.volume),
  };
}

export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({
      scene3d: "auto",
      metronome: DEFAULT_METRONOME,
      gear: "amp-3band",
      midi: DEFAULT_MIDI,
      setScene3d: (scene3d) => set({ scene3d }),
      setGear: (gear) => set({ gear }),
      setMetronome: (patch) => set((s) => ({ metronome: sanitizeMetronome({ ...s.metronome, ...patch }) })),
      setMidi: (patch) => set((s) => ({ midi: sanitizeMidi({ ...s.midi, ...patch }) })),
    }),
    {
      name: "resoniq:preferences",
      version: 1,
      // Only kept in this browser if the visitor allowed on-device preferences (lib/consent.ts).
      storage: createJSONStorage(() => deviceStorage),
      partialize: ({ scene3d, metronome, gear, midi }) => ({ scene3d, metronome, gear, midi }),
      merge: (stored, current) => {
        const s = (stored ?? {}) as Partial<Preferences>;
        return { ...current, scene3d: s.scene3d === "off" || s.scene3d === "on" ? s.scene3d : "auto", metronome: sanitizeMetronome(s.metronome), gear: isGearProfile(s.gear) ? s.gear : "amp-3band", midi: sanitizeMidi(s.midi) };
      },
      // The server renders defaults; stored values load after hydration so markup always matches.
      skipHydration: true,
    },
  ),
);

/** Call in any client component that reads preferences. Safe to call from many. */
export function usePreferencesHydration() {
  useEffect(() => {
    if (!usePreferences.persist.hasHydrated()) void usePreferences.persist.rehydrate();
  }, []);
}
