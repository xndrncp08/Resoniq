import type { AmpModelId, CabModelId } from "@/lib/studio/patch";

/**
 * The math behind the studio's audio, kept free of Web Audio so it can be
 * tested. Everything here is Resoniq's own: a two-stage waveshaper "amp"
 * with filter voicings, filter-based cabinets and generated reverb
 * impulses. None of it models a real amplifier, pedal or speaker.
 */

export type Curve = "soft" | "asym" | "hard" | "fuzz";

export type Voicing = {
  /** Total drive at gain 0 and gain 10 (exponential between). */
  drive: [number, number];
  stage1: Curve;
  stage2: Curve;
  /** 0..1 blend of full-wave rectification into stage 2 (octave-up shimmer). */
  rectify: number;
  /** Pre-drive mid push. */
  midHz: number;
  midDb: number;
  /** Low cut between stages; Tight raises it. */
  interstageHz: number;
  tightHz: number;
  /** Tone-stack mid centre. */
  stackMidHz: number;
  /** Fizz roll-off after the second stage. */
  lowpassHz: number;
};

export const VOICINGS: Record<AmpModelId, Voicing> = {
  halcyon: { drive: [1, 45], stage1: "asym", stage2: "soft", rectify: 0, midHz: 800, midDb: 3, interstageHz: 70, tightHz: 150, stackMidHz: 750, lowpassHz: 7500 },
  basalt: { drive: [2, 420], stage1: "hard", stage2: "hard", rectify: 0, midHz: 1400, midDb: 2, interstageHz: 90, tightHz: 180, stackMidHz: 650, lowpassHz: 6500 },
  gilded: { drive: [1, 90], stage1: "soft", stage2: "asym", rectify: 0, midHz: 1000, midDb: 4, interstageHz: 60, tightHz: 140, stackMidHz: 900, lowpassHz: 8000 },
  lumen: { drive: [0.35, 5], stage1: "soft", stage2: "soft", rectify: 0, midHz: 600, midDb: 0, interstageHz: 40, tightHz: 120, stackMidHz: 600, lowpassHz: 11000 },
  prism: { drive: [2, 140], stage1: "fuzz", stage2: "soft", rectify: 0.35, midHz: 900, midDb: 3, interstageHz: 80, tightHz: 160, stackMidHz: 900, lowpassHz: 7000 },
};

/** Gain knob (0–10) → total drive, split across the two stages (first stage does more). */
export function stageDrives(v: Voicing, gain: number): [number, number] {
  const [lo, hi] = v.drive;
  const total = lo * Math.pow(hi / lo, Math.max(0, Math.min(10, gain)) / 10);
  return [Math.pow(total, 0.6), Math.pow(total, 0.4)];
}

/** A transfer curve for a WaveShaperNode. Drive lives in the curve (inputs beyond ±1 would just clip). */
export function shaperCurve(curve: Curve, drive: number, rectify = 0, points = 2048): Float32Array<ArrayBuffer> {
  const out = new Float32Array(points);
  const d = Math.max(0.05, drive);
  const norm = (f: (x: number) => number) => {
    const peak = Math.max(Math.abs(f(1)), Math.abs(f(-1)), 1e-6);
    return (x: number) => f(x) / peak;
  };
  const shapes: Record<Curve, (x: number) => number> = {
    soft: (x) => Math.tanh(d * x),
    // Positive half clips harder than negative: even harmonics, like a single-ended stage.
    asym: (x) => (x >= 0 ? Math.tanh(d * x) : 0.85 * Math.tanh(0.7 * d * x)),
    hard: (x) => (2 / Math.PI) * Math.atan(2.2 * d * x),
    fuzz: (x) => Math.sign(x) * (1 - Math.exp(-1.6 * d * Math.abs(x))),
  };
  const f = norm(shapes[curve]);
  for (let i = 0; i < points; i++) {
    const x = (i / (points - 1)) * 2 - 1;
    const y = f(x);
    // Rectification folds the wave upward (an octave up); the interstage low cut removes the DC it adds.
    out[i] = rectify > 0 ? (1 - rectify) * y + rectify * (Math.abs(y) * 2 - 1) : y;
  }
  return out;
}

/** Tone-stack knob (0–10, 5 = flat) → dB. */
export const stackDb = (knob: number, range = 12) => ((Math.max(0, Math.min(10, knob)) - 5) / 5) * range;
/** Level-style knob (master): 5 is unity, ±15 dB at the ends. */
export const masterDb = (knob: number) => (Math.max(0, Math.min(10, knob)) - 5) * 3;
export const dbToGain = (db: number) => Math.pow(10, db / 20);
/** Exponential knob mapping between two positive values. */
export const expMap = (knob: number, lo: number, hi: number) => lo * Math.pow(hi / lo, Math.max(0, Math.min(10, knob)) / 10);

