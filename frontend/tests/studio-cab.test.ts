import { describe, expect, it } from "vitest";
import { AMP_KNOBS, AMP_MODELS, AMP_SWITCHES, CAB_DESIGNS, CAB_MODELS, EFFECT_DESIGNS, EFFECT_TYPES, defaultPatch, newEffect, normalizeStudioPatch, parseStudioPatch, type StudioPatch } from "@/lib/studio/patch";
import { describeEdit } from "@/lib/studio/readout";
import { createStudioStore } from "@/lib/stores/studio-store";
import { patchFromTone } from "@/lib/studio/from-tone";
import { studioPatchFromStored } from "@/lib/tone-recipe";

// Regression: switching cabinets showed "t.cab[s].toFixed is not a function" because the
// readout treated every cab.* edit (including the model name and the on switch) as a number.
describe("switching cabinets", () => {
  it("never crashes, for every cabinet, from every amp, with the cab on or off", () => {
    for (const amp of AMP_MODELS) {
      let t = 0;
      // A second between edits, so each is its own undo step.
      const store = createStudioStore(defaultPatch(amp), null, () => (t += 1000));
      for (const model of CAB_MODELS) {
        store.getState().edit("cab.model", (p) => ({ ...p, cab: { ...p.cab, model } }));
        const s = store.getState();
        expect(s.patch.cab.model).toBe(model);
        expect(s.slots[s.active]?.cab.model).toBe(model);
        expect(describeEdit("cab.model", s.patch)).toBe(CAB_DESIGNS[model].name.toUpperCase());
        for (const on of [false, true]) {
          store.getState().edit("cab.on", (p) => ({ ...p, cab: { ...p.cab, on } }));
          expect(describeEdit("cab.on", store.getState().patch)).toBe(`CABINET ${on ? "ON" : "OFF"}`);
        }
      }
      // Earlier settings survive the switches, and undo walks back through them.
      expect(store.getState().patch.amp.model).toBe(amp);
      store.getState().undo();
      expect(store.getState().patch.cab.on).toBe(false);
    }
  });

  it("describes every kind of edit the studio makes", () => {
    const p: StudioPatch = { ...defaultPatch("basalt"), effects: EFFECT_TYPES.map((t) => newEffect(t, `e-${t}`)) };
    expect(describeEdit("amp.model", p)).toBe("BASALT 120");
    for (const k of AMP_KNOBS) expect(describeEdit(`amp.${k}`, p)).toBe(`${k.toUpperCase()} 5.0`);
    for (const k of AMP_SWITCHES) expect(describeEdit(`amp.${k}`, p)).toBe(`${k.toUpperCase()} OFF`);
    expect(describeEdit("cab.micPosition", p)).toBe("MIC POSITION 3.0");
    expect(describeEdit("cab.micDistance", p)).toBe("MIC DISTANCE 2.0");
    for (const t of EFFECT_TYPES) {
      const d = EFFECT_DESIGNS[t];
      expect(describeEdit(`fx.e-${t}.on`, p)).toBe(`${d.name.toUpperCase()} ON`);
      for (const s of d.params) expect(describeEdit(`fx.e-${t}.${s.key}`, p)).toBe(`${s.key.toUpperCase()} ${s.default.toFixed(1)}`);
      if (d.voices) expect(describeEdit(`fx.e-${t}.voice`, p)).toBe(`${d.name.toUpperCase()} ${d.voices[0].toUpperCase()}`);
    }
    for (const key of ["fx.add", "fx.remove", "fx.order", "cab.unknown", "amp.unknown", "gate.on", "", "fx.e-delay.missing"]) expect(describeEdit(key, p)).toBeNull();
  });
});

describe("reading stored and legacy patches", () => {
  const legacy = {
    v: 1, input: "2", output: null, gate: { on: "true", threshold: "-60" },
    amp: { model: "basalt", gain: "7.5", bass: 6, mid: "x", treble: 99, bright: 1 },
    cab: { model: "2x12-open", on: "false", micPosition: "4", micDistance: undefined },
    effects: [{ id: "d1", type: "delay", on: true, voice: "Nope", params: { time: "6", mix: "lots" } }, { id: "x", type: "fuzz-from-the-future" }, "junk"],
  };

  it("repairs strings, missing values, bad models and unknown effects into a valid patch", () => {
    const p = normalizeStudioPatch(legacy);
    expect(() => parseStudioPatch(p)).not.toThrow();
    expect(p.amp).toMatchObject({ model: "basalt", gain: 7.5, bass: 6, mid: 5, treble: 10, bright: true });
    expect(p.cab).toEqual({ model: "2x12-open", on: false, micPosition: 4, micDistance: 2, speaker: "stock", mic: "dynamic" });
    expect(p.gate).toEqual({ on: true, threshold: -60 });
    expect(p.input).toBe(2);
    expect(p.effects).toHaveLength(1);
    expect(p.effects[0]).toMatchObject({ type: "delay", voice: "Analog", params: { time: 6, feedback: 3, mix: 3 } });
  });

  it("handles every cabinet, unknown cabinets and completely broken data", () => {
    for (const model of CAB_MODELS) expect(normalizeStudioPatch({ cab: { model } }).cab.model).toBe(model);
    expect(normalizeStudioPatch({ cab: { model: "8x10-fridge" } }).cab.model).toBe("4x12-closed");
    for (const junk of [null, undefined, 42, "patch", [], { amp: "x", cab: [] }]) expect(() => parseStudioPatch(normalizeStudioPatch(junk))).not.toThrow();
  });

  it("leaves valid patches exactly as they were", () => {
    const valid = { ...defaultPatch("lumen"), cab: { model: "1x12-open" as const, on: true, micPosition: 7.5, micDistance: 1, speaker: "alnico-15" as const, mic: "ribbon" as const }, effects: [newEffect("reverb", "r1"), newEffect("fuzz", "f1", "post")] };
    expect(normalizeStudioPatch(valid)).toEqual(valid);
  });

  it("repairs patches on every read path: stored tones, the studio opener and the store", () => {
    expect(studioPatchFromStored({ version: 2, studio: legacy })?.cab.micPosition).toBe(4);
    expect(patchFromTone({ studio: legacy as never, declared: null, inferred: null }).patch.amp.gain).toBe(7.5);
    const store = createStudioStore(legacy as never);
    expect(typeof store.getState().patch.cab.micPosition).toBe("number");
    store.getState().load({ ...defaultPatch(), cab: { model: "1x12-open", on: true, micPosition: "9" } } as never);
    expect(store.getState().patch.cab.micPosition).toBe(9);
  });
});
