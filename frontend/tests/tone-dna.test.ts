import { describe, expect, it } from "vitest";
import { dnaDifferences, dnaFromPatch, dnaMatch, measuredCharacter } from "@/lib/tone-dna";
import { FACTORY_PRESETS, defaultPatch, newEffect, type StudioPatch } from "@/lib/studio/patch";
import type { EngineAnalysis } from "@/types/engine";

const preset = (id: string) => FACTORY_PRESETS.find((f) => f.id === id)!.patch;
const withFx = (p: StudioPatch, ...fx: ReturnType<typeof newEffect>[]): StudioPatch => ({ ...p, effects: fx });

describe("Tone DNA", () => {
  it("stays on the 0–1 scale for every factory preset", () => {
    for (const f of FACTORY_PRESETS) for (const v of Object.values(dnaFromPatch(f.patch))) expect(v >= 0 && v <= 1).toBe(true);
  });

  it("moves each axis with the controls that drive it", () => {
    const base = defaultPatch("halcyon");
    const dna = dnaFromPatch(base);
    expect(dnaFromPatch(preset("foundry-djent")).drive).toBeGreaterThan(dnaFromPatch(preset("lumen-glass")).drive + 0.4);
    expect(dnaFromPatch({ ...base, amp: { ...base.amp, bass: 9 } }).low).toBeGreaterThan(dna.low);
    expect(dnaFromPatch({ ...base, amp: { ...base.amp, mid: 1 } }).mid).toBeLessThan(dna.mid);
    expect(dnaFromPatch({ ...base, amp: { ...base.amp, treble: 9 } }).bright).toBeGreaterThan(dna.bright);
    expect(dnaFromPatch({ ...base, cab: { ...base.cab, mic: "ribbon" } }).bright).toBeLessThan(dna.bright);
    expect(dnaFromPatch(withFx(base, newEffect("reverb"))).space).toBeGreaterThan(dna.space);
    expect(dnaFromPatch(withFx(base, newEffect("chorus"))).motion).toBeGreaterThan(dna.motion);
    expect(dnaFromPatch(withFx(base, newEffect("compressor"))).squeeze).toBeGreaterThan(dna.squeeze);
    expect(dnaFromPatch(withFx(base, newEffect("fuzz"))).drive).toBeGreaterThan(dna.drive);
    // A bypassed pedal changes nothing.
    expect(dnaFromPatch(withFx(base, { ...newEffect("reverb"), on: false }))).toEqual(dna);
  });

  it("matches a sound to itself at 100% and ranks near sounds above far ones", () => {
    const a = dnaFromPatch(preset("basalt-rhythm"));
    expect(dnaMatch(a, a)).toBe(100);
    const near = dnaMatch(a, dnaFromPatch(preset("foundry-djent")));
    const far = dnaMatch(a, dnaFromPatch(preset("lumen-glass")));
    expect(near).toBeGreaterThan(far);
    expect(dnaDifferences(a, dnaFromPatch(preset("lumen-glass")))).toContain("less drive");
  });

  it("reads measured character only from a real analysis", () => {
    expect(measuredCharacter(null)).toBeNull();
    expect(measuredCharacter({ sections: [] } as unknown as EngineAnalysis)).toBeNull();
    const c = { rms_db: -14, centroid_hz: 2210.4, low_db: -20, mid_db: -18, high_db: -30, flatness_db: -25 };
    expect(measuredCharacter({ main_section: "b", sections: [{ id: "a", character: { ...c, centroid_hz: 1 } }, { id: "b", character: c }] } as unknown as EngineAnalysis)).toEqual({ centroidHz: 2210, lowDb: -20, midDb: -18, highDb: -30, rmsDb: -14 });
  });
});