export type CabVoicing = { highpassHz: number; thumpDb: number; midHz: number; midDb: number; lowpassHz: number };
export const CAB_VOICINGS: Record<CabModelId, CabVoicing> = {
  "4x12-closed": { highpassHz: 75, thumpDb: 4, midHz: 2500, midDb: 3, lowpassHz: 5500 },
  "2x12-open": { highpassHz: 90, thumpDb: 1.5, midHz: 1800, midDb: 2, lowpassHz: 6500 },
  "1x12-open": { highpassHz: 105, thumpDb: 0.5, midHz: 1200, midDb: 2.5, lowpassHz: 5000 },
};

/**
 * Mic placement: toward the speaker's edge (10) darkens the top end; backing
 * off (10) loses the close-mic bass build-up.
 */
export function micFilters(position: number, distance: number) {
  const p = Math.max(0, Math.min(10, position)) / 10;
  const d = Math.max(0, Math.min(10, distance)) / 10;
  return { lowpassScale: 1 - 0.45 * p, presenceDb: 3 - 6 * p, proximityDb: 4 - 6 * d };
}

/**
 * A reverb impulse: decaying noise shaped per voice. Room is short and dense,
 * Spring adds a periodic metallic flutter, Cloud swells in slowly. Stereo, so
 * the tail spreads across both speakers.
 */
export function reverbImpulse(voice: string, seconds: number, sampleRate: number, seed = 1): [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] {
  const n = Math.max(1, Math.round(seconds * sampleRate));
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const channels: [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] = [new Float32Array(n), new Float32Array(n)];
  for (const ch of channels) {
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sampleRate;
      let env = Math.exp((-6.9 * t) / seconds); // −60 dB at `seconds`
      let x = rand();
      if (voice === "Spring") x *= 1 + 0.6 * Math.sin(2 * Math.PI * 34 * t);
      if (voice === "Cloud") {
        env *= 1 - Math.exp(-t / 0.18);
        lp += 0.25 * (x - lp);
        x = lp * 2.2;
      }
      if (voice === "Room" && t < 0.06) env *= 0.6 + 0.4 * Math.sin(t * 900);
      ch[i] = x * env;
    }
  }
  return channels;
}

/**
 * A short synthesized DI guitar riff (Karplus-Strong plucked strings): palm-
 * muted chugs, power chords and a little lead, so the chain can be heard
 * without uploading anything. Peaks around −6 dBFS, like a real DI.
 */
export function demoRiff(sampleRate: number, bpm = 112): Float32Array<ArrayBuffer> {
  const beat = 60 / bpm;
  const E2 = 82.41;
  const st = (n: number) => E2 * Math.pow(2, n / 12);
  type Note = { at: number; freqs: number[]; len: number; mute: boolean };
  const notes: Note[] = [];
  const chug = (bar: number, root: number) => {
    for (let i = 0; i < 6; i++) notes.push({ at: bar * 4 * beat + i * beat * 0.5, freqs: [st(root), st(root + 7)], len: beat * 0.45, mute: true });
    notes.push({ at: bar * 4 * beat + 3 * beat, freqs: [st(root), st(root + 7), st(root + 12)], len: beat * 1.2, mute: false });
  };
  chug(0, 0); chug(1, 3); chug(2, 5); chug(3, -2);
  [12, 15, 17, 19, 17, 15, 12, 10].forEach((n, i) => notes.push({ at: 16 * beat + i * beat * 0.5, freqs: [st(n + 12)], len: beat * 0.5, mute: false }));
  notes.push({ at: 20 * beat, freqs: [st(0), st(7), st(12)], len: beat * 3.5, mute: false });
  const total = Math.ceil((24 * beat) * sampleRate);
  const out = new Float32Array(total);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (const note of notes) {
    for (const [k, f] of note.freqs.entries()) {
      const period = Math.max(2, Math.round(sampleRate / f));
      const line = new Float32Array(period);
      for (let i = 0; i < period; i++) line[i] = rand();
      const damp = note.mute ? 0.965 : 0.996;
      const start = Math.round((note.at + k * 0.006) * sampleRate);
      const len = Math.round(note.len * sampleRate);
      let idx = 0;
      for (let i = 0; i < len && start + i < total; i++) {
        const next = (idx + 1) % period;
        const v = line[idx];
        line[idx] = damp * 0.5 * (v + line[next]);
        idx = next;
        // A short fade at the end of each note avoids clicks.
        const fade = Math.min(1, (len - i) / (0.01 * sampleRate));
        out[start + i] += v * 0.35 * fade;
      }
    }
  }
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const gain = 0.5 / (peak || 1);
  for (let i = 0; i < total; i++) out[i] *= gain;
  return out;
}

/** RMS and peak of a block, in dBFS (−100 floor). */
export function levelDb(block: Float32Array): { rms: number; peak: number } {
  let sum = 0;
  let peak = 0;
  for (const v of block) {
    sum += v * v;
    peak = Math.max(peak, Math.abs(v));
  }
  const db = (x: number) => (x > 1e-5 ? 20 * Math.log10(x) : -100);
  return { rms: db(Math.sqrt(sum / Math.max(1, block.length))), peak: db(peak) };
}
