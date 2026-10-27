import { fail } from "@/lib/validation";

/**
 * The Amp Studio's single source of truth: one patch describes everything on
 * screen and everything the audio engine does. Knobs are 0–10 positions with
 * one decimal (as printed on the panels); levels are dB. Shared by the browser
 * and the server, so it stays free of browser and database imports.
 */

export const AMP_MODELS = ["halcyon", "basalt", "gilded", "lumen", "prism"] as const;
export type AmpModelId = (typeof AMP_MODELS)[number];

export const AMP_KNOBS = ["gain", "bass", "mid", "treble", "presence", "depth", "master"] as const;
export type AmpKnob = (typeof AMP_KNOBS)[number];
export const AMP_SWITCHES = ["bright", "tight"] as const;
export type AmpSwitch = (typeof AMP_SWITCHES)[number];

export const CAB_MODELS = ["4x12-closed", "2x12-open", "1x12-open"] as const;
export type CabModelId = (typeof CAB_MODELS)[number];

export const EFFECT_TYPES = ["compressor", "overdrive", "chorus", "phaser", "tremolo", "delay", "reverb"] as const;
export type EffectType = (typeof EFFECT_TYPES)[number];

export type Effect = { id: string; type: EffectType; on: boolean; voice?: string; params: Record<string, number> };

export type StudioPatch = {
  v: 1;
  /** Level into the chain, dB. */
  input: number;
  /** Level out of the chain, dB. */
  output: number;
  gate: { on: boolean; threshold: number };
  amp: { model: AmpModelId } & Record<AmpKnob, number> & Record<AmpSwitch, boolean>;
  cab: { model: CabModelId; on: boolean; micPosition: number; micDistance: number };
  /** In signal order. Compressor and overdrive sit before the amp, the rest after it. */
  effects: Effect[];
  /** Set when the patch edits a hardware preset (see lib/studio/devices.ts). */
  device?: { slug: string; ampSlot: number };
};

// ── Designs ────────────────────────────────────────────────────────────
// Original Resoniq designs. Voicing describes what the audio engine does
// with each: it's a two-stage waveshaper with filters, not a circuit model.

export type AmpDesign = {
  id: AmpModelId;
  name: string;
  tagline: string;
  character: "vintage" | "modern" | "boutique" | "clean" | "experimental";
  /** Controls printed on this amp's panel, left to right. */
  knobs: { key: AmpKnob; label: string }[];
  switches: { key: AmpSwitch; label: string }[];
  voicing: string;
};

export const AMP_DESIGNS: Record<AmpModelId, AmpDesign> = {
  halcyon: {
    id: "halcyon",
    name: "Halcyon 50",
    tagline: "Cream-clad crunch with a laser-cut grille",
    character: "vintage",
    knobs: [
      { key: "gain", label: "Gain" }, { key: "bass", label: "Bass" }, { key: "mid", label: "Mid" }, { key: "treble", label: "Treble" },
      { key: "presence", label: "Presence" }, { key: "depth", label: "Depth" }, { key: "master", label: "Master" },
    ],
    switches: [{ key: "bright", label: "Bright" }],
    voicing: "Medium gain, soft asymmetric clipping, a mid push around 800 Hz.",
  },
  basalt: {
    id: "basalt",
    name: "Basalt 120",
    tagline: "Black leather, hex steel, cascaded high gain",
    character: "modern",
    knobs: [
      { key: "gain", label: "Gain" }, { key: "bass", label: "Bass" }, { key: "mid", label: "Mid" }, { key: "treble", label: "Treble" },
      { key: "presence", label: "Presence" }, { key: "depth", label: "Depth" }, { key: "master", label: "Master" },
    ],
    switches: [{ key: "tight", label: "Tight" }],
    voicing: "Two hard-driven stages with a low cut between them; mids voiced lower, near 650 Hz.",
  },
  gilded: {
    id: "gilded",
    name: "Kintsugi",
    tagline: "Lacquer and gold; the veins warm as it's driven",
    character: "boutique",
    knobs: [
      { key: "gain", label: "Gain" }, { key: "bass", label: "Bass" }, { key: "mid", label: "Middle" }, { key: "treble", label: "Treble" },
      { key: "master", label: "Master" }, { key: "presence", label: "Presence" },
    ],
    switches: [{ key: "bright", label: "Bright" }, { key: "tight", label: "Shift" }],
    voicing: "Smooth, touch-sensitive drive with a broad mid bloom near 1 kHz.",
  },
  lumen: {
    id: "lumen",
    name: "Lumen",
    tagline: "Brushed aluminium, endless clean headroom",
    character: "clean",
    knobs: [
      { key: "gain", label: "Volume" }, { key: "bass", label: "Bass" }, { key: "mid", label: "Mid" }, { key: "treble", label: "Treble" }, { key: "master", label: "Master" },
    ],
    switches: [{ key: "bright", label: "Bright" }],
    voicing: "Very little gain; it only starts to compress near the top of its range.",
  },
  prism: {
    id: "prism",
    name: "Prism",
    tagline: "Frosted glass lit from within; an octave-shimmer fuzz",
    character: "experimental",
    knobs: [
      { key: "gain", label: "Gain" }, { key: "bass", label: "Bass" }, { key: "mid", label: "Mid" }, { key: "treble", label: "Treble" },
      { key: "presence", label: "Presence" }, { key: "master", label: "Master" },
    ],
    switches: [],
    voicing: "Fuzz-like clipping blended with full-wave rectification for an octave-up shimmer.",
  },
};

