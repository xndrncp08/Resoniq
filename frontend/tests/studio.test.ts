import { describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { TANK_G_PRESETS } from "@/lib/tank-g-presets";
import { presetRig } from "@/lib/tone-draft-validation";
import { TANK_G_SLUG, validateTankGRig } from "@/lib/devices/tank-g";
import { GEAR } from "@/prisma/seed-gear";
import { defaultPatch, EFFECT_TYPES, FACTORY_PRESETS, newEffect, parseStudioPatch, type StudioPatch } from "@/lib/studio/patch";
import { constrainToDevice, dbToGate, gateToDb, patchFromTankG, tankGRigFromPatch, TANK_G_STUDIO } from "@/lib/studio/devices";
import { modelFor, patchFromRecipe, patchFromRig, patchFromTone } from "@/lib/studio/from-tone";
import { createStudioStore, isDirty } from "@/lib/stores/studio-store";
import { demoRiff, levelDb, reverbImpulse, shaperCurve, stageDrives, VOICINGS } from "@/lib/studio/dsp";
import { saveBody } from "@/lib/queries/studio";
import { parseStoredToneData } from "@/lib/tone-validation";
import { validRecipe } from "./fixtures";

const slug = (brand: string, model: string) =>
  `${brand} ${model}`.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const catalog = GEAR.map(([, brand, model]) => ({ id: slug(brand, model).slice(0, 40), slug: slug(brand, model), brand, model }));
const tx = { gearItem: { findMany: async () => catalog } } as unknown as Prisma.TransactionClient;
const tankRigs = await Promise.all(TANK_G_PRESETS.map((p) => presetRig(tx, p)));

describe("studio patch validation", () => {
  it("accepts every factory preset and clamps junk at the boundary", () => {
    for (const f of FACTORY_PRESETS) expect(parseStudioPatch(JSON.parse(JSON.stringify(f.patch)))).toEqual(f.patch);
    const p = parseStudioPatch({ ...defaultPatch(), input: 99, amp: { ...defaultPatch().amp, gain: -4, treble: 7.77 } });
    expect([p.input, p.amp.gain, p.amp.treble]).toEqual([24, 0, 7.8]);
  });

  it("rejects unknown models, effects, duplicate ids and oversized chains", () => {
    expect(() => parseStudioPatch({ ...defaultPatch(), amp: { ...defaultPatch().amp, model: "plexi" } })).toThrow(/amp.model/);
    expect(() => parseStudioPatch({ ...defaultPatch(), effects: [{ ...newEffect("delay", "a"), type: "theremin" }] })).toThrow(/type/);
    expect(() => parseStudioPatch({ ...defaultPatch(), effects: [newEffect("delay", "a"), newEffect("reverb", "a")] })).toThrow(/unique/);
    expect(() => parseStudioPatch({ ...defaultPatch(), effects: Array.from({ length: 13 }, (_, i) => newEffect("chorus", `c${i}`)) })).toThrow(/at most/);
  });

  it("puts drive and compression before the amp whatever order arrives", () => {
    const p = parseStudioPatch({ ...defaultPatch(), effects: [newEffect("reverb", "r"), newEffect("overdrive", "o"), newEffect("delay", "d"), newEffect("compressor", "c")] });
    expect(p.effects.map((e) => e.id)).toEqual(["o", "c", "r", "d"]);
  });

  it("stores alongside an analysis recipe without touching it", () => {
    const stored = parseStoredToneData({ version: 2, recipe: validRecipe(), studio: defaultPatch("basalt") });
    expect(stored.studio?.amp.model).toBe("basalt");
    expect(stored.recipe?.amp.model).toBeTruthy();
    expect(() => parseStoredToneData({ version: 2 })).toThrow(/recipe or a studio patch/);
  });
});

describe("hardware presets in the studio (TANK-G)", () => {
  it("round-trips all 121 library presets through the studio and back into a valid device rig", () => {
    expect(tankRigs.length).toBeGreaterThan(100);
    for (const [i, rig] of tankRigs.entries()) {
      const patch = constrainToDevice(patchFromTankG(rig), TANK_G_STUDIO);
      const back = tankGRigFromPatch(patch, rig);
      expect(() => validateTankGRig(back, TANK_G_SLUG), TANK_G_PRESETS[i].key).not.toThrow();
      expect(back.amp?.settings, TANK_G_PRESETS[i].key).toEqual(rig.amp?.settings);
      expect(back.device?.ampSlot).toBe(rig.device?.ampSlot);
      expect(back.chain.map((b) => [b.category, b.params]), TANK_G_PRESETS[i].key).toEqual(rig.chain.filter((b) => b.enabled).map((b) => [b.category, b.params]));
      expect(back.cab?.speakers).toBe(rig.cab?.speakers);
    }
  });

  it("keeps edits inside what the hardware can do, and the result still validates", () => {
    const rig = tankRigs[0];
    let p = constrainToDevice(patchFromTankG(rig), TANK_G_STUDIO);
    p = constrainToDevice({ ...p, amp: { ...p.amp, gain: 9.9, presence: 9, bright: true }, gate: { on: true, threshold: -40 }, effects: [...p.effects, newEffect("overdrive"), newEffect("compressor"), newEffect("reverb"), newEffect("reverb")], device: { slug: TANK_G_SLUG, ampSlot: 7 } }, TANK_G_STUDIO);
    expect(p.effects.some((e) => e.type === "overdrive" || e.type === "compressor")).toBe(false);
    expect(p.effects.filter((e) => e.type === "reverb")).toHaveLength(1);
    expect([p.amp.presence, p.amp.bright, p.amp.model]).toEqual([5, false, "basalt"]);
    const back = tankGRigFromPatch(p, rig);
    expect(() => validateTankGRig(back, TANK_G_SLUG)).not.toThrow();
    expect(back.device?.ampSlot).toBe(7);
    expect(back.chain[0]).toMatchObject({ category: "gate", params: { Threshold: dbToGate(-40) } });
  });

  it("maps the gate's 0–10 threshold onto dB and back", () => {
    for (const t of [0.5, 3, 7.5, 10]) expect(dbToGate(gateToDb(t))).toBe(t);
  });
});

describe("opening sounds in the studio", () => {
  it("chooses device mode, then a saved patch, then the analysis, then the declared rig", () => {
    expect(patchFromTone({ studio: null, declared: tankRigs[3], inferred: null }).from).toBe("device");
    expect(patchFromTone({ studio: defaultPatch("prism"), declared: null, inferred: validRecipe() as never }).from).toBe("studio");
    expect(patchFromTone({ studio: null, declared: null, inferred: validRecipe() as never }).from).toBe("analysis");
    expect(patchFromTone({ studio: null, declared: { chain: [] }, inferred: null }).from).toBe("rig");
  });

  it("translates a recipe's 0–100 knobs and pedal names into studio settings", () => {
    const recipe = { ...validRecipe(), amp: { family: "Marshall", model: "Plexi", gain: 70, bass: 40, mids: 60, treble: 55, presence: 50 }, pedalboard: [{ slot: 1, name: "Spring reverb", type: "time", enabled: true }, { slot: 2, name: "Tube Screamer", type: "drive", enabled: false, drive: 30 }] };
    const p = patchFromRecipe(recipe as never);
    expect(p.amp).toMatchObject({ model: "halcyon", gain: 7, bass: 4, mid: 6 });
    expect(p.effects.map((e) => [e.type, e.on, e.voice ?? null])).toEqual([["overdrive", false, null], ["reverb", true, "Spring"]]);
    expect(p.effects[0].params.drive).toBe(3);
  });

  it("reads loosely named knobs from a declared rig", () => {
    const p = patchFromRig({ amp: { settings: { Gain: 8, Middle: 3, Volume: 6 } }, chain: [{ id: "x", category: "delay", enabled: true, placement: "loop", params: { Time: 7, Repeats: 5 } }] });
    expect(p.amp).toMatchObject({ gain: 8, mid: 3, master: 6 });
    expect(p.effects[0]).toMatchObject({ type: "delay", params: { time: 7, feedback: 5 } });
  });

  it("voices amps by family or gain, never claiming the original", () => {
    expect(modelFor("EVH 5150", 5)).toBe("basalt");
    expect(modelFor("Fender Twin", 2)).toBe("lumen");
    expect(modelFor("", 8)).toBe("basalt");
  });
});

describe("studio store", () => {
  it("coalesces a knob drag into one undo step and redoes it", () => {
    let t = 0;
    const store = createStudioStore(defaultPatch(), null, () => t);
    const s = store.getState;
    for (const v of [5.5, 6, 6.5, 7]) { s().edit("amp.gain", (p) => ({ ...p, amp: { ...p.amp, gain: v } })); t += 100; }
    s().edit("amp.bass", (p) => ({ ...p, amp: { ...p.amp, bass: 2 } }));
    expect(s().past).toHaveLength(2);
    s().undo();
    expect(s().patch.amp).toMatchObject({ gain: 7, bass: 5 });
    s().undo();
    expect(s().patch.amp.gain).toBe(5);
    s().redo();
    expect(s().patch.amp.gain).toBe(7);
    expect(isDirty(s())).toBe(true);
    s().reset();
    expect(isDirty(s())).toBe(false);
  });

  it("separates edits after a pause into their own undo steps", () => {
    let t = 0;
    const store = createStudioStore(defaultPatch(), null, () => t);
    store.getState().edit("amp.gain", (p) => ({ ...p, amp: { ...p.amp, gain: 6 } }));
    t += 2000;
    store.getState().edit("amp.gain", (p) => ({ ...p, amp: { ...p.amp, gain: 7 } }));
    expect(store.getState().past).toHaveLength(2);
  });

  it("compares A and B, each with its own history", () => {
    const store = createStudioStore(defaultPatch());
    const s = store.getState;
    s().edit("amp.gain", (p) => ({ ...p, amp: { ...p.amp, gain: 2 } }));
    s().switchSlot("B");
    expect(s().patch.amp.gain).toBe(2);
    s().edit("amp.model", (p) => ({ ...p, amp: { ...p.amp, model: "prism" } }));
    s().switchSlot("A");
    expect(s().patch.amp.model).toBe("halcyon");
    s().undo();
    expect(s().patch.amp.gain).toBe(5);
    s().switchSlot("B");
    expect(s().patch.amp.model).toBe("prism");
    expect(s().past).toHaveLength(1);
  });

  it("applies device rules to every edit in device mode", () => {
    const store = createStudioStore(patchFromTankG(tankRigs[0]), TANK_G_STUDIO);
    store.getState().edit("fx.add", (p) => ({ ...p, effects: [...p.effects, newEffect("compressor")] }));
    expect(store.getState().patch.effects.some((e) => e.type === "compressor")).toBe(false);
  });
});

describe("studio DSP", () => {
  it("builds bounded, monotonic drive curves for every amp", () => {
    for (const v of Object.values(VOICINGS)) {
      const [d1] = stageDrives(v, 10);
      const c = shaperCurve(v.stage1, d1);
      expect(Math.max(...c.map(Math.abs))).toBeLessThanOrEqual(1.0001);
      for (let i = 1; i < c.length; i++) expect(c[i]).toBeGreaterThanOrEqual(c[i - 1] - 1e-9);
    }
    expect(stageDrives(VOICINGS.basalt, 10)[0]).toBeGreaterThan(stageDrives(VOICINGS.lumen, 10)[0] * 10);
  });

  it("generates a DI-level demo riff and finite reverb tails for every voice", () => {
    const riff = demoRiff(22050);
    expect(levelDb(riff).peak).toBeCloseTo(-6, 0);
    for (const voice of ["Room", "Spring", "Cloud"]) {
      const [l, r] = reverbImpulse(voice, 1.5, 22050);
      expect(l.length).toBe(Math.round(1.5 * 22050));
      expect(l.every(Number.isFinite) && r.every(Number.isFinite)).toBe(true);
      expect(Math.abs(l.at(-1)!)).toBeLessThan(0.01);
    }
  });

  it("covers every effect type with a design", () => {
    expect(EFFECT_TYPES.every((t) => newEffect(t).params)).toBe(true);
  });
});

describe("saving from the studio", () => {
  it("writes device presets back as rigs and everything else as a studio patch beside any recipe", () => {
    const device = constrainToDevice(patchFromTankG(tankRigs[2]), TANK_G_STUDIO);
    const body = saveBody(device, { toneId: "t", name: "x", isOwner: true, deviceRig: tankRigs[2] });
    if (!("rig" in body) || !body.rig) throw new Error("expected a device rig");
    expect(() => validateTankGRig(body.rig, TANK_G_SLUG)).not.toThrow();
    const generic: StudioPatch = defaultPatch("gilded");
    expect(saveBody(generic, { toneId: null, name: "x", isOwner: false, deviceRig: null })).toEqual({ data: { version: 2, studio: generic } });
  });
});
