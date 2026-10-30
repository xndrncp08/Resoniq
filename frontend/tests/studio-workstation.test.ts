import { describe, expect, it } from "vitest";
import {
  AMP_DESIGNS, AMP_MODELS, CAB_MODELS, EFFECT_DESIGNS, EFFECT_TYPES, FACTORY_PRESETS, MICS, RIG_SLOT, SPEAKERS, arrangeEffects, chainOrder, defaultPatch, newEffect,
  normalizeStudioPatch, nudgeEffect, parseStudioPatch, presetFile, readPresetFile, withAmpModel, type StudioPatch,
} from "@/lib/studio/patch";
import { CAB_VOICINGS, SPEAKER_VOICINGS, VOICINGS, gatePedalDb, micFilters, reverbImpulse, shaperCurve, stageDrives } from "@/lib/studio/dsp";
import { AMP_LOOKS, CAB_LOOKS } from "@/components/studio/looks";
import { constrainToDevice, TANK_G_STUDIO } from "@/lib/studio/devices";
import { createStudioStore } from "@/lib/stores/studio-store";
import { describeEdit } from "@/lib/studio/readout";
import { effectFromName, modelFor } from "@/lib/studio/from-tone";

const ids = (p: StudioPatch) => p.effects.map((e) => `${e.id}:${e.placement}`);

describe("amp library", () => {
  it("has a voicing, a look and a panel for every amp, across every character", () => {
    expect(AMP_MODELS.length).toBeGreaterThanOrEqual(10);
    for (const m of AMP_MODELS) {
      expect(VOICINGS[m], m).toBeDefined();
      expect(AMP_LOOKS[m], m).toBeDefined();
      expect(AMP_DESIGNS[m].knobs.length, m).toBeGreaterThanOrEqual(4);
    }
    expect(new Set(AMP_MODELS.map((m) => AMP_DESIGNS[m].character))).toEqual(new Set(["clean", "crunch", "vintage", "boutique", "high-gain", "modern", "experimental"]));
  });

  it("orders the amps from clean to high gain by how hard they drive", () => {
    const top = (m: (typeof AMP_MODELS)[number]) => stageDrives(VOICINGS[m], 10)[0];
    expect(top("lumen")).toBeLessThan(top("halcyon"));
    expect(top("atlas")).toBeLessThan(top("juniper"));
    expect(top("halcyon")).toBeLessThan(top("basalt"));
    expect(top("basalt")).toBeLessThan(top("foundry"));
  });

  it("resets the knobs and switches a new amp doesn't have, so nothing hidden shapes the sound", () => {
    const loud = { ...defaultPatch("basalt"), amp: { ...defaultPatch("basalt").amp, presence: 9, depth: 8, mid: 2, tight: true } };
    const p = withAmpModel(loud, "juniper");
    expect(p.amp).toMatchObject({ model: "juniper", presence: 5, depth: 5, mid: 5, tight: false, bright: false });
    // What the new panel shows is kept.
    expect(withAmpModel({ ...loud, amp: { ...loud.amp, gain: 8 } }, "juniper").amp.gain).toBe(8);
  });

  it("voices tone names to the matching designs", () => {
    expect(modelFor("Fender Tweed Deluxe", 5)).toBe("juniper");
    expect(modelFor("Vox AC30 Top Boost", 5)).toBe("bellwether");
    expect(modelFor("Mesa Mark IV", 8)).toBe("foundry");
    expect(modelFor("Dumble ODS", 5)).toBe("monarch");
    expect(modelFor("Roland JC-120", 1)).toBe("atlas");
    expect(modelFor("Marshall Plexi", 7)).toBe("halcyon");
  });
});

