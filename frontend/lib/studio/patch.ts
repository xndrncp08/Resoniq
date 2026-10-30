import { fail } from "@/lib/validation";

/**
 * The Amp Studio's single source of truth: one patch describes everything on
 * screen and everything the audio engine does. Knobs are 0–10 positions with
 * one decimal (as printed on the panels); levels are dB. Shared by the browser
 * and the server, so it stays free of browser and database imports.
 */

export const AMP_MODELS = ["lumen", "atlas", "juniper", "bellwether", "halcyon", "gilded", "monarch", "basalt", "foundry", "prism"] as const;
export type AmpModelId = (typeof AMP_MODELS)[number];

export const AMP_KNOBS = ["gain", "bass", "mid", "treble", "presence", "depth", "master"] as const;
export type AmpKnob = (typeof AMP_KNOBS)[number];
export const AMP_SWITCHES = ["bright", "tight"] as const;
export type AmpSwitch = (typeof AMP_SWITCHES)[number];

export const CAB_MODELS = ["4x12-closed", "2x12-closed", "2x12-open", "4x10-open", "1x12-open", "1x10-open"] as const;
export type CabModelId = (typeof CAB_MODELS)[number];
/** "stock" is the speaker the cabinet is voiced with; the others re-voice it. */
export const SPEAKERS = ["stock", "ceramic-25", "ceramic-70", "alnico-15", "american-12", "neo-100"] as const;
export type SpeakerId = (typeof SPEAKERS)[number];
export const MICS = ["dynamic", "ribbon", "condenser"] as const;
export type MicId = (typeof MICS)[number];

export const EFFECT_TYPES = ["compressor", "boost", "overdrive", "distortion", "fuzz", "wah", "gate", "eq", "chorus", "flanger", "phaser", "tremolo", "delay", "reverb"] as const;
export type EffectType = (typeof EFFECT_TYPES)[number];
export type Placement = "pre" | "post";

/** `placement`: before the amp ("pre") or after the cabinet ("post"). Older saves leave it out and get the type's default. */
export type Effect = { id: string; type: EffectType; on: boolean; placement: Placement; voice?: string; params: Record<string, number> };

export type StudioPatch = {
  v: 1;
  /** Level into the chain, dB. */
  input: number;
  /** Level out of the chain, dB. */
  output: number;
  gate: { on: boolean; threshold: number };
  amp: { model: AmpModelId } & Record<AmpKnob, number> & Record<AmpSwitch, boolean>;
  cab: { model: CabModelId; on: boolean; micPosition: number; micDistance: number; speaker: SpeakerId; mic: MicId };
  /** In signal order: every "pre" effect, then every "post" one. */
  effects: Effect[];
  /** Set when the patch edits a hardware preset (see lib/studio/devices.ts). */
  device?: { slug: string; ampSlot: number };
};

// ── Designs ────────────────────────────────────────────────────────────
// Original Resoniq designs. Voicing describes what the audio engine does
// with each: it's a two-stage waveshaper with filters, not a circuit model.

export type AmpCharacter = "clean" | "crunch" | "vintage" | "boutique" | "high-gain" | "modern" | "experimental";
export const AMP_CHARACTERS: AmpCharacter[] = ["clean", "crunch", "vintage", "boutique", "high-gain", "modern", "experimental"];

export type AmpDesign = {
  id: AmpModelId;
  name: string;
  tagline: string;
  character: AmpCharacter;
  /** Controls printed on this amp's panel, left to right. Knobs it doesn't print stay at 5 (flat). */
  knobs: { key: AmpKnob; label: string }[];
  switches: { key: AmpSwitch; label: string }[];
  voicing: string;
};

const K = (key: AmpKnob, label: string) => ({ key, label });
const FULL = [K("gain", "Gain"), K("bass", "Bass"), K("mid", "Mid"), K("treble", "Treble"), K("presence", "Presence"), K("depth", "Depth"), K("master", "Master")];

