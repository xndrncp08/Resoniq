import { describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { TANK_G_PRESETS } from "@/lib/tank-g-presets";
import { bankLayout, clock, parseTankGFilters, slotLabel, TANK_G_COLLECTIONS, TANK_G_SLUG, tankGSheet, tankGSheetText, validateTankGRig } from "@/lib/devices/tank-g";
import { parseDraftInput, presetRig, rigFingerprint } from "@/lib/tone-draft-validation";
import { TONE_PRESETS } from "@/lib/tone-presets";
import { TANK_G_INITIAL_KEYS } from "@/lib/tone-drafts";
import { creatorHandleFor, MANAGED_CREATORS } from "@/lib/managed-creators";
import { GEAR } from "@/prisma/seed-gear";
import type { RigSpec } from "@/types/rig";

const slug = (brand: string, model: string) =>
  `${brand} ${model}`.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
// The catalog as presetRig sees it, with slugs standing in for ids.
const catalog = GEAR.map(([, brand, model]) => ({ id: slug(brand, model).slice(0, 40), slug: slug(brand, model), brand, model }));
const tx = { gearItem: { findMany: async () => catalog } } as unknown as Prisma.TransactionClient;
const rigs = await Promise.all(TANK_G_PRESETS.map(p => presetRig(tx, p)));
const clone = (r: RigSpec): RigSpec => structuredClone(r);

describe("TANK-G preset library", () => {
  it("is a large, uniquely keyed library within the requested size", () => {
    expect(TANK_G_PRESETS.length).toBeGreaterThanOrEqual(100);
    expect(TANK_G_PRESETS.length).toBeLessThanOrEqual(150);
    expect(new Set(TANK_G_PRESETS.map(p => p.key)).size).toBe(TANK_G_PRESETS.length);
    expect(new Set(TANK_G_PRESETS.map(p => p.name)).size).toBe(TANK_G_PRESETS.length);
    expect(new Set([...TONE_PRESETS, ...TANK_G_PRESETS].map(p => p.key)).size).toBe(TONE_PRESETS.length + TANK_G_PRESETS.length);
    for (const c of Object.keys(TANK_G_COLLECTIONS)) expect(TANK_G_PRESETS.filter(p => p.device?.collection === c).length).toBeGreaterThanOrEqual(25);
  });

  it("only uses what the hardware has, and every preset passes draft and device validation", () => {
    for (const [i, rig] of rigs.entries()) {
      expect(() => validateTankGRig(rig, TANK_G_SLUG), TANK_G_PRESETS[i].key).not.toThrow();
      const input = parseDraftInput({ name: TANK_G_PRESETS[i].name, description: TANK_G_PRESETS[i].description, rig, creatorId: "c1" });
      expect(input.rig.setupGuide!.length).toBeLessThanOrEqual(4000);
      expect(input.rig.setupGuide).toMatch(/Single coils:.*\n.*Humbuckers:/);
      expect(input.rig.setupGuide).toContain("Level:");
    }
  });

  it("has no exact or near duplicates: same slot and effect types must differ by at least 3 knob steps", () => {
    expect(new Set(rigs.map(rigFingerprint)).size).toBe(rigs.length);
    const vec = (r: RigSpec) => [...Object.values(r.amp!.settings), ...r.chain.flatMap(b => Object.values(b.params).filter((v): v is number => typeof v === "number"))];
    const shape = (r: RigSpec) => `${r.device!.ampSlot}|${r.chain.map(b => `${b.category}:${b.params.Type ?? ""}`).join(",")}`;
    for (let i = 0; i < rigs.length; i++) for (let j = i + 1; j < rigs.length; j++) {
      if (shape(rigs[i]) !== shape(rigs[j])) continue;
      const [a, b] = [vec(rigs[i]), vec(rigs[j])];
      const distance = a.reduce((sum, v, k) => sum + Math.abs(v - b[k]), 0);
      expect(distance, `${TANK_G_PRESETS[i].key} vs ${TANK_G_PRESETS[j].key}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("covers the requested styles", () => {
    const text = TANK_G_PRESETS.map(p => `${p.name} ${p.styles.join(" ")} ${p.description}`.toLowerCase()).join("\n");
    for (const s of ["crystal clean", "warm clean", "glassy", "blues clean", "neo-soul", "jazz", "funk rhythm", "worship", "shimmer", "dream", "chorus", "classic rock", "british crunch", "blues breakup", "pop punk", "alternative", "indie rock", "grunge", "hard rock", "lead boost", "vintage overdrive", "modern metal", "tight", "progressive", "thrash", "djent", "melodic metal", "sustain", "technical", "low tuned", "legato", "blues lead", "fusion", "ambient lead", "delay lead", "mix-ready", "expressive"]) expect(text, s).toContain(s);
  });

  it("goes to existing managed creators and an initial set of 36 (nine per collection)", () => {
    for (const p of TANK_G_PRESETS) expect(MANAGED_CREATORS.some(c => c.handle === creatorHandleFor(p.key, p.instrument, p.genres))).toBe(true);
    expect(creatorHandleFor("tank-g-ambient-drift", "GUITAR", ["ambient"])).toBe("resoniq_aura");
    expect(TANK_G_INITIAL_KEYS).toHaveLength(36);
    for (const c of Object.keys(TANK_G_COLLECTIONS)) expect(TANK_G_INITIAL_KEYS.filter(k => TANK_G_PRESETS.find(p => p.key === k)!.device!.collection === c)).toHaveLength(9);
  });
});

describe("TANK-G device rules", () => {
  const base = rigs.find(r => r.chain.length === 4)!;
  it("rejects anything the pedal can't do", () => {
    const cases: [string, (r: RigSpec) => void][] = [
      ["amp slot", r => { r.device!.ampSlot = 10; }],
      ["supports Room, Spring, Cloud", r => { r.chain[3].params.Type = "Shimmer"; }],
      ["one each", r => { r.chain.push({ ...r.chain[1], id: "x" }); }],
      ["TANK-G module", r => { r.chain.unshift({ id: "c", category: "compressor", enabled: true, placement: "pre", params: { Level: 5 } }); }],
      ["separate EQ", r => { r.eq = { "800Hz": 2 }; }],
      ["amp settings", r => { r.amp!.settings.Presence = 5; }],
      ["takes", r => { r.chain[3].params.Tone = 5; }],
      ["the amp must be", r => { r.amp!.ref = { model: "Other" }; }],
      ["gate", r => { r.chain[0].params.Threshold = 0; }],
    ];
    for (const [message, mutate] of cases) {
      const r = clone(base);
      mutate(r);
      expect(() => validateTankGRig(r, TANK_G_SLUG), message).toThrow(message);
    }
  });

  it("builds a 15-row panel sheet with approximate clock positions, and survives junk member rigs", () => {
    expect([clock(0), clock(5), clock(10)]).toEqual(["7:00", "12:00", "5:00"]);
    const rows = tankGSheet(base);
    expect(rows.map(r => r.control)).toEqual(["NOISE GATE", "TYPE", "GAIN", "TREBLE", "MIDDLE", "BASS", "VOLUME", "MOD FX", "MOD SPEED", "DLY MIX", "DLY TIME", "RVB DECAY", "RVB MIX", "IR CAB", "MASTER"]);
    const text = tankGSheetText("X", base, "https://example.test", "t1", "Generated.");
    expect(text).toContain("https://example.test/t/t1");
    expect(text).toContain("not native parameter readouts");
    expect(tankGSheet({ chain: [], device: { slug: TANK_G_SLUG, ampSlot: 50 } })).toEqual([]);
    expect(tankGSheet({ chain: [{ id: "a", category: "delay", enabled: true, placement: "loop", params: { Type: "Nope" } }], amp: { settings: {} }, device: { slug: TANK_G_SLUG, ampSlot: 2 } })).toHaveLength(15);
  });

  it("keeps fingerprints of device-less rigs unchanged and parses filters strictly", () => {
    const rig = { chain: [], amp: { settings: { Gain: 1 } } } as RigSpec;
    expect(rigFingerprint(rig)).toBe(rigFingerprint({ ...rig, device: undefined }));
    expect(parseTankGFilters(k => ({ amp: "7", effect: "Tape", collection: "metal" })[k])).toEqual({ ampSlot: 7, effect: "Tape", collection: "metal" });
    expect(parseTankGFilters(k => ({ amp: "12", effect: "Shimmer", collection: "x" })[k])).toEqual({ ampSlot: undefined, effect: undefined, collection: undefined });
  });
});

describe("TANK-G bank planner", () => {
  it("labels 36 slots 1A–9D and lays out clean banks first, with overflow kept separate", () => {
    expect([slotLabel(0), slotLabel(3), slotLabel(4), slotLabel(35)]).toEqual(["1A", "1D", "2A", "9D"]);
    const tones = TANK_G_PRESETS.map((p, i) => ({ name: p.name, declared: rigs[i] as RigSpec | null })).reverse();
    const { slots, extra } = bankLayout([...tones, { name: "Member rig", declared: null }]);
    expect(slots).toHaveLength(36);
    expect(extra).toHaveLength(tones.length + 1 - 36);
    const clean = TANK_G_PRESETS.filter(p => p.device!.collection === "clean").length;
    expect(slots.slice(0, clean).every(t => t.declared?.device?.collection === "clean")).toBe(true);
    expect(slots.slice(clean).every(t => t.declared?.device?.collection === "rock")).toBe(true);
    const names = slots.slice(0, clean).map(t => t.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(extra.at(-1)!.name).toBe("Member rig");
  });
});
