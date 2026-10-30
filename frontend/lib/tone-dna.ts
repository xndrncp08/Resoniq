import { CAB_VOICINGS, SPEAKER_VOICINGS, VOICINGS, micFilters, stageDrives } from "@/lib/studio/dsp";
import type { Effect, EffectType, StudioPatch } from "@/lib/studio/patch";
import type { EngineAnalysis } from "@/types/engine";

/**
 * Tone DNA: a seven-axis fingerprint of a sound, estimated from its settings
 * (the studio patch any tone opens as), so every tone has one and two tones
 * can be compared. It describes what the settings do in Resoniq's own audio
 * engine; it is not a measurement of a recording (see measuredCharacter).
 */
export const DNA_AXES = [
  { key: "drive", label: "Drive", low: "Clean", high: "Saturated" },
  { key: "low", label: "Low end", low: "Lean", high: "Heavy" },
  { key: "mid", label: "Mids", low: "Scooped", high: "Forward" },
  { key: "bright", label: "Brightness", low: "Dark", high: "Bright" },
  { key: "space", label: "Space", low: "Dry", high: "Washed" },
  { key: "motion", label: "Motion", low: "Still", high: "Moving" },
  { key: "squeeze", label: "Compression", low: "Open", high: "Squashed" },
] as const;
export type DnaKey = (typeof DNA_AXES)[number]["key"];
export type ToneDna = Record<DnaKey, number>;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const r2 = (v: number) => Math.round(clamp01(v) * 100) / 100;
const k = (v: number) => (v - 5) / 5; // knob 0–10 → −1…1

export function dnaFromPatch(p: StudioPatch): ToneDna {
  const v = VOICINGS[p.amp.model];
  const on = (t: EffectType) => p.effects.filter((e) => e.on && e.type === t);
  const sum = (list: Effect[], f: (e: Effect) => number) => list.reduce((s, e) => s + f(e), 0);
  const pre = p.effects.filter((e) => e.on && e.placement === "pre");

  // Drive: the amp's total gain on a log scale (Resoniq's hottest amp ≈ 1), plus drive pedals in front of it.
  const [d1, d2] = stageDrives(v, p.amp.gain);
  const pedalDrive = sum(pre, (e) => ({ overdrive: 0.15, distortion: 0.3, fuzz: 0.35, boost: 0.06 } as Partial<Record<EffectType, number>>)[e.type] ?? 0)
    + sum(pre.filter((e) => ["overdrive", "distortion", "fuzz"].includes(e.type)), (e) => (e.params.drive / 10) * 0.1);
  const drive = clamp01(Math.log(Math.max(1, d1 * d2)) / Math.log(700) + pedalDrive);

  const cv = CAB_VOICINGS[p.cab.model];
  const sv = SPEAKER_VOICINGS[p.cab.speaker];
  const mic = micFilters(p.cab.micPosition, p.cab.micDistance, p.cab.mic);
  const eq = on("eq");
  const eqBand = (keys: string[]) => sum(eq, (e) => keys.reduce((s, key) => s + k(e.params[key]), 0) / keys.length);

  const low = 0.5 + k(p.amp.bass) * 0.3 + k(p.amp.depth) * 0.15 + (p.cab.on ? cv.thumpDb / 20 + sv.lowDb / 16 + mic.proximityDb / 24 : -0.05) - (p.amp.tight ? 0.08 : 0) + eqBand(["b100", "b250"]) * 0.15;
  const mid = 0.5 + k(p.amp.mid) * 0.35 + v.midDb / 20 + (sv.peakHz < 1500 ? sv.peakDb / 20 : 0) + eqBand(["b500", "b1k"]) * 0.15 - sum(on("fuzz"), () => 0.08);
  const presence = v.cutControl ? -k(p.amp.presence) : k(p.amp.presence);
  const lowpass = p.cab.on ? cv.lowpassHz * sv.lowpassScale * mic.lowpassScale : 9000;
  const bright = 0.5 + k(p.amp.treble) * 0.25 + presence * 0.12 + (p.amp.bright ? 0.08 : 0) + Math.log2(lowpass / 5500) * 0.25 + eqBand(["b2k", "b4k"]) * 0.15;

  const space = sum(on("reverb"), (e) => (e.params.mix / 10) * (0.55 + e.params.decay / 20)) + sum(on("delay"), (e) => (e.params.mix / 10) * (0.45 + e.params.feedback / 20));
  const motion = sum(on("chorus"), (e) => (e.params.mix / 10) * (0.3 + e.params.depth / 14))
    + sum(on("flanger"), (e) => (e.params.mix / 10) * (0.4 + e.params.depth / 14))
    + sum(on("phaser"), (e) => 0.3 + e.params.depth / 16)
    + sum(on("tremolo"), (e) => e.params.depth / 10)
    + sum(on("wah").filter((e) => e.voice === "Auto"), (e) => 0.3 + e.params.depth / 16);
  const squeeze = sum(on("compressor"), (e) => 0.2 + (e.params.sustain / 10) * 0.5) + drive * 0.35;

  return { drive: r2(drive), low: r2(low), mid: r2(mid), bright: r2(bright), space: r2(space), motion: r2(motion), squeeze: r2(squeeze) };
}

/** 0–100: how alike two fingerprints are (100 = identical; 0 = an axis-wide RMS gap of 0.5 or more). */
export function dnaMatch(a: ToneDna, b: ToneDna): number {
  const rms = Math.sqrt(DNA_AXES.reduce((s, { key }) => s + (a[key] - b[key]) ** 2, 0) / DNA_AXES.length);
  return Math.round(Math.max(0, 1 - rms / 0.5) * 100);
}

/** The axes where two sounds differ most, for "why it's similar / different". */
export function dnaDifferences(a: ToneDna, b: ToneDna, n = 2) {
  return DNA_AXES.map((ax) => ({ ...ax, delta: b[ax.key] - a[ax.key] }))
    .filter((d) => Math.abs(d.delta) >= 0.12)
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
    .slice(0, n)
    .map((d) => `${d.delta > 0 ? "more" : "less"} ${d.label.toLowerCase()}`);
}

/** Measured from the analysed recording (the mix, not the guitar alone). Null when there's no analysis. */
export type MeasuredCharacter = { centroidHz: number; lowDb: number; midDb: number; highDb: number; rmsDb: number };
export function measuredCharacter(analysis: EngineAnalysis | null | undefined): MeasuredCharacter | null {
  const main = analysis?.sections?.find((s) => s.id === analysis.main_section) ?? analysis?.sections?.[0];
  const c = main?.character;
  if (!c || ![c.centroid_hz, c.low_db, c.mid_db, c.high_db, c.rms_db].every(Number.isFinite)) return null;
  return { centroidHz: Math.round(c.centroid_hz), lowDb: c.low_db, midDb: c.mid_db, highDb: c.high_db, rmsDb: c.rms_db };
}