export const AMP_DESIGNS: Record<AmpModelId, AmpDesign> = {
  lumen: {
    id: "lumen", name: "Lumen", tagline: "Brushed aluminium, endless clean headroom", character: "clean",
    knobs: [K("gain", "Volume"), K("bass", "Bass"), K("mid", "Mid"), K("treble", "Treble"), K("master", "Master")],
    switches: [{ key: "bright", label: "Bright" }],
    voicing: "Very little gain; it only starts to compress near the top of its range.",
  },
  atlas: {
    id: "atlas", name: "Atlas 100", tagline: "Big-bottomed American clean with a scooped middle", character: "clean",
    knobs: [K("gain", "Volume"), K("treble", "Treble"), K("mid", "Middle"), K("bass", "Bass"), K("presence", "Presence"), K("master", "Master")],
    switches: [{ key: "bright", label: "Bright" }],
    voicing: "Loud and clean with a tone stack centred low (about 400 Hz), so mids sit back and lows stay firm.",
  },
  juniper: {
    id: "juniper", name: "Juniper 5E", tagline: "Lacquered tweed, one channel, breaks up early", character: "vintage",
    knobs: [K("gain", "Volume"), K("treble", "Tone"), K("bass", "Bass"), K("master", "Master")],
    switches: [],
    voicing: "Low headroom and a loose low end: it gets hairy by 4 and squashes, fat and raw, past 7.",
  },
  bellwether: {
    id: "bellwether", name: "Bellwether 30", tagline: "Diamond grille, chiming top-boost crunch", character: "crunch",
    knobs: [K("gain", "Volume"), K("treble", "Treble"), K("bass", "Bass"), K("presence", "Cut"), K("master", "Master")],
    switches: [{ key: "bright", label: "Bright" }],
    voicing: "A bright, upper-mid chime near 2.2 kHz with soft, compressed breakup. Cut works backwards here as on old class-A amps: higher shaves the top.",
  },
  halcyon: {
    id: "halcyon", name: "Halcyon 50", tagline: "Cream-clad crunch with a laser-cut grille", character: "crunch",
    knobs: FULL,
    switches: [{ key: "bright", label: "Bright" }],
    voicing: "Medium gain, soft asymmetric clipping, a mid push around 800 Hz.",
  },
  gilded: {
    id: "gilded", name: "Kintsugi", tagline: "Lacquer and gold; the veins warm as it's driven", character: "boutique",
    knobs: [K("gain", "Gain"), K("bass", "Bass"), K("mid", "Middle"), K("treble", "Treble"), K("master", "Master"), K("presence", "Presence")],
    switches: [{ key: "bright", label: "Bright" }, { key: "tight", label: "Shift" }],
    voicing: "Smooth, touch-sensitive drive with a broad mid bloom near 1 kHz.",
  },
  monarch: {
    id: "monarch", name: "Monarch ODS", tagline: "Walnut and brass; clean that sings into overdrive", character: "boutique",
    knobs: [K("gain", "Drive"), K("bass", "Bass"), K("mid", "Middle"), K("treble", "Treble"), K("presence", "Presence"), K("master", "Master")],
    switches: [{ key: "bright", label: "Jazz/Rock" }, { key: "tight", label: "Deep" }],
    voicing: "Hi-fi clean at low drive, a vocal 700 Hz lead tone when pushed; the most dynamic of the set.",
  },
  basalt: {
    id: "basalt", name: "Basalt 120", tagline: "Black leather, hex steel, cascaded high gain", character: "high-gain",
    knobs: FULL,
    switches: [{ key: "tight", label: "Tight" }],
    voicing: "Two hard-driven stages with a low cut between them; mids voiced lower, near 650 Hz.",
  },
  foundry: {
    id: "foundry", name: "Foundry 6L6", tagline: "Diamond plate and red jewels, modern and surgical", character: "modern",
    knobs: FULL,
    switches: [{ key: "tight", label: "Tight" }, { key: "bright", label: "Bright" }],
    voicing: "The most gain here, tightly filtered: a 110 Hz low cut between stages and a mid stack voiced near 500 Hz for low-tuned riffs.",
  },
  prism: {
    id: "prism", name: "Prism", tagline: "Frosted glass lit from within; an octave-shimmer fuzz", character: "experimental",
    knobs: [K("gain", "Gain"), K("bass", "Bass"), K("mid", "Mid"), K("treble", "Treble"), K("presence", "Presence"), K("master", "Master")],
    switches: [],
    voicing: "Fuzz-like clipping blended with full-wave rectification for an octave-up shimmer.",
  },
};

