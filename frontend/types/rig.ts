/**
 * A creator-declared rig: what someone says they actually played through.
 * Every part is optional — a rig can be one pedal or a full signal chain.
 * Distinct from RecipeCore, which is what Resoniq's analysis inferred.
 */

/** Catalog gear by id, or custom gear by name. Custom gear never enters the catalog by itself. */
export type GearRef = { gearId?: string; brand?: string; model: string };

export const INSTRUMENT_KINDS = ["GUITAR", "BASS"] as const;
export type InstrumentKind = (typeof INSTRUMENT_KINDS)[number];

export const BLOCK_CATEGORIES = [
  "boost", "drive", "distortion", "fuzz", "compressor", "eq", "gate", "wah", "filter", "pitch", "octave",
  "modulation", "chorus", "phaser", "flanger", "tremolo", "vibrato", "delay", "reverb", "volume", "looper",
  "amp-sim", "cab-sim", "ir", "multi", "utility",
] as const;
export type BlockCategory = (typeof BLOCK_CATEGORIES)[number];

export type RigInstrument = {
  kind: InstrumentKind;
  ref?: GearRef;
  strings?: string;
  tuning?: string;
  pickups?: string[];
  pickupPosition?: string;
  notes?: string;
};

/** Amp knobs on the 0–10 scale printed on real panels. */
export type RigAmp = { ref?: GearRef; channel?: string; settings: Record<string, number> };
export type RigCab = { ref?: GearRef; speakers?: string; mic?: string };

/** One block in the chain, in signal order. Params are knob name → value (number or a switch label). */
export type RigBlock = {
  id: string;
  category: BlockCategory;
  ref?: GearRef;
  enabled: boolean;
  /** Where it sits relative to the amp: front of amp, or effects loop / after the amp. */
  placement: "pre" | "loop";
  params: Record<string, number | string>;
};

export type RigSpec = {
  instrument?: RigInstrument;
  amp?: RigAmp;
  cab?: RigCab;
  chain: RigBlock[];
  /** Global EQ in dB per band label, e.g. { "100Hz": 2, "800Hz": -3 }. */
  eq?: Record<string, number>;
  notes?: string;
  setupGuide?: string;
  alternatives?: string[];
  references?: { songs?: string[]; artists?: string[]; genres?: string[]; styles?: string[] };
};