describe("effects library", () => {
  it("covers every effect the studio promises, each with defaults on the panel scale", () => {
    for (const t of ["overdrive", "distortion", "fuzz", "delay", "reverb", "chorus", "compressor", "eq", "gate", "phaser", "flanger", "tremolo", "boost", "wah"]) expect(EFFECT_TYPES).toContain(t);
    for (const t of EFFECT_TYPES) {
      const e = newEffect(t);
      expect(e.placement).toBe(EFFECT_DESIGNS[t].placement);
      for (const v of Object.values(e.params)) expect(v >= 0 && v <= 10).toBe(true);
      expect(() => parseStudioPatch({ ...defaultPatch(), effects: [e] })).not.toThrow();
    }
  });

  it("maps pedal names and rig blocks to the right effects", () => {
    expect(effectFromName("Big Muff", "drive")).toBe("fuzz");
    expect(effectFromName("ProCo RAT", "drive")).toBe("distortion");
    expect(effectFromName("Cry Baby", "filter")).toBe("wah");
    expect(effectFromName("MXR Flanger", "modulation")).toBe("flanger");
    expect(effectFromName("Noise Suppressor", "dynamics")).toBe("gate");
    expect(effectFromName("Tube Screamer", "drive")).toBe("overdrive");
  });
});

describe("signal chain order", () => {
  const board = (): StudioPatch => ({ ...defaultPatch(), effects: [newEffect("compressor", "c"), newEffect("overdrive", "o"), newEffect("delay", "d"), newEffect("reverb", "r")] });

  it("reads the chain as pre pedals, the rig, then post pedals", () => {
    expect(chainOrder(board().effects)).toEqual(["c", "o", RIG_SLOT, "d", "r"]);
  });

  it("moves a pedal across the amp when it's dropped on the other side", () => {
    const p = board();
    expect(ids({ ...p, effects: arrangeEffects(p.effects, ["c", RIG_SLOT, "d", "o", "r"]) })).toEqual(["c:pre", "d:post", "o:post", "r:post"]);
    expect(ids({ ...p, effects: arrangeEffects(p.effects, ["r", "c", "o", RIG_SLOT, "d"]) })).toEqual(["r:pre", "c:pre", "o:pre", "d:post"]);
    // Unknown ids are ignored and missing ones keep their side.
    expect(ids({ ...p, effects: arrangeEffects(p.effects, ["ghost", "o", RIG_SLOT, "r"]) })).toEqual(["o:pre", "c:pre", "r:post", "d:post"]);
  });

  it("nudges a step at a time, crossing the amp, and stops at the ends", () => {
    let fx = board().effects;
    fx = nudgeEffect(fx, "o", 1);
    expect(chainOrder(fx)).toEqual(["c", RIG_SLOT, "o", "d", "r"]);
    expect(fx.find((e) => e.id === "o")?.placement).toBe("post");
    expect(nudgeEffect(fx, "c", -1)).toBe(fx);
    expect(nudgeEffect(fx, "r", 1)).toBe(fx);
  });

  it("stores the placement, validates it, and reads older saves (no placement) the way they always sounded", () => {
    const moved = { ...board(), effects: arrangeEffects(board().effects, ["d", RIG_SLOT, "c", "o", "r"]) };
    expect(ids(parseStudioPatch(JSON.parse(JSON.stringify(moved))))).toEqual(["d:pre", "c:post", "o:post", "r:post"]);
    expect(() => parseStudioPatch({ ...moved, effects: [{ ...moved.effects[0], placement: "sideways" }] })).toThrow(/placement/);
    const legacy = { v: 1, amp: { model: "halcyon" }, effects: [{ id: "a", type: "reverb", on: true, params: {} }, { id: "b", type: "overdrive", on: true, params: {} }] };
    expect(ids(normalizeStudioPatch(legacy))).toEqual(["b:pre", "a:post"]);
    const strictLegacy = { ...defaultPatch(), cab: { model: "4x12-closed", on: true, micPosition: 3, micDistance: 2 }, effects: [{ id: "a", type: "delay", on: true, voice: "Tape", params: { time: 4, feedback: 3, mix: 3 } }] };
    const parsed = parseStudioPatch(strictLegacy);
    expect(parsed.cab).toMatchObject({ speaker: "stock", mic: "dynamic" });
    expect(parsed.effects[0].placement).toBe("post");
  });

  it("keeps device presets in the hardware's fixed order", () => {
    const p = constrainToDevice({ ...defaultPatch(), cab: { ...defaultPatch().cab, speaker: "neo-100", mic: "ribbon" }, effects: [newEffect("reverb", "r", "pre"), newEffect("delay", "d", "pre")] }, TANK_G_STUDIO);
    expect(ids(p)).toEqual(["d:post", "r:post"]);
    expect(p.cab).toMatchObject({ speaker: "stock", mic: "dynamic" });
  });
});

