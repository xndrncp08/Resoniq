import { describe, expect, it } from "vitest";
import { parseRig, rigGearIds } from "@/lib/rig-validation";
import { diffTones } from "@/lib/tone-compare";
import { exportTone, parseToneInput, type ToneView } from "@/lib/tones";
import { ValidationError } from "@/lib/validation";

const author = { id: "u1", handle: "mia", name: "Mia", image: null };
const view = (over: Partial<ToneView> = {}): ToneView => ({
  id: "t1",
  name: "Edge of breakup",
  description: null,
  visibility: "PUBLIC",
  studio: null,
  author,
  anonymous: false,
  origin: "member",
  inferred: null,
  recipeEdited: false,
  declared: null,
  saveCount: 0,
  remixCount: 0,
  remixOf: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  publishedAt: null,
  viewer: { isOwner: false, saved: false, favorite: false },
  songId: null,
  ...over,
});

describe("parseRig", () => {
  it("accepts a sparse rig and drops empty parts", () => {
    expect(parseRig({ chain: [{ category: "fuzz", ref: { model: "Big Muff Pi" } }] })).toEqual({
      chain: [{ id: "b1", category: "fuzz", ref: { model: "Big Muff Pi" }, enabled: true, placement: "pre", params: {} }],
    });
    expect(parseRig({ chain: [], notes: "  " })).toBeNull();
    expect(parseRig(null)).toBeNull();
  });

  it("clamps amp knobs to 0–10 and keeps switch labels", () => {
    const rig = parseRig({
      amp: { ref: { gearId: "g1", model: "Twin Reverb" }, settings: { Volume: 14, Treble: 6.456 } },
      chain: [{ category: "delay", params: { Time: 450, Mode: "analog" } }],
    })!;
    expect(rig.amp?.settings).toEqual({ Volume: 10, Treble: 6.46 });
    expect(rig.chain[0].params).toEqual({ Time: 450, Mode: "analog" });
    expect(rigGearIds(rig)).toEqual(["g1"]);
  });

  it.each([
    { instrument: { kind: "KAZOO" } },
    { chain: [{ category: "teleporter" }] },
    { chain: Array.from({ length: 25 }, () => ({ category: "drive" })) },
    { amp: { settings: Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`k${i}`, 1])) } },
    { amp: { ref: { brand: "Fender" } } },
    { notes: "x".repeat(4001) },
    { amp: { settings: { Gain: "loud" } } },
  ])("rejects %j", (rig) => {
    expect(() => parseRig(rig)).toThrow(ValidationError);
  });
});

describe("parseToneInput", () => {
  it("validates visibility", () => {
    expect(parseToneInput({ visibility: "PUBLIC" }, { partial: true })).toEqual({ visibility: "PUBLIC" });
    expect(() => parseToneInput({ visibility: "SECRET" }, { partial: true })).toThrow(ValidationError);
  });
});

describe("diffTones", () => {
  it("compares declared knobs and chain positions", () => {
    const a = view({ declared: { amp: { settings: { Gain: 4, Bass: 6 } }, chain: [{ id: "1", category: "drive", enabled: true, placement: "pre", params: {}, ref: { model: "TS9" } }] } });
    const b = view({ declared: { amp: { settings: { Gain: 7 } }, chain: [{ id: "1", category: "drive", enabled: true, placement: "pre", params: {}, ref: { model: "TS9" } }, { id: "2", category: "reverb", enabled: true, placement: "loop", params: {} }] } });
    const d = diffTones(a, b);
    expect(d.declaredAmp).toEqual([
      { control: "Gain", a: 4, b: 7, delta: 3 },
      { control: "Bass", a: 6, b: null, delta: null },
    ]);
    expect(d.chain.map((r) => r.same)).toEqual([true, false]);
    expect(d.inferredAmp).toEqual([]);
  });
});

describe("exportTone", () => {
  it("labels inferred settings as heuristic and keeps declared ones apart", () => {
    const inferred = { confidenceScore: 50, recipeDescription: "x", amp: { family: "Fender", model: "Twin", gain: 30, bass: 50, mids: 50, treble: 60, presence: 40 }, cabinet: { type: "2x12", speaker: "C12N" }, pickup: "Neck" as const, pedalboard: [], similarArtists: [] };
    const out = exportTone(view({ inferred, recipeEdited: true, declared: { chain: [] } }), "https://resoniq.test");
    expect(out.format).toBe("resoniq-tone");
    expect(out.url).toBe("https://resoniq.test/t/t1");
    expect(out.inferred?.note).toMatch(/adjusted by the creator/);
    expect(out.declared).toEqual({ chain: [] });
  });
});
