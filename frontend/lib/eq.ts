import type { AmpSettings } from "@/types/tone";

/**
 * The amp EQ model shared by the audible preview (Web Audio
 * BiquadFilterNodes in SignalMonitor) and the drawn EQ curve, so the curve
 * shows what you hear.
 *
 * Filters follow the RBJ Audio EQ Cookbook, which is what the Web Audio
 * spec specifies for BiquadFilterNode (shelves with S = 1, peaking with Q).
 * It's a rough stand-in for an amp's tone stack, not a model of a specific
 * circuit: real tone stacks interact and aren't centered at "flat".
 */

export type BandKey = "bass" | "mids" | "treble" | "presence";

export type Band = {
  key: BandKey;
  type: "lowshelf" | "peaking" | "highshelf";
  frequency: number;
  q: number;
};

export const BANDS: Band[] = [
  { key: "bass", type: "lowshelf", frequency: 120, q: 0.707 },
  { key: "mids", type: "peaking", frequency: 750, q: 0.8 },
  { key: "treble", type: "highshelf", frequency: 3000, q: 0.707 },
  { key: "presence", type: "peaking", frequency: 4500, q: 1.1 },
];

/** Knob range in dB either side of noon (knob 50 = flat). */
export const MAX_DB = 12;
export const MIN_HZ = 20;
export const MAX_HZ = 20000;

export const knobToDb = (knob: number) => ((Math.max(0, Math.min(100, knob)) - 50) / 50) * MAX_DB;

export type EqGains = Record<BandKey, number>;

export function gainsFromAmp(amp: Pick<AmpSettings, BandKey>): EqGains {
  return {
    bass: knobToDb(amp.bass),
    mids: knobToDb(amp.mids),
    treble: knobToDb(amp.treble),
    presence: knobToDb(amp.presence),
  };
}

type Coefficients = [b0: number, b1: number, b2: number, a0: number, a1: number, a2: number];

function coefficients(band: Band, gainDb: number, sampleRate: number): Coefficients {
  const A = 10 ** (gainDb / 40);
  const w0 = (2 * Math.PI * band.frequency) / sampleRate;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);

  if (band.type === "peaking") {
    const alpha = sin / (2 * band.q);
    return [1 + alpha * A, -2 * cos, 1 - alpha * A, 1 + alpha / A, -2 * cos, 1 - alpha / A];
  }

  // Shelves with slope S = 1, as the Web Audio spec defines them.
  const alpha = (sin / 2) * Math.SQRT2;
  const k = 2 * Math.sqrt(A) * alpha;
  if (band.type === "lowshelf") {
    return [
      A * (A + 1 - (A - 1) * cos + k),
      2 * A * (A - 1 - (A + 1) * cos),
      A * (A + 1 - (A - 1) * cos - k),
      A + 1 + (A - 1) * cos + k,
      -2 * (A - 1 + (A + 1) * cos),
      A + 1 + (A - 1) * cos - k,
    ];
  }
  return [
    A * (A + 1 + (A - 1) * cos + k),
    -2 * A * (A - 1 + (A + 1) * cos),
    A * (A + 1 + (A - 1) * cos - k),
    A + 1 - (A - 1) * cos + k,
    2 * (A - 1 - (A + 1) * cos),
    A + 1 - (A - 1) * cos - k,
  ];
}

/** |H(f)| of one biquad, in dB. */
function magnitudeDb([b0, b1, b2, a0, a1, a2]: Coefficients, frequency: number, sampleRate: number): number {
  const w = (2 * Math.PI * frequency) / sampleRate;
  const c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
  const numRe = b0 + b1 * c1 + b2 * c2;
  const numIm = -(b1 * s1 + b2 * s2);
  const denRe = a0 + a1 * c1 + a2 * c2;
  const denIm = -(a1 * s1 + a2 * s2);
  return 10 * Math.log10((numRe ** 2 + numIm ** 2) / (denRe ** 2 + denIm ** 2));
}

export const logFrequencies = (points: number) =>
  Array.from({ length: points }, (_, i) => MIN_HZ * (MAX_HZ / MIN_HZ) ** (i / (points - 1)));

/** Combined response of all bands in dB at each frequency. */
export function responseDb(gains: EqGains, frequencies: number[], sampleRate = 48000): number[] {
  const coeffs = BANDS.map((b) => coefficients(b, gains[b.key], sampleRate));
  return frequencies.map((f) => coeffs.reduce((sum, c) => sum + magnitudeDb(c, f, sampleRate), 0));
}

/** x position (0..1) of a frequency on the log axis. */
export const xForHz = (hz: number) => Math.log(hz / MIN_HZ) / Math.log(MAX_HZ / MIN_HZ);
