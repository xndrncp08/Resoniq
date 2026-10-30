import { describe, expect, it } from "vitest";
import { diffPatches } from "@/lib/tone-diff";
import { defaultPatch, newEffect, withAmpModel, arrangeEffects, RIG_SLOT, type StudioPatch } from "@/lib/studio/patch";

const base = (): StudioPatch => ({ ...defaultPatch("halcyon"), effects: [newEffect("overdrive", "od"), newEffect("delay", "dl")] });

describe("tone diff", () => {
  it("says nothing for identical sounds", () => {
    expect(diffPatches(base(), base())).toEqual([]);
  });

  it("names amp, knob, switch, cabinet and level changes with the panel's labels", () => {
    const b = base();
    const c = { ...withAmpModel(b, "juniper"), input: 3, cab: { ...b.cab, speaker: "alnico-15" as const, mic: "ribbon" as const, micPosition: 6 } };
    c.amp = { ...c.amp, gain: 7.5 };
    expect(diffPatches(b, c)).toEqual(expect.arrayContaining(["Amp: Halcyon 50 → Juniper 5E", "Volume 5.0 → 7.5", "Input 0.0 dB → +3.0 dB", "Speaker: Stock → Alnico 15 W", "Mic: Dynamic → Ribbon", "Mic position 3.0 → 6.0"]));
  });

  it("tracks pedals added, removed, bypassed, retuned, re-voiced and moved", () => {
    const a = base();
    const b: StudioPatch = { ...a, effects: [{ ...a.effects[0], on: false, params: { ...a.effects[0].params, drive: 8 } }, newEffect("reverb", "rv")] };
    expect(diffPatches(a, b)).toEqual(["Ember Drive bypassed", "Ember Drive Drive 4.0 → 8.0", "+ Cathedral", "− Echo Room"]);
    const moved = { ...a, effects: arrangeEffects(a.effects, ["od", "dl", RIG_SLOT]) };
    expect(diffPatches(a, moved)).toEqual(["Echo Room moved before the amp"]);
    const voiced = { ...a, effects: a.effects.map((e) => (e.type === "delay" ? { ...e, voice: "Tape" } : e)) };
    expect(diffPatches(a, voiced)).toEqual(["Echo Room: Analog → Tape"]);
  });

  it("matches pedals by type when an older save's ids changed", () => {
    const a = base();
    const b = { ...a, effects: a.effects.map((e) => ({ ...e, id: `${e.id}-new` })) };
    expect(diffPatches(a, b)).toEqual([]);
  });
});