describe("cabinets", () => {
  it("has a voicing and a look for every cabinet, and stock speakers change nothing", () => {
    for (const c of CAB_MODELS) {
      expect(CAB_VOICINGS[c], c).toBeDefined();
      expect(CAB_LOOKS[c], c).toBeDefined();
    }
    expect(SPEAKER_VOICINGS.stock).toMatchObject({ peakDb: 0, lowDb: 0, lowpassScale: 1 });
    for (const s of SPEAKERS) expect(SPEAKER_VOICINGS[s], s).toBeDefined();
  });

  it("keeps the dynamic mic exactly as the old cabinet sounded, and voices the others", () => {
    expect(micFilters(3, 2)).toEqual(micFilters(3, 2, "dynamic"));
    expect(micFilters(3, 2, "ribbon").lowpassScale).toBeLessThan(micFilters(3, 2).lowpassScale);
    expect(micFilters(3, 2, "ribbon").proximityDb).toBeGreaterThan(micFilters(3, 2).proximityDb);
    expect(micFilters(3, 2, "condenser").lowpassScale).toBeGreaterThan(micFilters(3, 2).lowpassScale);
    // Edge darker than centre, far less bass than close, for every mic.
    for (const m of MICS) {
      expect(micFilters(10, 2, m).lowpassScale).toBeLessThan(micFilters(0, 2, m).lowpassScale);
      expect(micFilters(3, 10, m).proximityDb).toBeLessThan(micFilters(3, 0, m).proximityDb);
    }
  });

  it("names speaker and mic edits in the readout", () => {
    const p = { ...defaultPatch(), cab: { ...defaultPatch().cab, speaker: "alnico-15" as const, mic: "ribbon" as const } };
    expect(describeEdit("cab.speaker", p)).toBe("SPEAKER ALNICO 15 W");
    expect(describeEdit("cab.mic", p)).toBe("RIBBON MIC");
  });
});

describe("pedal DSP math", () => {
  it("maps the gate pedal threshold onto dBFS", () => {
    expect([gatePedalDb(0), gatePedalDb(4), gatePedalDb(10), gatePedalDb(42)]).toEqual([-80, -60, -30, -30]);
  });

  it("builds bounded, monotonic curves for the distortion and fuzz pedals at any setting", () => {
    for (const [curve, drive] of [["hard", 250], ["fuzz", 400], ["hard", 2], ["fuzz", 3]] as const) {
      const c = shaperCurve(curve, drive);
      expect(Math.max(...c.map(Math.abs))).toBeLessThanOrEqual(1.0001);
      for (let i = 1; i < c.length; i++) expect(c[i]).toBeGreaterThanOrEqual(c[i - 1] - 1e-9);
    }
  });

  it("generates finite, decaying tails for the new reverb voices; Hall starts after a pre-delay", () => {
    for (const voice of EFFECT_DESIGNS.reverb.voices!) {
      const [l, r] = reverbImpulse(voice, 1.2, 22050);
      expect(l.every(Number.isFinite) && r.every(Number.isFinite)).toBe(true);
      expect(Math.abs(l.at(-1)!)).toBeLessThan(0.01);
    }
    const [hall] = reverbImpulse("Hall", 1.2, 22050);
    expect(hall.slice(0, 400).every((v) => v === 0)).toBe(true);
  });
});

