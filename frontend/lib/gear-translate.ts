import type { RecipeCore } from "@/types/tone";
import { knobToDb } from "@/lib/eq";
import { clock, TANK_G_AMPS } from "@/lib/devices/tank-g";
import { classifyEffect } from "@/lib/effectConfig";

/**
 * Turns a recipe into settings for the gear someone actually owns. Profiles
 * describe kinds of equipment, not brands, so they fit whatever is on the
 * floor; a specific device (the TANK-G) gets its own panel. Every setting
 * carries the measurement behind it, and everything is a starting point:
 * a full mix can't reveal the exact rig.
 */

export const GEAR_PROFILES = [
  { id: "amp-3band", name: "Amp: gain, 3-band EQ, master", hint: "Most heads and combos" },
  { id: "amp-2band", name: "Amp: volume, bass, treble", hint: "Practice and vintage-style amps" },
  { id: "modeler", name: "Modeler or multi-effects", hint: "Floor units and desktop modelers" },
  { id: "daw", name: "Plugins in a DAW", hint: "Amp sim, IR loader, stock effects" },
  { id: "tank-g", name: "M-VAVE TANK-G", hint: "9 amps, fixed effects" },
  { id: "bass", name: "Bass amp or preamp", hint: "Gain and a 3–4 band EQ" },
] as const;
export type GearProfileId = (typeof GEAR_PROFILES)[number]["id"];
export const isGearProfile = (v: unknown): v is GearProfileId => GEAR_PROFILES.some((g) => g.id === v);

export type Step = { control: string; setting: string; why?: string };
export type Translation = { steps: Step[]; notes: string[]; link?: { href: string; label: string } };

export type Measured = { centroid_hz?: number | null; brightness?: number | null; saturation?: number | null; estimated_reverb_tail_s?: number | null; modulation_rate_hz?: number | null; tempo_bpm?: number | null };

const ten = (v: number) => Math.round(Math.max(0, Math.min(100, v))) / 10;
const pos = (v: number) => `${ten(v).toFixed(1)} (≈${clock(ten(v))})`;
const signed = (db: number) => `${db > 0 ? "+" : ""}${db.toFixed(1)} dB`;

function gainWhy(r: RecipeCore, m: Measured) {
  const sat = m.saturation ?? null;
  return sat === null ? `Estimated gain around ${r.amp.gain}%.` : `Saturation measured at ${(sat * 100).toFixed(0)}% of the clean-to-high-gain range.`;
}
function trebleWhy(m: Measured) {
  if (!m.centroid_hz) return undefined;
  const hz = Math.round(m.centroid_hz);
  return hz > 2600 ? `The mix is bright: its spectral centre sits near ${hz} Hz.` : hz < 1500 ? `The mix is dark: its spectral centre sits near ${hz} Hz.` : `Spectral centre near ${hz} Hz, a balanced top end.`;
}

type Fx = { kind: "drive" | "dynamics" | "mod" | "delay" | "reverb"; name: string; on: boolean };
function effects(r: RecipeCore): Fx[] {
  return r.pedalboard.map((p) => {
    const n = p.name.toLowerCase();
    const t = classifyEffect(p.name);
    const kind: Fx["kind"] = /reverb|verb|spring|hall|room|plate/.test(n) ? "reverb" : /delay|echo/.test(n) ? "delay" : t === "drive" ? "drive" : t === "dynamics" ? "dynamics" : "mod";
    return { kind, name: p.name, on: p.enabled };
  });
}

