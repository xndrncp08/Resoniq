import type { RecipeCore } from "@/types/tone";
import type { RigSpec } from "@/types/rig";
import { isTankG } from "@/lib/devices/tank-g";
import { cabFromSpeakers, constrainToDevice, patchFromTankG, TANK_G_STUDIO } from "@/lib/studio/devices";
import { defaultPatch, knob10, newEffect, normalizeStudioPatch, orderEffects, MAX_EFFECTS, type AmpModelId, type Effect, type EffectType, type StudioPatch } from "@/lib/studio/patch";

/**
 * Opens anything Resoniq knows about a sound in the studio: a saved studio
 * patch as-is, a device preset in device mode, or a starting point built from
 * an analysis recipe or a declared rig. The mapping to a studio amp design is
 * a choice of voicing, not a claim about the original amp.
 */

export function modelFor(text: string, gain0to10: number): AmpModelId {
  if (/tweed|bassman|5e3|champ/i.test(text)) return "juniper";
  if (/vox|ac-?(15|30)|top.?boost|class.?a/i.test(text)) return "bellwether";
  if (/mesa|mark ?(ii|iv|v)\b|djent|uberschall|fortin/i.test(text)) return "foundry";
  if (/dumble|overdrive special|ods\b/i.test(text)) return "monarch";
  if (/jc-?120|roland|solid.?state|hiwatt/i.test(text) && gain0to10 < 5) return "atlas";
  if (/5150|rectifier|metal|modern|high.?gain|powerball/i.test(text)) return "basalt";
  if (/boutique|two-rock|bogner/i.test(text)) return "gilded";
  if (/fender|blackface|twin|jazz|clean/i.test(text) && gain0to10 < 5) return "lumen";
  if (/plexi|marshall|jcm|jtm|crunch|vox|ac-?30|tweed|british/i.test(text)) return "halcyon";
  return gain0to10 > 6.5 ? "basalt" : gain0to10 < 3 ? "lumen" : "halcyon";
}

export function effectFromName(name: string, kind: string): EffectType | null {
  const n = `${name} ${kind}`.toLowerCase();
  if (/reverb|verb|spring|hall|room|plate|shimmer|ambient|cloud/.test(n)) return "reverb";
  if (/delay|echo|tape/.test(n)) return "delay";
  if (/phase|phaser/.test(n)) return "phaser";
  if (/trem/.test(n)) return "tremolo";
  if (/flang|jet/.test(n)) return "flanger";
  if (/chorus|vibrato|modulation|uni-?vibe/.test(n)) return "chorus";
  if (/wah|cry ?baby|envelope filter/.test(n)) return "wah";
  if (/gate|noise ?(sup|red)/.test(n)) return "gate";
  if (/\beq\b|equali[sz]er|graphic/.test(n)) return "eq";
  if (/comp|dynamics|sustain/.test(n)) return "compressor";
  if (/fuzz|muff|tone ?bender/.test(n)) return "fuzz";
  if (/dist|\brat\b|ds-?1|metal zone/.test(n)) return "distortion";
  if (/boost/.test(n)) return "boost";
  if (/drive|screamer|od\b/.test(n)) return "overdrive";
  return null;
}

const voiceFor = (type: EffectType, name: string) =>
  type === "reverb" ? (/spring/i.test(name) ? "Spring" : /hall|shimmer|ambient|cloud|plate/i.test(name) ? "Cloud" : "Room")
  : type === "delay" ? (/tape/i.test(name) ? "Tape" : /dual|ping|stereo/i.test(name) ? "Dual" : "Analog")
  : undefined;

function effect(type: EffectType, i: number, on: boolean, name: string, params: Record<string, number | undefined>): Effect {
  const base = newEffect(type, `${type}-${i}`);
  const set = Object.fromEntries(Object.entries(params).filter(([k, v]) => v !== undefined && k in base.params).map(([k, v]) => [k, knob10(v!)]));
  const voice = voiceFor(type, name);
  return { ...base, on, ...(voice && { voice }), params: { ...base.params, ...set } };
}