export const CAB_DESIGNS: Record<CabModelId, { id: CabModelId; name: string; speakers: number; size: 10 | 12; open: boolean; label: string }> = {
  "4x12-closed": { id: "4x12-closed", name: "Monolith 4×12", speakers: 4, size: 12, open: false, label: "Closed back, tight low end" },
  "2x12-closed": { id: "2x12-closed", name: "Bastion 2×12", speakers: 2, size: 12, open: false, label: "Closed back, punchy and focused" },
  "2x12-open": { id: "2x12-open", name: "Aria 2×12", speakers: 2, size: 12, open: true, label: "Open back, airy and wide" },
  "4x10-open": { id: "4x10-open", name: "Parlour 4×10", speakers: 4, size: 10, open: true, label: "Open back, quick and glassy" },
  "1x12-open": { id: "1x12-open", name: "Satchel 1×12", speakers: 1, size: 12, open: true, label: "Open back, focused mids" },
  "1x10-open": { id: "1x10-open", name: "Bantam 1×10", speakers: 1, size: 10, open: true, label: "Small and boxy, honky mids" },
};

export const SPEAKER_DESIGNS: Record<SpeakerId, { name: string; label: string }> = {
  stock: { name: "Stock", label: "The speaker this cabinet is voiced with" },
  "ceramic-25": { name: "Ceramic 25 W", label: "Warm, soft upper mids, early cone breakup" },
  "ceramic-70": { name: "Ceramic 70 W", label: "Aggressive upper-mid bite, firm lows" },
  "alnico-15": { name: "Alnico 15 W", label: "Chiming, sweet top, lighter lows" },
  "american-12": { name: "American 12", label: "Clean, scooped and bright" },
  "neo-100": { name: "Neodymium 100 W", label: "Flat, tight and extended" },
};

export const MIC_DESIGNS: Record<MicId, { name: string; label: string }> = {
  dynamic: { name: "Dynamic", label: "Midrange-forward, the classic close mic" },
  ribbon: { name: "Ribbon", label: "Dark and smooth, more low end" },
  condenser: { name: "Condenser", label: "Detailed and airy, less proximity boom" },
};

type ParamSpec = { key: string; label: string; default: number };
export type EffectDesign = { type: EffectType; name: string; kind: string; placement: Placement; params: ParamSpec[]; voices?: string[]; color: string; ink: "light" | "dark" };

const P = (key: string, label: string, def: number): ParamSpec => ({ key, label, default: def });

