import { createStore } from "zustand/vanilla";
import type { StudioPatch } from "@/lib/studio/patch";
import { constrainToDevice, type StudioDevice } from "@/lib/studio/devices";

export type StudioView = "amp" | "cab" | "fx";
export type Slot = "A" | "B";

export type StudioState = {
  /** The patch everything renders and plays: the active compare slot. */
  patch: StudioPatch;
  slots: Record<Slot, StudioPatch | null>;
  active: Slot;
  /** What's stored on the server (or the starting point); `dirty` compares against it. */
  saved: StudioPatch;
  device: StudioDevice | null;
  past: StudioPatch[];
  future: StudioPatch[];
  /** The inactive slot's undo history, restored when switching back. */
  parked: { past: StudioPatch[]; future: StudioPatch[] };
  view: StudioView;
  lastEdit: { key: string; at: number } | null;
  edit: (key: string, change: (p: StudioPatch) => StudioPatch) => void;
  load: (patch: StudioPatch) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  markSaved: (patch: StudioPatch) => void;
  setView: (v: StudioView) => void;
  switchSlot: (s: Slot) => void;
  copyToOther: () => void;
};

export type StudioStore = ReturnType<typeof createStudioStore>;

const HISTORY = 100;
// Edits to the same control within this window are one undo step (a knob drag, a held arrow key).
const COALESCE_MS = 700;

export const isDirty = (s: Pick<StudioState, "patch" | "saved">) => JSON.stringify(s.patch) !== JSON.stringify(s.saved);

export function createStudioStore(initial: StudioPatch, device: StudioDevice | null = null, now = () => Date.now()) {
  const fit = (p: StudioPatch) => (device ? constrainToDevice(p, device) : p);
  const start = fit(structuredClone(initial));
  return createStore<StudioState>()((set, get) => {
    // Every change to the active patch goes through here, so slots and history never disagree.
    const commit = (next: StudioPatch, key: string | null) => {
      const s = get();
      if (JSON.stringify(next) === JSON.stringify(s.patch)) return;
      const t = now();
      const coalesce = key !== null && s.lastEdit?.key === key && t - s.lastEdit.at < COALESCE_MS;
      set({
        patch: next,
        slots: { ...s.slots, [s.active]: next },
        past: coalesce ? s.past : [...s.past, s.patch].slice(-HISTORY),
        future: [],
        lastEdit: key ? { key, at: t } : null,
      });
    };
    return {
      patch: start,
      slots: { A: start, B: null },
      active: "A",
      saved: start,
      device,
      past: [],
      future: [],
      parked: { past: [], future: [] },
      view: "amp",
      lastEdit: null,
      edit: (key, change) => commit(fit(change(structuredClone(get().patch))), key),
      load: (patch) => commit(fit(structuredClone(patch)), null),
      undo: () => {
        const s = get();
        const prev = s.past.at(-1);
        if (!prev) return;
        set({ patch: prev, slots: { ...s.slots, [s.active]: prev }, past: s.past.slice(0, -1), future: [s.patch, ...s.future], lastEdit: null });
      },
      redo: () => {
        const s = get();
        const next = s.future[0];
        if (!next) return;
        set({ patch: next, slots: { ...s.slots, [s.active]: next }, past: [...s.past, s.patch], future: s.future.slice(1), lastEdit: null });
      },
      reset: () => commit(get().saved, null),
      markSaved: (patch) => set({ saved: patch }),
      setView: (view) => set({ view }),
      // B starts as a copy of A the first time it's opened. Each slot keeps its own undo history.
      switchSlot: (slot) => {
        const s = get();
        if (slot === s.active) return;
        const target = s.slots[slot] ?? s.patch;
        set({ active: slot, patch: target, slots: { ...s.slots, [slot]: target }, past: s.parked.past, future: s.parked.future, parked: { past: s.past, future: s.future }, lastEdit: null });
      },
      copyToOther: () => {
        const s = get();
        set({ slots: { ...s.slots, [s.active === "A" ? "B" : "A"]: s.patch } });
      },
    };
  });
}