/** A starting patch from an analysis recipe (knobs 0–100 there, 0–10 here). */
export function patchFromRecipe(recipe: RecipeCore): StudioPatch {
  const a = recipe.amp;
  const patch = defaultPatch(modelFor(`${a.family} ${a.model}`, a.gain / 10));
  patch.amp = { ...patch.amp, gain: knob10(a.gain / 10), bass: knob10(a.bass / 10), mid: knob10(a.mids / 10), treble: knob10(a.treble / 10), presence: knob10(a.presence / 10) };
  patch.cab = { ...patch.cab, model: cabFromSpeakers(recipe.cabinet.type) };
  patch.effects = orderEffects(
    recipe.pedalboard.flatMap((p, i) => {
      const type = effectFromName(p.name, p.type);
      if (!type) return [];
      const k = (v?: number) => (v === undefined ? undefined : v / 10);
      return [effect(type, i, p.enabled, p.name, { drive: k(p.drive), tone: k(p.tone), level: k(p.level) })];
    }).slice(0, MAX_EFFECTS),
  );
  return patch;
}

const CATEGORY: Record<string, EffectType> = {
  boost: "boost", drive: "overdrive", distortion: "distortion", fuzz: "fuzz", compressor: "compressor", wah: "wah", gate: "gate", eq: "eq",
  chorus: "chorus", flanger: "flanger", vibrato: "chorus", modulation: "chorus", phaser: "phaser", tremolo: "tremolo", delay: "delay", reverb: "reverb",
};
const pick = (s: Record<string, number | string>, ...keys: string[]) => {
  for (const k of keys) for (const [name, v] of Object.entries(s)) if (name.toLowerCase() === k && typeof v === "number") return v;
  return undefined;
};

/** A starting patch from a declared (non-device) rig: knob names matched loosely, 0–10 already. */
export function patchFromRig(rig: RigSpec): StudioPatch {
  const s = rig.amp?.settings ?? {};
  const gain = pick(s, "gain", "drive") ?? 5;
  const name = [rig.amp?.ref?.brand, rig.amp?.ref?.model, rig.amp?.channel].filter(Boolean).join(" ");
  const patch = defaultPatch(modelFor(name, gain));
  const set = (key: keyof StudioPatch["amp"], ...names: string[]) => {
    const v = pick(s, ...names);
    if (v !== undefined) (patch.amp as Record<string, unknown>)[key] = knob10(v);
  };
  set("gain", "gain", "drive"); set("bass", "bass", "low"); set("mid", "mid", "middle", "mids"); set("treble", "treble", "high");
  set("presence", "presence"); set("depth", "depth", "resonance"); set("master", "master", "volume");
  patch.cab = { ...patch.cab, model: cabFromSpeakers(rig.cab?.speakers) };
  patch.effects = orderEffects(
    rig.chain.flatMap((b, i) => {
      const type = CATEGORY[b.category];
      if (!type) return [];
      const p = b.params;
      return [effect(type, i, b.enabled, String(p.Type ?? b.ref?.model ?? b.category), {
        drive: pick(p, "drive", "gain", "distortion", "fuzz"), tone: pick(p, "tone"), level: pick(p, "level", "volume", "output"),
        sustain: pick(p, "sustain", "compression"), rate: pick(p, "rate", "speed"), depth: pick(p, "depth", "intensity"),
        mix: pick(p, "mix", "blend", "level"), time: pick(p, "time"), feedback: pick(p, "feedback", "repeats"), decay: pick(p, "decay"),
      })];
    }).slice(0, MAX_EFFECTS),
  );
  return patch;
}

export type StudioSource = { studio: StudioPatch | null; declared: RigSpec | null; inferred: RecipeCore | null };

/** Which patch a tone opens as, and whether it's in device mode. */
export function patchFromTone(t: StudioSource): { patch: StudioPatch; device: typeof TANK_G_STUDIO | null; from: "studio" | "device" | "analysis" | "rig" | "default" } {
  const [patch, device, from] = pickSource(t);
  // Whatever the source (old saves, legacy recipes, hand-written rigs), the studio only ever sees a valid patch.
  return { patch: normalizeStudioPatch(patch), device, from };
}

function pickSource(t: StudioSource): [StudioPatch, typeof TANK_G_STUDIO | null, "studio" | "device" | "analysis" | "rig" | "default"] {
  if (isTankG(t.declared)) return [constrainToDevice(patchFromTankG(t.declared), TANK_G_STUDIO), TANK_G_STUDIO, "device"];
  if (t.studio) return [t.studio, null, "studio"];
  if (t.inferred) return [patchFromRecipe(t.inferred), null, "analysis"];
  if (t.declared) return [patchFromRig(t.declared), null, "rig"];
  return [defaultPatch(), null, "default"];
}