/** Original Resoniq pedal designs. `placement` is where a new one goes; it can be moved either side of the amp. */
export const EFFECT_DESIGNS: Record<EffectType, EffectDesign> = {
  compressor: { type: "compressor", name: "Squeeze", kind: "Compressor", placement: "pre", color: "#2f7d8c", ink: "light", params: [P("sustain", "Sustain", 5), P("level", "Level", 5)] },
  boost: { type: "boost", name: "Lift", kind: "Clean boost", placement: "pre", color: "#d9d4c7", ink: "dark", params: [P("level", "Boost", 4), P("tone", "Tone", 5)] },
  overdrive: { type: "overdrive", name: "Ember Drive", kind: "Overdrive", placement: "pre", color: "#d06a2a", ink: "light", params: [P("drive", "Drive", 4), P("tone", "Tone", 5), P("level", "Level", 6)] },
  distortion: { type: "distortion", name: "Anvil", kind: "Distortion", placement: "pre", color: "#1e1f22", ink: "light", params: [P("drive", "Dist", 6), P("tone", "Filter", 5), P("level", "Level", 5)] },
  fuzz: { type: "fuzz", name: "Moth Fuzz", kind: "Fuzz", placement: "pre", color: "#7b4a8f", ink: "light", params: [P("drive", "Sustain", 7), P("tone", "Tone", 5), P("level", "Volume", 5)] },
  wah: { type: "wah", name: "Vowel", kind: "Wah", placement: "pre", color: "#3a3a3d", ink: "light", voices: ["Fixed", "Auto"], params: [P("position", "Pedal", 5), P("depth", "Range", 5), P("rate", "Speed", 4)] },
  gate: { type: "gate", name: "Hush", kind: "Noise gate", placement: "pre", color: "#e8e6df", ink: "dark", params: [P("threshold", "Threshold", 4), P("release", "Release", 4)] },
  eq: { type: "eq", name: "Contour", kind: "Graphic EQ", placement: "post", color: "#c9ccd1", ink: "dark", params: [P("b100", "100", 5), P("b250", "250", 5), P("b500", "500", 5), P("b1k", "1k", 5), P("b2k", "2k", 5), P("b4k", "4k", 5), P("level", "Level", 5)] },
  chorus: { type: "chorus", name: "Tidepool", kind: "Chorus", placement: "post", color: "#4a8fd6", ink: "light", params: [P("rate", "Rate", 3), P("depth", "Depth", 5), P("mix", "Mix", 5)] },
  flanger: { type: "flanger", name: "Jetstream", kind: "Flanger", placement: "post", color: "#5f8f3a", ink: "light", params: [P("rate", "Rate", 3), P("depth", "Depth", 6), P("feedback", "Regen", 5), P("mix", "Mix", 5)] },
  phaser: { type: "phaser", name: "Orbit", kind: "Phaser", placement: "post", color: "#9a5cd0", ink: "light", params: [P("rate", "Rate", 3), P("depth", "Depth", 6)] },
  tremolo: { type: "tremolo", name: "Pulse", kind: "Tremolo", placement: "post", color: "#c9a227", ink: "dark", params: [P("rate", "Rate", 5), P("depth", "Depth", 5)] },
  delay: { type: "delay", name: "Echo Room", kind: "Delay", placement: "post", color: "#3b9c6a", ink: "light", voices: ["Analog", "Tape", "Dual"], params: [P("time", "Time", 4), P("feedback", "Repeats", 3), P("mix", "Mix", 3)] },
  reverb: { type: "reverb", name: "Cathedral", kind: "Reverb", placement: "post", color: "#5b6f8f", ink: "light", voices: ["Room", "Spring", "Plate", "Hall", "Cloud"], params: [P("decay", "Decay", 4), P("mix", "Mix", 3)] },
};

export const MAX_EFFECTS = 12;

// ── Ranges ─────────────────────────────────────────────────────────────

export const LEVEL_RANGE = { min: -24, max: 24 } as const;
export const GATE_RANGE = { min: -96, max: -20 } as const;

const round1 = (v: number) => Math.round(v * 10) / 10;
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const knob10 = (v: number) => round1(clamp(Number.isFinite(v) ? v : 0, 0, 10));