function fxSteps(r: RecipeCore, m: Measured): Step[] {
  return effects(r).filter((f) => f.on).map((f) => {
    if (f.kind === "reverb") return { control: "Reverb", setting: m.estimated_reverb_tail_s ? `Decay about ${m.estimated_reverb_tail_s.toFixed(1)} s, mix low to medium` : "Short room, mix low", why: "A reverb tail was measured after the last notes." };
    if (f.kind === "delay") return { control: "Delay", setting: m.tempo_bpm ? `Try a quarter note at ${Math.round(m.tempo_bpm)} BPM (${Math.round(60000 / m.tempo_bpm)} ms), 2–3 repeats` : "300–450 ms, 2–3 repeats, mix low", why: m.tempo_bpm ? `Tempo estimated at ${Math.round(m.tempo_bpm)} BPM.` : undefined };
    if (f.kind === "mod") return { control: f.name, setting: m.modulation_rate_hz ? `Rate near ${m.modulation_rate_hz.toFixed(1)} Hz, depth moderate` : "Slow rate, moderate depth", why: m.modulation_rate_hz ? `A level wobble near ${m.modulation_rate_hz.toFixed(1)} Hz was measured (could also be the playing rhythm).` : undefined };
    if (f.kind === "dynamics") return { control: "Compressor", setting: "Medium sustain, level to unity", why: "The level stays unusually even." };
    return { control: f.name, setting: "Low drive, level up, as a push into the amp", why: "The analysis suggests a drive stage." };
  });
}

function tankGSlot(r: RecipeCore) {
  const text = `${r.amp.family} ${r.amp.model}`.toLowerCase();
  const g = r.amp.gain;
  if (g < 35) return /vox|chime|ac/.test(text) ? 1 : 2;
  if (g < 65) return /boutique|dumble|two-rock/.test(text) ? 3 : /jtm|tweed/.test(text) ? 4 : 5;
  return /5150|lead/.test(text) ? 7 : /metal|rectifier|djent/.test(text) ? 9 : g > 85 ? 8 : 6;
}