describe("factory presets", () => {
  it("cover every amp, validate, and use only real effects", () => {
    expect(new Set(FACTORY_PRESETS.map((f) => f.patch.amp.model))).toEqual(new Set(AMP_MODELS));
    for (const f of FACTORY_PRESETS) expect(parseStudioPatch(JSON.parse(JSON.stringify(f.patch))), f.id).toEqual(f.patch);
    expect(new Set(FACTORY_PRESETS.map((f) => f.id)).size).toBe(FACTORY_PRESETS.length);
  });
});

describe("preset files", () => {
  it("round-trips a sound through export and import", () => {
    const patch = { ...FACTORY_PRESETS[9].patch };
    const back = readPresetFile(presetFile("Low chug", patch));
    expect(back.name).toBe("Low chug");
    expect(back.patch).toEqual(normalizeStudioPatch(patch));
  });

  it("drops the hardware link and repairs anything odd", () => {
    const text = presetFile("x", { ...defaultPatch(), device: { slug: "m-vave-tank-g", ampSlot: 3 } });
    expect(JSON.parse(text).patch.device).toBeUndefined();
    const odd = readPresetFile(JSON.stringify({ amp: { model: "foundry", gain: "8" }, effects: [{ id: "x", type: "fuzz", on: true, params: { drive: 99 } }] }));
    expect(odd.patch.amp).toMatchObject({ model: "foundry", gain: 8 });
    expect(odd.patch.effects[0].params.drive).toBe(10);
    expect(odd.name).toBeNull();
  });

  it("refuses files that aren't presets with a readable reason", () => {
    expect(() => readPresetFile("not json")).toThrow(/valid JSON/);
    expect(() => readPresetFile(JSON.stringify({ hello: "world" }))).toThrow(/studio preset/);
    expect(() => readPresetFile(JSON.stringify([1, 2]))).toThrow(/studio preset/);
    expect(() => readPresetFile(" ".repeat(300 * 1024))).toThrow(/too large/);
  });
});

describe("studio store selection", () => {
  it("opens the first pedal when switching to pedals, and a chosen one directly", () => {
    const store = createStudioStore({ ...defaultPatch(), effects: [newEffect("overdrive", "o"), newEffect("delay", "d")] });
    store.getState().setView("fx");
    expect(store.getState().selectedFx).toBe("o");
    store.getState().selectFx("d");
    expect(store.getState()).toMatchObject({ view: "fx", selectedFx: "d" });
    store.getState().setView("amp");
    store.getState().setView("fx");
    expect(store.getState().selectedFx).toBe("d");
  });

  it("makes a drag across the amp one undo step", () => {
    let t = 0;
    const store = createStudioStore({ ...defaultPatch(), effects: [newEffect("overdrive", "o"), newEffect("delay", "d")] }, null, () => (t += 1000));
    store.getState().edit("fx.order", (p) => ({ ...p, effects: arrangeEffects(p.effects, [RIG_SLOT, "d", "o"]) }));
    expect(ids(store.getState().patch)).toEqual(["d:post", "o:post"]);
    store.getState().undo();
    expect(ids(store.getState().patch)).toEqual(["o:pre", "d:post"]);
  });
});

describe("output ceiling", () => {
  it("is exactly linear below the knee, smooth and monotonic above it, and never exceeds −0.3 dBFS", async () => {
    const { ceilingCurve } = await import("@/lib/studio/dsp");
    const c = ceilingCurve();
    const at = (x: number) => c[Math.round(((x + 1) / 2) * (c.length - 1))];
    for (const x of [-0.82, -0.5, 0, 0.25, 0.5, 0.82]) expect(at(x)).toBeCloseTo(x, 3);
    expect(Math.max(...c.map(Math.abs))).toBeLessThanOrEqual(0.93);
    expect(20 * Math.log10(Math.max(...c.map(Math.abs)))).toBeLessThanOrEqual(-0.6);
    for (let i = 1; i < c.length; i++) expect(c[i]).toBeGreaterThan(c[i - 1] - 1e-9);
  });
});