let counter = 0;
export const effectId = (type: EffectType) => `${type}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function newEffect(type: EffectType, id = effectId(type), placement: Placement = EFFECT_DESIGNS[type].placement): Effect {
  const d = EFFECT_DESIGNS[type];
  return { id, type, on: true, placement, ...(d.voices && { voice: d.voices[0] }), params: Object.fromEntries(d.params.map((p) => [p.key, p.default])) };
}

/** Pre-amp effects first, each group in the order given. */
export function orderEffects(effects: Effect[]): Effect[] {
  return [...effects.filter((e) => e.placement === "pre"), ...effects.filter((e) => e.placement !== "pre")];
}

/** The amp and cabinet's place in a chain order (see arrangeEffects). */
export const RIG_SLOT = "rig";

/** The chain as ids, with the amp and cabinet in the middle: [...pre, "rig", ...post]. */
export const chainOrder = (effects: Effect[]) => [...effects.filter((e) => e.placement === "pre").map((e) => e.id), RIG_SLOT, ...effects.filter((e) => e.placement !== "pre").map((e) => e.id)];

/**
 * Effects in a new chain order: anything left of the amp runs into it, anything
 * right of it runs after the cabinet. Ids not in the order keep their place
 * at the end of their side; unknown ids are ignored.
 */
export function arrangeEffects(effects: Effect[], order: string[]): Effect[] {
  const byId = new Map(effects.map((e) => [e.id, e]));
  const rig = order.indexOf(RIG_SLOT);
  const placed = order.flatMap((id, i): Effect[] => {
    const e = byId.get(id);
    if (!e) return [];
    byId.delete(id);
    return [{ ...e, placement: rig === -1 ? e.placement : i < rig ? "pre" : "post" }];
  });
  return orderEffects([...placed, ...byId.values()]);
}

/** Moves one effect a step along the chain (crossing the amp changes its side). */
export function nudgeEffect(effects: Effect[], id: string, step: -1 | 1): Effect[] {
  const order = chainOrder(effects);
  const i = order.indexOf(id);
  const j = i + step;
  if (i === -1 || j < 0 || j >= order.length) return effects;
  [order[i], order[j]] = [order[j], order[i]];
  return arrangeEffects(effects, order);
}

/** Switching amps resets the knobs the new panel doesn't print, so nothing invisible shapes the sound. */
export function withAmpModel(p: StudioPatch, model: AmpModelId): StudioPatch {
  const shown = new Set<string>(AMP_DESIGNS[model].knobs.map((k) => k.key));
  const switches = new Set<string>(AMP_DESIGNS[model].switches.map((k) => k.key));
  const amp = { ...p.amp, model };
  for (const k of AMP_KNOBS) if (!shown.has(k)) amp[k] = 5;
  for (const k of AMP_SWITCHES) if (!switches.has(k)) amp[k] = false;
  return { ...p, amp };
}

export function defaultPatch(model: AmpModelId = "halcyon"): StudioPatch {
  return {
    v: 1,
    input: 0,
    output: 0,
    gate: { on: false, threshold: -70 },
    amp: { model, gain: 5, bass: 5, mid: 5, treble: 5, presence: 5, depth: 5, master: 5, bright: false, tight: false },
    cab: { model: "4x12-closed", on: true, micPosition: 3, micDistance: 2, speaker: "stock", mic: "dynamic" },
    effects: [],
  };
}

// ── Validation (trust boundary: anything stored comes through here) ─────

function obj(v: unknown, field: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) fail(`${field} must be an object.`);
  return v as Record<string, unknown>;
}
function num(v: unknown, field: string, lo: number, hi: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) fail(`${field} must be a number.`);
  return round1(clamp(v, lo, hi));
}
function bool(v: unknown, field: string): boolean {
  if (typeof v !== "boolean") fail(`${field} must be true or false.`);
  return v;
}
function oneOf<T extends string>(v: unknown, list: readonly T[], field: string): T {
  if (!list.includes(v as T)) fail(`${field} must be one of ${list.join(", ")}.`);
  return v as T;
}

export function parseStudioPatch(v: unknown): StudioPatch {
  const p = obj(v, "studio");
  if (p.v !== 1) fail("studio.v must be 1.");
  const gate = obj(p.gate, "studio.gate");
  const amp = obj(p.amp, "studio.amp");
  const cab = obj(p.cab, "studio.cab");
  if (!Array.isArray(p.effects) || p.effects.length > MAX_EFFECTS) fail(`studio.effects holds at most ${MAX_EFFECTS} effects.`);
  const ids = new Set<string>();
  const effects = p.effects.map((raw, i): Effect => {
    const e = obj(raw, `studio.effects[${i}]`);
    const type = oneOf(e.type, EFFECT_TYPES, `studio.effects[${i}].type`);
    const design = EFFECT_DESIGNS[type];
    if (typeof e.id !== "string" || !/^[\w-]{1,64}$/.test(e.id) || ids.has(e.id)) fail(`studio.effects[${i}].id must be unique.`);
    ids.add(e.id);
    const params = obj(e.params, `studio.effects[${i}].params`);
    return {
      id: e.id,
      type,
      on: bool(e.on, `studio.effects[${i}].on`),
      placement: e.placement === undefined ? design.placement : oneOf(e.placement, ["pre", "post"] as const, `studio.effects[${i}].placement`),
      ...(design.voices && { voice: oneOf(e.voice ?? design.voices[0], design.voices, `studio.effects[${i}].voice`) }),
      params: Object.fromEntries(design.params.map((s) => [s.key, params[s.key] === undefined ? s.default : num(params[s.key], `${type}.${s.key}`, 0, 10)])),
    };
  });
  let device: StudioPatch["device"];
  if (p.device !== undefined && p.device !== null) {
    const d = obj(p.device, "studio.device");
    if (typeof d.slug !== "string" || !/^[a-z0-9-]{1,40}$/.test(d.slug)) fail("studio.device.slug is invalid.");
    device = { slug: d.slug, ampSlot: num(d.ampSlot, "studio.device.ampSlot", 1, 99) };
  }
  return {
    v: 1,
    input: num(p.input, "studio.input", LEVEL_RANGE.min, LEVEL_RANGE.max),
    output: num(p.output, "studio.output", LEVEL_RANGE.min, LEVEL_RANGE.max),
    gate: { on: bool(gate.on, "studio.gate.on"), threshold: num(gate.threshold, "studio.gate.threshold", GATE_RANGE.min, GATE_RANGE.max) },
    amp: {
      model: oneOf(amp.model, AMP_MODELS, "studio.amp.model"),
      ...(Object.fromEntries(AMP_KNOBS.map((k) => [k, num(amp[k], `studio.amp.${k}`, 0, 10)])) as Record<AmpKnob, number>),
      ...(Object.fromEntries(AMP_SWITCHES.map((k) => [k, bool(amp[k], `studio.amp.${k}`)])) as Record<AmpSwitch, boolean>),
    },
    cab: {
      model: oneOf(cab.model, CAB_MODELS, "studio.cab.model"),
      on: bool(cab.on, "studio.cab.on"),
      micPosition: num(cab.micPosition, "studio.cab.micPosition", 0, 10),
      micDistance: num(cab.micDistance, "studio.cab.micDistance", 0, 10),
      speaker: cab.speaker === undefined ? "stock" : oneOf(cab.speaker, SPEAKERS, "studio.cab.speaker"),
      mic: cab.mic === undefined ? "dynamic" : oneOf(cab.mic, MICS, "studio.cab.mic"),
    },
    effects: orderEffects(effects),
    ...(device && { device }),
  };
}

// ── Reading (lenient: stored and legacy patches never crash the studio) ─

const record = (v: unknown): Record<string, unknown> => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
/** A number from a number or numeric string ("3", "3.5"); otherwise the fallback. */
function toNum(v: unknown, fallback: number, lo: number, hi: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? round1(clamp(n, lo, hi)) : fallback;
}
function toBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === 1 || v === "1") return true;
  if (v === "false" || v === 0 || v === "0") return false;
  return fallback;
}
const pick = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);

/**
 * Any stored or legacy patch as a valid StudioPatch: numeric strings become
 * numbers, out-of-range values are clamped, unknown models and missing values
 * fall back to the defaults, and unknown effects are dropped. Never throws.
 * (parseStudioPatch stays strict for writes.)
 */
export function normalizeStudioPatch(v: unknown): StudioPatch {
  const p = record(v);
  const amp = record(p.amp);
  const cab = record(p.cab);
  const gate = record(p.gate);
  const base = defaultPatch(pick(amp.model, AMP_MODELS, "halcyon"));
  const ids = new Set<string>();
  const effects = (Array.isArray(p.effects) ? p.effects : []).flatMap((raw): Effect[] => {
    const e = record(raw);
    if (!EFFECT_TYPES.includes(e.type as EffectType)) return [];
    const type = e.type as EffectType;
    const d = EFFECT_DESIGNS[type];
    const id = typeof e.id === "string" && /^[\w-]{1,64}$/.test(e.id) && !ids.has(e.id) ? e.id : effectId(type);
    ids.add(id);
    const params = record(e.params);
    return [{
      id,
      type,
      on: toBool(e.on, true),
      placement: pick(e.placement, ["pre", "post"] as const, d.placement),
      ...(d.voices && { voice: pick(e.voice, d.voices, d.voices[0]) }),
      params: Object.fromEntries(d.params.map((s) => [s.key, toNum(params[s.key], s.default, 0, 10)])),
    }];
  }).slice(0, MAX_EFFECTS);
  const device = record(p.device);
  return {
    v: 1,
    input: toNum(p.input, base.input, LEVEL_RANGE.min, LEVEL_RANGE.max),
    output: toNum(p.output, base.output, LEVEL_RANGE.min, LEVEL_RANGE.max),
    gate: { on: toBool(gate.on, base.gate.on), threshold: toNum(gate.threshold, base.gate.threshold, GATE_RANGE.min, GATE_RANGE.max) },
    amp: {
      model: base.amp.model,
      ...(Object.fromEntries(AMP_KNOBS.map((k) => [k, toNum(amp[k], base.amp[k], 0, 10)])) as Record<AmpKnob, number>),
      ...(Object.fromEntries(AMP_SWITCHES.map((k) => [k, toBool(amp[k], base.amp[k])])) as Record<AmpSwitch, boolean>),
    },
    cab: {
      model: pick(cab.model, CAB_MODELS, base.cab.model),
      on: toBool(cab.on, base.cab.on),
      micPosition: toNum(cab.micPosition, base.cab.micPosition, 0, 10),
      micDistance: toNum(cab.micDistance, base.cab.micDistance, 0, 10),
      speaker: pick(cab.speaker, SPEAKERS, base.cab.speaker),
      mic: pick(cab.mic, MICS, base.cab.mic),
    },
    effects: orderEffects(effects),
    ...(typeof device.slug === "string" && /^[a-z0-9-]{1,40}$/.test(device.slug) && { device: { slug: device.slug, ampSlot: toNum(device.ampSlot, 1, 1, 99) } }),
  };
}

// ── Factory starting points (not stored until someone saves one) ───────

const fx = (type: EffectType, params: Record<string, number> = {}, voice?: string, placement?: Placement): Effect => {
  const e = newEffect(type, `factory-${type}`, placement);
  return { ...e, ...(voice && { voice }), params: { ...e.params, ...params } };
};
type Recipe = { amp: Partial<StudioPatch["amp"]>; cab?: Partial<StudioPatch["cab"]>; gate?: StudioPatch["gate"]; effects?: Effect[] };
const rig = (model: AmpModelId, r: Recipe): StudioPatch => {
  const base = defaultPatch(model);
  return { ...base, ...(r.gate && { gate: r.gate }), amp: { ...base.amp, ...r.amp }, cab: { ...base.cab, ...r.cab }, effects: orderEffects(r.effects ?? []) };
};

export const FACTORY_PRESETS: { id: string; name: string; patch: StudioPatch }[] = [
  { id: "lumen-glass", name: "Lumen · Glass clean", patch: rig("lumen", { amp: { gain: 3, treble: 6, bright: true }, cab: { model: "2x12-open", micPosition: 4, micDistance: 3 }, effects: [fx("compressor", { sustain: 4, level: 6 }), fx("chorus", { rate: 2, depth: 4, mix: 4 }), fx("reverb", { decay: 6, mix: 4 }, "Cloud")] }) },
  { id: "atlas-surf", name: "Atlas · Spring-soaked clean", patch: rig("atlas", { amp: { gain: 4, treble: 6.5, mid: 4, bass: 5.5, bright: true }, cab: { model: "4x10-open", speaker: "american-12" }, effects: [fx("tremolo", { rate: 6, depth: 4 }), fx("reverb", { decay: 5, mix: 5 }, "Spring")] }) },
  { id: "juniper-raw", name: "Juniper · Cranked tweed", patch: rig("juniper", { amp: { gain: 7, treble: 6, bass: 5.5 }, cab: { model: "1x12-open", speaker: "alnico-15", mic: "ribbon" }, effects: [fx("reverb", { decay: 3, mix: 2 }, "Room")] }) },
  { id: "bellwether-chime", name: "Bellwether · Chiming jangle", patch: rig("bellwether", { amp: { gain: 5.5, treble: 6.5, bass: 4.5, presence: 3.5 }, cab: { model: "2x12-open", speaker: "alnico-15" }, effects: [fx("boost", { level: 3, tone: 6 }), fx("delay", { time: 3, feedback: 2, mix: 2 }, "Tape")] }) },
  { id: "halcyon-crunch", name: "Halcyon · Edge of breakup", patch: rig("halcyon", { amp: { gain: 4.5, mid: 6, presence: 5.5 }, effects: [fx("reverb", { decay: 3, mix: 2 }, "Room")] }) },
  { id: "halcyon-classic", name: "Halcyon · Pushed rock rhythm", patch: rig("halcyon", { amp: { gain: 6.5, mid: 6.5, treble: 6, presence: 6 }, cab: { speaker: "ceramic-25" }, effects: [fx("overdrive", { drive: 2, tone: 6, level: 7 }), fx("reverb", { decay: 3, mix: 2 }, "Plate")] }) },
  { id: "gilded-lead", name: "Kintsugi · Singing lead", patch: rig("gilded", { amp: { gain: 6.5, mid: 6.5, treble: 5.5 }, effects: [fx("delay", { time: 5, feedback: 4, mix: 3 }, "Tape"), fx("reverb", { decay: 5, mix: 3 }, "Spring")] }) },
  { id: "monarch-voice", name: "Monarch · Vocal lead", patch: rig("monarch", { amp: { gain: 6, mid: 6.5, treble: 5, bright: true }, cab: { model: "2x12-closed", mic: "ribbon" }, effects: [fx("compressor", { sustain: 3, level: 5 }), fx("delay", { time: 5, feedback: 3, mix: 3 }, "Analog"), fx("reverb", { decay: 6, mix: 3 }, "Hall")] }) },
  { id: "basalt-rhythm", name: "Basalt · Tight rhythm", patch: rig("basalt", { gate: { on: true, threshold: -58 }, amp: { gain: 7, bass: 5.5, mid: 4, treble: 6, presence: 6, depth: 6, tight: true }, effects: [fx("overdrive", { drive: 1, tone: 6, level: 8 })] }) },
  { id: "foundry-djent", name: "Foundry · Low-tuned chug", patch: rig("foundry", { amp: { gain: 7.5, bass: 5, mid: 4.5, treble: 6, presence: 6.5, depth: 6.5, tight: true }, cab: { speaker: "ceramic-70" }, effects: [fx("gate", { threshold: 5, release: 2 }), fx("boost", { level: 5, tone: 6 }), fx("eq", { b100: 4, b250: 4, b500: 5.5, b1k: 5.5, b2k: 5, b4k: 4.5 })] }) },
  { id: "basalt-fuzzwall", name: "Basalt · Fuzz wall", patch: rig("basalt", { amp: { gain: 4.5, bass: 6, mid: 5, treble: 5 }, cab: { speaker: "ceramic-25" }, effects: [fx("fuzz", { drive: 8, tone: 4, level: 5 }), fx("phaser", { rate: 1.5, depth: 5 }), fx("reverb", { decay: 5, mix: 2 }, "Hall")] }) },
  { id: "prism-bloom", name: "Prism · Octave bloom", patch: rig("prism", { amp: { gain: 6, mid: 6.5, presence: 4 }, cab: { model: "1x12-open", micPosition: 2, micDistance: 2 }, effects: [fx("phaser", { rate: 2, depth: 5 }), fx("delay", { time: 6, feedback: 5, mix: 3 }, "Dual")] }) },
  { id: "halcyon-funk", name: "Halcyon · Auto-wah funk", patch: rig("halcyon", { amp: { gain: 3, mid: 5.5, treble: 6 }, cab: { model: "2x12-open" }, effects: [fx("compressor", { sustain: 6, level: 6 }), fx("wah", { position: 5, depth: 6, rate: 5 }, "Auto"), fx("flanger", { rate: 1.5, depth: 4, feedback: 3, mix: 3 })] }) },
];

// ── Preset files (import / export) ──────────────────────────────────────

export const PRESET_FILE_FORMAT = "resoniq.studio-patch";
export const MAX_PRESET_FILE_BYTES = 256 * 1024;

export function presetFile(name: string, patch: StudioPatch) {
  // Device presets are tied to a tone's rig; the file carries the sound, not the hardware link.
  const { device: _device, ...sound } = patch;
  return JSON.stringify({ format: PRESET_FILE_FORMAT, version: 1, name, patch: sound }, null, 2);
}

/** A preset file (or a bare patch) as a valid patch. Throws an Error with a readable message. */
export function readPresetFile(text: string): { name: string | null; patch: StudioPatch } {
  if (text.length > MAX_PRESET_FILE_BYTES) throw new Error("That file is too large to be a studio preset.");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  const r = record(json);
  const raw = r.format === PRESET_FILE_FORMAT ? record(r.patch) : r;
  if (!("amp" in raw) || typeof raw.amp !== "object") throw new Error("That file isn't a Resoniq studio preset.");
  const patch = normalizeStudioPatch(raw);
  delete patch.device;
  const name = typeof r.name === "string" ? r.name.trim().slice(0, 120) : "";
  return { name: name || null, patch };
}
