import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { RigSound } from "@/lib/stores/rig-store";
import { clampKnob, createRigStore, isDirty } from "@/lib/stores/rig-store";
import { markAllReadOptimistic, notificationKeys } from "@/lib/queries/notifications";
import { decideScene3d } from "@/components/three/webgl";
import { MAX_BPM, MIN_BPM } from "@/lib/practice";

const sound = (): RigSound => ({
  amp: { family: "Plexi", model: "Plexi 50", gain: 60, bass: 50, mids: 70, treble: 55, presence: 40 },
  cabinet: { type: "4x12", speaker: "Greenback" },
  pickup: "Bridge",
  pedalboard: [{ slot: 1, name: "Tube Screamer", type: "drive", enabled: true }],
});

describe("rig store", () => {
  it("clamps knob values to 0–100 integers and rejects junk", () => {
    expect(clampKnob(-5)).toBe(0);
    expect(clampKnob(140)).toBe(100);
    expect(clampKnob(42.6)).toBe(43);
    expect(clampKnob(Number.NaN)).toBe(0);
  });

  it("keeps state identity when a knob is set to its current value (no re-render)", () => {
    const store = createRigStore(sound());
    const before = store.getState();
    store.getState().setKnob("gain", 60);
    expect(store.getState()).toBe(before);
    store.getState().setKnob("gain", 61);
    expect(store.getState().amp.gain).toBe(61);
    expect(store.getState().amp.bass).toBe(50);
  });

  it("clamps whole-amp writes from any view", () => {
    const store = createRigStore(sound());
    store.getState().setAmp({ ...sound().amp, gain: 400, treble: -3 });
    expect(store.getState().amp).toMatchObject({ gain: 100, treble: 0, family: "Plexi" });
  });

  it("tracks edits against its baseline and resets to it", () => {
    const store = createRigStore(sound());
    expect(isDirty(store.getState())).toBe(false);
    store.getState().setPickup("Neck");
    store.getState().setPedalboard([]);
    expect(isDirty(store.getState())).toBe(true);
    store.getState().reset();
    expect(store.getState().pickup).toBe("Bridge");
    expect(store.getState().pedalboard).toHaveLength(1);
    expect(isDirty(store.getState())).toBe(false);
  });

  it("isolates stores from each other and from the object they were created from", () => {
    const initial = sound();
    const a = createRigStore(initial);
    const b = createRigStore(initial);
    a.getState().setKnob("gain", 5);
    initial.amp.bass = 1;
    expect(b.getState().amp.gain).toBe(60);
    expect(a.getState().baseline.amp.bass).toBe(50);
    a.getState().reset();
    a.getState().setKnob("mids", 1);
    expect(a.getState().baseline.amp.mids).toBe(70);
  });
});

describe("device preferences", () => {
  let memory: Map<string, string>;
  beforeEach(() => {
    vi.resetModules();
    memory = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => void memory.set(k, v),
      removeItem: (k: string) => void memory.delete(k),
    });
  });

  it("renders defaults until hydrated, then sanitizes whatever was stored", async () => {
    memory.set("resoniq:preferences", JSON.stringify({ state: { scene3d: "<script>", metronome: { bpm: 9999, beats: 0, volume: "loud" } }, version: 1 }));
    const { usePreferences } = await import("@/lib/stores/preferences");
    expect(usePreferences.getState().metronome.bpm).toBe(80);
    await usePreferences.persist.rehydrate();
    expect(usePreferences.getState().scene3d).toBe("auto");
    expect(usePreferences.getState().metronome).toEqual({ bpm: MAX_BPM, beats: 2, volume: 0.5 });
  });

  it("persists only preferences, clamped, never the actions", async () => {
    const { usePreferences } = await import("@/lib/stores/preferences");
    await usePreferences.persist.rehydrate();
    usePreferences.getState().setMetronome({ bpm: 1 });
    usePreferences.getState().setScene3d("off");
    const saved = JSON.parse(memory.get("resoniq:preferences")!);
    expect(saved.state).toEqual({ scene3d: "off", metronome: { bpm: MIN_BPM, beats: 4, volume: 0.5 }, gear: "amp-3band" });
  });
});

describe("notification cache", () => {
  it("zeroes the unread badge immediately and keeps it when the server agrees", async () => {
    const client = new QueryClient();
    client.setQueryData(notificationKeys.unread("u1"), 7);
    let seenDuringRequest: number | undefined;
    await markAllReadOptimistic(client, "u1", async () => {
      seenDuringRequest = client.getQueryData(notificationKeys.unread("u1"));
    });
    expect(seenDuringRequest).toBe(0);
    expect(client.getQueryData(notificationKeys.unread("u1"))).toBe(0);
  });

  it("restores the badge if marking read fails", async () => {
    const client = new QueryClient();
    client.setQueryData(notificationKeys.unread("u1"), 3);
    await expect(markAllReadOptimistic(client, "u1", () => Promise.reject(new Error("offline")))).rejects.toThrow("offline");
    expect(client.getQueryData(notificationKeys.unread("u1"))).toBe(3);
  });

  it("never shares a cached count between accounts", async () => {
    const client = new QueryClient();
    client.setQueryData(notificationKeys.unread("u1"), 3);
    client.setQueryData(notificationKeys.unread("u2"), 9);
    await markAllReadOptimistic(client, "u1", async () => {});
    expect(client.getQueryData(notificationKeys.unread("u2"))).toBe(9);
  });
});

describe("3D fallback", () => {
  it("never renders without WebGL, and respects the device preference", () => {
    expect(decideScene3d("auto", false)).toBe("unsupported");
    expect(decideScene3d("off", false)).toBe("unsupported");
    expect(decideScene3d("off", true)).toBe("hidden");
    expect(decideScene3d("auto", true)).toBe("render");
  });
});
