import type { RigBlock, RigSpec } from "@/types/rig";
import { TANK_G_AMPS, TANK_G_SLUG, isTankG, tankGAmp } from "@/lib/devices/tank-g";
import { CAB_DESIGNS, clamp, defaultPatch, knob10, type AmpKnob, type AmpModelId, type CabModelId, type Effect, type EffectType, type StudioPatch } from "@/lib/studio/patch";

/**
 * Hardware the studio can edit presets for. A profile says what the device
 * can actually do: which amps, knobs and effects exist, in what order, with
 * which labels. In device mode the studio shows only those controls and
 * saves back to the tone's declared rig, which the server validates against
 * the same device rules (lib/devices).
 */
export type StudioDevice = {
  slug: string;
  name: string;
  amps: { slot: number; label: string; model: AmpModelId }[];
  ampKnobs: { key: AmpKnob; label: string }[];
  /** One effect per slot, in this order; each slot offers these types. */
  effectSlots: { label: string; types: EffectType[] }[];
  /** Effect param labels and which params the hardware has (others stay at their defaults). */
  effectParams: Partial<Record<EffectType, { key: string; label: string }[]>>;
  voices: Partial<Record<EffectType, string[]>>;
  canBypassCab: boolean;
  caveats: string[];
};

const voicingModel = (gain: string, slot: number): AmpModelId => (gain === "clean" ? "lumen" : gain === "distortion" ? "basalt" : slot === 3 ? "gilded" : "halcyon");

export const TANK_G_STUDIO: StudioDevice = {
  slug: TANK_G_SLUG,
  name: "M-VAVE TANK-G",
  amps: TANK_G_AMPS.map((a) => ({ slot: a.slot, label: `${a.slot} · ${a.voicing}`, model: voicingModel(a.gain, a.slot) })),
  ampKnobs: [
    { key: "gain", label: "Gain" }, { key: "treble", label: "Treble" }, { key: "mid", label: "Middle" }, { key: "bass", label: "Bass" }, { key: "master", label: "Volume" },
  ],
  effectSlots: [
    { label: "Modulation", types: ["chorus", "phaser", "tremolo"] },
    { label: "Delay", types: ["delay"] },
    { label: "Reverb", types: ["reverb"] },
  ],
  effectParams: {
    chorus: [{ key: "mix", label: "Mix" }, { key: "rate", label: "Speed" }],
    phaser: [{ key: "depth", label: "Depth" }, { key: "rate", label: "Speed" }],
    tremolo: [{ key: "depth", label: "Mix" }, { key: "rate", label: "Speed" }],
    delay: [{ key: "mix", label: "Mix" }, { key: "time", label: "Time" }],
    reverb: [{ key: "decay", label: "Decay" }, { key: "mix", label: "Mix" }],
  },
  voices: { delay: ["Analog", "Tape", "Dual"], reverb: ["Room", "Spring", "Cloud"] },
  canBypassCab: false,
  caveats: [
    "Knob values are the preset's normalized 0–10 positions, not native parameter readouts.",
    "The studio's audio is Resoniq's own approximation of this chain; the pedal will sound different.",
    "Gate thresholds map 0–10 onto −80 to −30 dB here; the hardware's scale isn't published.",
  ],
};

export const STUDIO_DEVICES: Record<string, StudioDevice> = { [TANK_G_SLUG]: TANK_G_STUDIO };

const TANK_KNOB: Record<string, AmpKnob> = { Gain: "gain", Treble: "treble", Middle: "mid", Bass: "bass", Volume: "master" };
const MOD_TYPES: Record<string, EffectType> = { Chorus: "chorus", Phaser: "phaser", Tremolo: "tremolo" };
const MOD_AMOUNT: Record<string, string> = { chorus: "mix", phaser: "depth", tremolo: "depth" };

export const gateToDb = (threshold: number) => -80 + clamp(threshold, 0, 10) * 5;
export const dbToGate = (db: number) => knob10(Math.max(0.1, (db + 80) / 5));

export function cabFromSpeakers(text: string | undefined): CabModelId {
  if (/1\s*[x×]\s*12/i.test(text ?? "")) return "1x12-open";
  if (/2\s*[x×]\s*12/i.test(text ?? "")) return "2x12-open";
  return "4x12-closed";
}