export const CAB_DESIGNS: Record<CabModelId, { id: CabModelId; name: string; speakers: number; label: string }> = {
  "4x12-closed": { id: "4x12-closed", name: "Monolith 4×12", speakers: 4, label: "Closed back, tight low end" },
  "2x12-open": { id: "2x12-open", name: "Aria 2×12", speakers: 2, label: "Open back, airy and wide" },
  "1x12-open": { id: "1x12-open", name: "Satchel 1×12", speakers: 1, label: "Open back, focused mids" },
};

type ParamSpec = { key: string; label: string; default: number };
export type EffectDesign = { type: EffectType; name: string; placement: "pre" | "post"; params: ParamSpec[]; voices?: string[]; color: string };

export const EFFECT_DESIGNS: Record<EffectType, EffectDesign> = {
  compressor: { type: "compressor", name: "Squeeze", placement: "pre", color: "#2f7d8c", params: [{ key: "sustain", label: "Sustain", default: 5 }, { key: "level", label: "Level", default: 5 }] },
  overdrive: { type: "overdrive", name: "Ember Drive", placement: "pre", color: "#d06a2a", params: [{ key: "drive", label: "Drive", default: 4 }, { key: "tone", label: "Tone", default: 5 }, { key: "level", label: "Level", default: 6 }] },
  chorus: { type: "chorus", name: "Tidepool", placement: "post", color: "#4a8fd6", params: [{ key: "rate", label: "Rate", default: 3 }, { key: "depth", label: "Depth", default: 5 }, { key: "mix", label: "Mix", default: 5 }] },
  phaser: { type: "phaser", name: "Orbit", placement: "post", color: "#9a5cd0", params: [{ key: "rate", label: "Rate", default: 3 }, { key: "depth", label: "Depth", default: 6 }] },
  tremolo: { type: "tremolo", name: "Pulse", placement: "post", color: "#c9a227", params: [{ key: "rate", label: "Rate", default: 5 }, { key: "depth", label: "Depth", default: 5 }] },
  delay: { type: "delay", name: "Echo Room", placement: "post", color: "#3b9c6a", voices: ["Analog", "Tape", "Dual"], params: [{ key: "time", label: "Time", default: 4 }, { key: "feedback", label: "Repeats", default: 3 }, { key: "mix", label: "Mix", default: 3 }] },
  reverb: { type: "reverb", name: "Cathedral", placement: "post", color: "#5b6f8f", voices: ["Room", "Spring", "Cloud"], params: [{ key: "decay", label: "Decay", default: 4 }, { key: "mix", label: "Mix", default: 3 }] },
};

export const MAX_EFFECTS = 8;

// ── Ranges ─────────────────────────────────────────────────────────────

