import { BLOCK_CATEGORIES, INSTRUMENT_KINDS, type BlockCategory, type GearRef, type InstrumentKind, type RigBlock, type RigSpec } from "@/types/rig";
import { fail } from "@/lib/validation";

/** Bounds for creator-declared rigs; everything here renders on public pages. */
export const RIG_LIMITS = { blocks: 24, params: 16, text: 120, long: 4000, list: 12, key: 32 } as const;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function str(v: unknown, field: string, max: number = RIG_LIMITS.text): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string") fail(`${field} must be text.`);
  const s = v.trim();
  if (s.length > max) fail(`${field} is too long (max ${max}).`);
  return s || undefined;
}

function strList(v: unknown, field: string): string[] | undefined {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v) || v.length > RIG_LIMITS.list) fail(`${field} takes up to ${RIG_LIMITS.list} entries.`);
  const out = v.map((x, i) => str(x, `${field}[${i}]`)).filter((x): x is string => !!x);
  return out.length ? out : undefined;
}

function num(v: unknown, field: string, min: number, max: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) fail(`${field} must be a number.`);
  return Math.round(Math.max(min, Math.min(max, v)) * 100) / 100;
}

function ref(v: unknown, field: string): GearRef | undefined {
  if (v === undefined || v === null) return undefined;
  if (!isObj(v)) fail(`${field} must be an object.`);
  const model = str(v.model, `${field}.model`);
  if (!model) fail(`${field}.model is required.`);
  const gearId = str(v.gearId, `${field}.gearId`, 40);
  const brand = str(v.brand, `${field}.brand`);
  return { model, ...(gearId && { gearId }), ...(brand && { brand }) };
}

function keyName(k: string, field: string) {
  const key = k.trim();
  if (!key || key.length > RIG_LIMITS.key) fail(`${field} control names are 1–${RIG_LIMITS.key} characters.`);
  return key;
}

function params(v: unknown, field: string): Record<string, number | string> {
  if (v === undefined || v === null) return {};
  if (!isObj(v)) fail(`${field} must be an object.`);
  const entries = Object.entries(v);
  if (entries.length > RIG_LIMITS.params) fail(`${field} takes up to ${RIG_LIMITS.params} controls.`);
  // Wide numeric range: knobs (0–10), dB, ms and Hz all live here.
  return Object.fromEntries(
    entries.map(([k, val]) => [keyName(k, field), typeof val === "string" ? (str(val, `${field}.${k}`, 40) ?? "") : num(val, `${field}.${k}`, -100_000, 100_000)]),
  );
}

function knobs(v: unknown, field: string, min: number, max: number): Record<string, number> {
  if (v === undefined || v === null) return {};
  if (!isObj(v)) fail(`${field} must be an object.`);
  const entries = Object.entries(v);
  if (entries.length > RIG_LIMITS.params) fail(`${field} takes up to ${RIG_LIMITS.params} controls.`);
  return Object.fromEntries(entries.map(([k, val]) => [keyName(k, field), num(val, `${field}.${k}`, min, max)]));
}

function block(v: unknown, i: number): RigBlock {
  const field = `chain[${i}]`;
  if (!isObj(v)) fail(`${field} must be an object.`);
  if (!BLOCK_CATEGORIES.includes(v.category as BlockCategory)) fail(`${field}.category is not a known effect type.`);
  const r = ref(v.ref, `${field}.ref`);
  return {
    id: str(v.id, `${field}.id`, 40) ?? `b${i + 1}`,
    category: v.category as BlockCategory,
    ...(r && { ref: r }),
    enabled: v.enabled !== false,
    placement: v.placement === "loop" ? "loop" : "pre",
    params: params(v.params, `${field}.params`),
  };
}