/** A TANK-G preset as a studio patch. Block ids carry over so saving edits them in place. */
export function patchFromTankG(rig: RigSpec): StudioPatch {
  const slot = isTankG(rig) ? rig.device.ampSlot : 1;
  const amp = tankGAmp(slot) ?? TANK_G_AMPS[0];
  const base = defaultPatch(voicingModel(amp.gain, amp.slot));
  const settings = rig.amp?.settings ?? {};
  for (const [k, key] of Object.entries(TANK_KNOB)) if (typeof settings[k] === "number") base.amp[key] = knob10(settings[k]);
  const gate = rig.chain.find((b) => b.category === "gate" && b.enabled);
  const effects: Effect[] = [];
  for (const b of rig.chain) {
    if (!b.enabled || b.category === "gate") continue;
    const type: EffectType | undefined = b.category === "delay" ? "delay" : b.category === "reverb" ? "reverb" : MOD_TYPES[String(b.params.Type)];
    if (!type) continue;
    const p = b.params;
    const num = (k: string, d: number) => (typeof p[k] === "number" ? knob10(p[k] as number) : d);
    const params: Record<string, number> =
      type === "delay" ? { time: num("Time", 4), feedback: 3, mix: num("Mix", 3) }
      : type === "reverb" ? { decay: num("Decay", 4), mix: num("Mix", 3) }
      : type === "chorus" ? { rate: num("Speed", 3), depth: 5, mix: num("Mix", 5) }
      : { rate: num("Speed", 3), depth: num(type === "phaser" ? "Depth" : "Mix", 5) };
    effects.push({ id: /^[\w-]{1,64}$/.test(b.id) ? b.id : `${type}-${effects.length}`, type, on: true, ...((type === "delay" || type === "reverb") && { voice: String(p.Type) }), params });
  }
  return {
    ...base,
    gate: gate && typeof gate.params.Threshold === "number" ? { on: true, threshold: gateToDb(gate.params.Threshold) } : { on: false, threshold: -70 },
    cab: { ...base.cab, model: cabFromSpeakers(rig.cab?.speakers) },
    effects,
    device: { slug: TANK_G_SLUG, ampSlot: amp.slot },
  };
}

/** Keeps a patch inside what the device can do (used after every edit in device mode). */
export function constrainToDevice(patch: StudioPatch, device: StudioDevice): StudioPatch {
  const slot = device.amps.find((a) => a.slot === patch.device?.ampSlot) ?? device.amps[0];
  const kept: Effect[] = [];
  for (const s of device.effectSlots) {
    const e = patch.effects.find((x) => s.types.includes(x.type));
    if (!e) continue;
    const voices = device.voices[e.type];
    kept.push({ ...e, on: true, ...(voices && { voice: voices.includes(e.voice ?? "") ? e.voice : voices[0] }) });
  }
  return {
    ...patch,
    amp: { ...patch.amp, model: slot.model, presence: 5, depth: 5, bright: false, tight: false },
    cab: { ...patch.cab, on: device.canBypassCab ? patch.cab.on : true },
    effects: kept,
    device: { slug: device.slug, ampSlot: slot.slot },
  };
}

/** Writes a device-mode patch back into the preset's rig, keeping everything the studio doesn't edit. */
export function tankGRigFromPatch(patch: StudioPatch, base: RigSpec): RigSpec {
  const gearRef = base.amp?.ref;
  const ref = gearRef ? { ref: gearRef } : {};
  const chain: RigBlock[] = [];
  const oldGate = base.chain.find((b) => b.category === "gate");
  if (patch.gate.on) chain.push({ ...(oldGate ?? { id: "gate" }), id: oldGate?.id ?? "gate", category: "gate", ...ref, enabled: true, placement: "pre", params: { Threshold: dbToGate(patch.gate.threshold) } });
  for (const e of patch.effects) {
    const old = base.chain.find((b) => b.id === e.id);
    const p = e.params;
    let block: Pick<RigBlock, "category" | "params">;
    if (e.type === "delay") block = { category: "delay", params: { Type: e.voice ?? "Analog", Mix: knob10(p.mix), Time: knob10(p.time) } };
    else if (e.type === "reverb") block = { category: "reverb", params: { Type: e.voice ?? "Room", Decay: knob10(p.decay), Mix: knob10(p.mix) } };
    else {
      const name = Object.keys(MOD_TYPES).find((k) => MOD_TYPES[k] === e.type) ?? "Chorus";
      block = { category: e.type as RigBlock["category"], params: { Type: name, [name === "Phaser" ? "Depth" : "Mix"]: knob10(p[MOD_AMOUNT[e.type]]), Speed: knob10(p.rate) } };
    }
    chain.push({ id: old?.id ?? e.id, ...(old?.ref ? { ref: old.ref } : ref), enabled: true, placement: "loop", ...block });
  }
  const cabChanged = cabFromSpeakers(base.cab?.speakers) !== patch.cab.model;
  return {
    ...base,
    device: { ...(base.device ?? { slug: TANK_G_SLUG }), ampSlot: patch.device?.ampSlot ?? base.device?.ampSlot ?? 1 },
    amp: { ...(base.amp ?? {}), settings: Object.fromEntries(Object.entries(TANK_KNOB).map(([k, key]) => [k, knob10(patch.amp[key])])) },
    cab: { ...(base.cab ?? {}), speakers: cabChanged || !base.cab?.speakers ? `${CAB_DESIGNS[patch.cab.model].name.replace(/^\S+\s/, "")} IR (${CAB_DESIGNS[patch.cab.model].label.toLowerCase()})` : base.cab.speakers },
    chain,
  };
}