export const LEVEL_RANGE = { min: -24, max: 24 } as const;
export const GATE_RANGE = { min: -96, max: -20 } as const;

const round1 = (v: number) => Math.round(v * 10) / 10;
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const knob10 = (v: number) => round1(clamp(Number.isFinite(v) ? v : 0, 0, 10));

let counter = 0;
export const effectId = (type: EffectType) => `${type}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function newEffect(type: EffectType, id = effectId(type)): Effect {
  const d = EFFECT_DESIGNS[type];
  return { id, type, on: true, ...(d.voices && { voice: d.voices[0] }), params: Object.fromEntries(d.params.map((p) => [p.key, p.default])) };
}

/** Pre-amp effects first, each group in the order given. */
export function orderEffects(effects: Effect[]): Effect[] {
  const pre = effects.filter((e) => EFFECT_DESIGNS[e.type].placement === "pre");
  const post = effects.filter((e) => EFFECT_DESIGNS[e.type].placement === "post");
  return [...pre, ...post];
}

export function defaultPatch(model: AmpModelId = "halcyon"): StudioPatch {
  return {
    v: 1,
    input: 0,
    output: 0,
    gate: { on: false, threshold: -70 },
    amp: { model, gain: 5, bass: 5, mid: 5, treble: 5, presence: 5, depth: 5, master: 5, bright: false, tight: false },
    cab: { model: "4x12-closed", on: true, micPosition: 3, micDistance: 2 },
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
    },
    effects: orderEffects(effects),
    ...(typeof device.slug === "string" && /^[a-z0-9-]{1,40}$/.test(device.slug) && { device: { slug: device.slug, ampSlot: toNum(device.ampSlot, 1, 1, 99) } }),
  };
}

// ── Factory starting points (not stored until someone saves one) ───────

const fx = (type: EffectType, params: Record<string, number> = {}, voice?: string): Effect => {
  const e = newEffect(type, `factory-${type}`);
  return { ...e, ...(voice && { voice }), params: { ...e.params, ...params } };
};

export const FACTORY_PRESETS: { id: string; name: string; patch: StudioPatch }[] = [
  { id: "halcyon-crunch", name: "Halcyon · Edge of breakup", patch: { ...defaultPatch("halcyon"), amp: { ...defaultPatch("halcyon").amp, gain: 4.5, mid: 6, presence: 5.5 }, effects: [fx("reverb", { decay: 3, mix: 2 }, "Room")] } },
  { id: "basalt-rhythm", name: "Basalt · Tight rhythm", patch: { ...defaultPatch("basalt"), gate: { on: true, threshold: -58 }, amp: { ...defaultPatch("basalt").amp, gain: 7, bass: 5.5, mid: 4, treble: 6, presence: 6, depth: 6, tight: true }, effects: [fx("overdrive", { drive: 1, tone: 6, level: 8 })] } },
  { id: "gilded-lead", name: "Kintsugi · Singing lead", patch: { ...defaultPatch("gilded"), amp: { ...defaultPatch("gilded").amp, gain: 6.5, mid: 6.5, treble: 5.5 }, effects: [fx("delay", { time: 5, feedback: 4, mix: 3 }, "Tape"), fx("reverb", { decay: 5, mix: 3 }, "Spring")] } },
  { id: "lumen-glass", name: "Lumen · Glass clean", patch: { ...defaultPatch("lumen"), cab: { model: "2x12-open", on: true, micPosition: 4, micDistance: 3 }, amp: { ...defaultPatch("lumen").amp, gain: 3, treble: 6, bright: true }, effects: [fx("compressor", { sustain: 4, level: 6 }), fx("chorus", { rate: 2, depth: 4, mix: 4 }), fx("reverb", { decay: 6, mix: 4 }, "Cloud")] } },
  { id: "prism-bloom", name: "Prism · Octave bloom", patch: { ...defaultPatch("prism"), cab: { model: "1x12-open", on: true, micPosition: 2, micDistance: 2 }, amp: { ...defaultPatch("prism").amp, gain: 6, mid: 6.5, presence: 4 }, effects: [fx("phaser", { rate: 2, depth: 5 }), fx("delay", { time: 6, feedback: 5, mix: 3 }, "Dual")] } },
];