/** Validates and normalizes a declared rig. Returns null for an empty rig. */
export function parseRig(v: unknown): RigSpec | null {
  if (v === undefined || v === null) return null;
  if (!isObj(v)) fail("rig must be an object.");
  const out: RigSpec = { chain: [] };

  if (v.instrument !== undefined && v.instrument !== null) {
    const ins = v.instrument;
    if (!isObj(ins) || !INSTRUMENT_KINDS.includes(ins.kind as InstrumentKind)) fail("rig.instrument.kind must be GUITAR or BASS.");
    const r = ref(ins.ref, "rig.instrument.ref");
    out.instrument = {
      kind: ins.kind as InstrumentKind,
      ...(r && { ref: r }),
      ...(str(ins.strings, "strings") && { strings: str(ins.strings, "strings") }),
      ...(str(ins.tuning, "tuning") && { tuning: str(ins.tuning, "tuning") }),
      ...(strList(ins.pickups, "pickups") && { pickups: strList(ins.pickups, "pickups") }),
      ...(str(ins.pickupPosition, "pickupPosition") && { pickupPosition: str(ins.pickupPosition, "pickupPosition") }),
      ...(str(ins.notes, "instrument notes", RIG_LIMITS.long) && { notes: str(ins.notes, "instrument notes", RIG_LIMITS.long) }),
    };
  }
  if (v.amp !== undefined && v.amp !== null) {
    if (!isObj(v.amp)) fail("rig.amp must be an object.");
    const r = ref(v.amp.ref, "rig.amp.ref");
    const channel = str(v.amp.channel, "rig.amp.channel", 40);
    out.amp = { ...(r && { ref: r }), ...(channel && { channel }), settings: knobs(v.amp.settings, "rig.amp.settings", 0, 10) };
  }
  if (v.cab !== undefined && v.cab !== null) {
    if (!isObj(v.cab)) fail("rig.cab must be an object.");
    const r = ref(v.cab.ref, "rig.cab.ref");
    const speakers = str(v.cab.speakers, "rig.cab.speakers");
    const mic = str(v.cab.mic, "rig.cab.mic");
    out.cab = { ...(r && { ref: r }), ...(speakers && { speakers }), ...(mic && { mic }) };
  }
  if (v.chain !== undefined && v.chain !== null) {
    if (!Array.isArray(v.chain) || v.chain.length > RIG_LIMITS.blocks) fail(`A chain holds up to ${RIG_LIMITS.blocks} blocks.`);
    out.chain = v.chain.map(block);
  }
  if (isObj(v.device)) {
    const slug = str(v.device.slug, "rig.device.slug", 40);
    if (!slug) fail("rig.device.slug is required.");
    const ampSlot = v.device.ampSlot === undefined ? undefined : num(v.device.ampSlot, "rig.device.ampSlot", 1, 99);
    const collection = str(v.device.collection, "rig.device.collection", 20);
    out.device = { slug, ...(ampSlot !== undefined && { ampSlot }), ...(collection && { collection }) };
  }
  const eq = knobs(v.eq, "rig.eq", -24, 24);
  if (Object.keys(eq).length) out.eq = eq;
  for (const k of ["notes", "setupGuide"] as const) {
    const t = str(v[k], k, RIG_LIMITS.long);
    if (t) out[k] = t;
  }
  const alternatives = strList(v.alternatives, "alternatives");
  if (alternatives) out.alternatives = alternatives;
  if (isObj(v.references)) {
    const refs = Object.fromEntries(
      (["songs", "artists", "genres", "styles"] as const).flatMap((k) => {
        const l = strList((v.references as Record<string, unknown>)[k], `references.${k}`);
        return l ? [[k, l]] : [];
      }),
    );
    if (Object.keys(refs).length) out.references = refs;
  }
  const empty = !out.instrument && !out.amp && !out.cab && out.chain.length === 0 && !out.eq && !out.notes && !out.setupGuide && !out.alternatives && !out.references;
  return empty ? null : out;
}

/** Every catalog id a rig points at (for ToneGear indexing and existence checks). */
export function rigGearIds(rig: RigSpec | null): string[] {
  if (!rig) return [];
  const refs = [rig.instrument?.ref, rig.amp?.ref, rig.cab?.ref, ...rig.chain.map((b) => b.ref)];
  return [...new Set(refs.flatMap((r) => (r?.gearId ? [r.gearId] : [])))];
}