export function translate(r: RecipeCore, gear: GearProfileId, m: Measured): Translation {
  const a = r.amp;
  const cab = r.cabinet.type;
  const fx = fxSteps(r, m);
  const caveat = "A starting point from a full mix: set these, then adjust by ear with your guitar and room.";
  switch (gear) {
    case "amp-3band":
      return {
        steps: [
          { control: "Gain", setting: pos(a.gain), why: gainWhy(r, m) },
          { control: "Bass", setting: pos(a.bass) },
          { control: "Middle", setting: pos(a.mids) },
          { control: "Treble", setting: pos(a.treble), why: trebleWhy(m) },
          { control: "Presence", setting: pos(a.presence), why: "If your amp has one; otherwise fold it into treble." },
          { control: "Master", setting: "For volume", why: "On a tube amp, more master adds compression and feel." },
          ...fx,
        ],
        notes: [`Played through a ${cab} cab in the estimate; a smaller cab reads brighter, so take treble down a little.`, caveat],
      };
    case "amp-2band": {
      const drive = a.gain > 45;
      return {
        steps: [
          { control: "Volume", setting: drive ? "Loud enough to break up, or clean with a drive pedal in front" : pos(Math.max(a.gain, 30)), why: gainWhy(r, m) },
          { control: "Bass", setting: pos(a.mids > 60 ? a.bass - 10 : a.bass), why: a.mids > 60 ? "Slightly lower: with no mid knob, less bass and treble leaves the mids forward." : undefined },
          { control: "Treble", setting: pos(a.mids > 60 ? a.treble - 10 : a.treble), why: trebleWhy(m) },
          ...(drive ? [{ control: "Drive pedal", setting: `Drive ${pos(a.gain - 20)}, level above unity`, why: "This sound has more gain than a two-knob amp usually gives on its own." }] : []),
          ...fx,
        ],
        notes: [caveat],
      };
    }
    case "modeler":
      return {
        steps: [
          { control: "Amp block", setting: `A ${a.gain > 65 ? "modern high-gain" : a.gain > 35 ? "British-style crunch" : "American-style clean"} model, gain ${ten(a.gain).toFixed(1)}/10`, why: "Character estimated from the measured gain and brightness; nearly every unit has a model like this." },
          { control: "Amp EQ", setting: `Bass ${ten(a.bass).toFixed(1)}, Mid ${ten(a.mids).toFixed(1)}, Treble ${ten(a.treble).toFixed(1)}, Presence ${ten(a.presence).toFixed(1)}`, why: trebleWhy(m) },
          { control: "Cab block", setting: `${cab}, dynamic mic between cap and edge` },
          ...fx,
        ],
        notes: ["Block names differ by brand; match the character, not the name.", caveat],
      };
    case "daw":
      return {
        steps: [
          { control: "Amp sim", setting: `${a.gain > 65 ? "High-gain" : a.gain > 35 ? "Crunch" : "Clean"} amp, drive about ${a.gain}%`, why: gainWhy(r, m) },
          { control: "IR loader", setting: `${cab} IR` },
          { control: "EQ: low shelf 120 Hz", setting: signed(knobToDb(a.bass)) },
          { control: "EQ: bell 750 Hz, Q 0.8", setting: signed(knobToDb(a.mids)) },
          { control: "EQ: high shelf 3 kHz", setting: signed(knobToDb(a.treble)), why: trebleWhy(m) },
          { control: "EQ: bell 4.5 kHz", setting: signed(knobToDb(a.presence)) },
          ...fx,
        ],
        notes: ["These EQ moves are the same model the Amp Studio plays back.", caveat],
      };
    case "tank-g": {
      const slot = tankGSlot(r);
      const amp = TANK_G_AMPS.find((x) => x.slot === slot)!;
      const fxs = effects(r).filter((f) => f.on);
      const has = (k: Fx["kind"]) => fxs.find((f) => f.kind === k);
      const mod = has("mod");
      return {
        steps: [
          { control: "TYPE", setting: `Slot ${slot} · ${amp.voicing}`, why: `Closest ${amp.gain} voicing to the estimated ${a.gain}% gain.` },
          { control: "GAIN", setting: pos(a.gain), why: gainWhy(r, m) },
          { control: "TREBLE", setting: pos(a.treble), why: trebleWhy(m) },
          { control: "MIDDLE", setting: pos(a.mids) },
          { control: "BASS", setting: pos(a.bass) },
          { control: "VOLUME", setting: "6.0 (≈1:00)" },
          { control: "MOD FX", setting: mod ? `${/phas/i.test(mod.name) ? "Phaser" : /trem/i.test(mod.name) ? "Tremolo" : "Chorus"} zone, low` : "Off (between zones)" },
          { control: "DLY MIX", setting: has("delay") ? "First zone (Analog), about a third of the zone" : "Off (between zones)" },
          { control: "RVB DECAY", setting: has("reverb") ? `${(m.estimated_reverb_tail_s ?? 1) > 2.5 ? "Cloud" : "Room"} zone` : "Off (between zones)", why: has("reverb") && m.estimated_reverb_tail_s ? `Tail measured near ${m.estimated_reverb_tail_s.toFixed(1)} s.` : undefined },
          { control: "IR CAB", setting: `A ${cab} IR slot` },
          ...(has("drive") ? [{ control: "Drive", setting: "No drive pedal on the unit: add 0.5–1.0 of gain instead" }] : []),
          ...(has("dynamics") ? [{ control: "Compressor", setting: "Not available on the unit; keep VOLUME steady" }] : []),
        ],
        notes: ["Values are 0–10 knob positions on the pedal's unscaled panel.", caveat],
        link: { href: `/gear/m-vave-tank-g?amp=${slot}`, label: `TANK-G presets on slot ${slot}` },
      };
    }
    case "bass":
      return {
        steps: [
          { control: "Gain", setting: pos(Math.min(a.gain, 70)), why: "Bass rigs clip sooner; this keeps the low end solid." },
          { control: "Bass", setting: pos(a.bass) },
          { control: "Low-mid / Mid", setting: pos(a.mids) },
          { control: "Treble", setting: pos(a.treble), why: trebleWhy(m) },
          ...fx.filter((s) => s.control === "Compressor" || s.control.toLowerCase().includes("drive")),
        ],
        notes: ["The analysis is tuned for guitar; on bass, trust the EQ balance more than the gain estimate.", caveat],
      };
  }
}

/** Plain text for copying to a phone or a note at the rig. */
export function translationText(title: string, gearName: string, t: Translation) {
  return [`${title} — ${gearName}`, "", ...t.steps.map((s) => `${s.control}: ${s.setting}`), "", ...t.notes].join("\n");
}
