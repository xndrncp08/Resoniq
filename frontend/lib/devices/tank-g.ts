import { ApiError } from "@/lib/api-error";
import type { RigBlock, RigSpec } from "@/types/rig";

/**
 * M-VAVE TANK-G capabilities, from the M-VAVE TANK-G user manual (Feb 2024
 * edition, https://images.equipboard.com/uploads/item/manual/117745/m-vave-tank-g-manual.pdf).
 * The manual prints the amp and IR tables as images; the amp names below match
 * two independent retail listings, the factory IR names could not be verified,
 * and M-VAVE says voicings "will constantly update without notice". So presets
 * reference amp slots by number with a reported voicing, and IRs by cabinet
 * style rather than a factory slot.
 *
 * Every knob value in Resoniq is a normalized 0–10 position (5 ≈ noon) on a
 * panel with no printed scale; none of this is a native parameter readout.
 */
export const TANK_G_SLUG = "m-vave-tank-g";

export const TANK_G_AMPS = [
  { slot: 1, voicing: "AC-style clean", reference: "VOX AC30HW Normal", gain: "clean" },
  { slot: 2, voicing: "Blackface twin clean", reference: "Fender '65 Twin Reverb", gain: "clean" },
  { slot: 3, voicing: "Boutique overdrive", reference: "Bogner Shiva", gain: "overdrive" },
  { slot: 4, voicing: "JTM-style overdrive", reference: "Marshall JTM45", gain: "overdrive" },
  { slot: 5, voicing: "Plexi overdrive", reference: "Marshall Plexi 100", gain: "overdrive" },
  { slot: 6, voicing: "800-style distortion", reference: "Marshall JCM800", gain: "distortion" },
  { slot: 7, voicing: "5150-style lead", reference: "EVH 5150 Lead", gain: "distortion" },
  { slot: 8, voicing: "Powerball-style high gain", reference: "ENGL Powerball", gain: "distortion" },
  { slot: 9, voicing: "Rectifier-style high gain", reference: "Mesa/Boogie Dual Rectifier", gain: "distortion" },
] as const;

/** Each multi-zone knob selects its type by zone; between two zones the module is off. */
export const TANK_G_MODULES = {
  mod: { knob: "MOD FX", second: "MOD SPEED", types: { Chorus: "Mix", Phaser: "Depth", Tremolo: "Mix" } },
  delay: { knob: "DLY MIX", second: "DLY TIME", types: { Analog: "Mix", Tape: "Mix", Dual: "Mix" } },
  reverb: { knob: "RVB DECAY", second: "RVB MIX", types: { Room: "Decay", Spring: "Decay", Cloud: "Decay" } },
} as const;
type ModuleKey = keyof typeof TANK_G_MODULES;

const MOD_CATEGORY = { Chorus: "chorus", Phaser: "phaser", Tremolo: "tremolo" } as const;
export const TANK_G_COLLECTIONS = { clean: "Clean & ambient", rock: "Rock & alternative", metal: "Metal & progressive", lead: "Lead & expressive" } as const;
export type TankGCollection = keyof typeof TANK_G_COLLECTIONS;
export const TANK_G_EFFECTS = [...Object.keys(TANK_G_MODULES.mod.types), ...Object.keys(TANK_G_MODULES.delay.types), ...Object.keys(TANK_G_MODULES.reverb.types)];
export const TANK_G_CONTROLS = ["NOISE GATE", "TYPE", "GAIN", "TREBLE", "MIDDLE", "BASS", "VOLUME", "MOD FX", "MOD SPEED", "DLY MIX", "DLY TIME", "RVB DECAY", "RVB MIX", "IR CAB", "MASTER"];
const AMP_KNOBS = ["Gain", "Treble", "Middle", "Bass", "Volume"];

export const TANK_G_FACTS = {
  verified: [
    "Signal path: noise gate → amp (preamp) → modulation → delay → reverb → IR cabinet → master.",
    "9 amp (preamp) types with Gain, Treble, Middle, Bass and Volume: the 3-band EQ is the amp's tone stack.",
    "Noise gate: one threshold knob; fully counter-clockwise turns it off.",
    "Modulation: Chorus (mix), Phaser (depth) or Tremolo (mix) selected by the MOD FX knob zone, plus MOD SPEED.",
    "Delay: Analog, Tape or Dual selected by the DLY MIX knob zone (mix), plus DLY TIME.",
    "Reverb: Room, Spring or Cloud selected by the RVB DECAY knob zone (decay), plus RVB MIX.",
    "IR CAB: 9 positions, first is off, 8 IR slots; importing an IR overwrites that slot.",
    "36 presets: banks 1–9 × footswitches A–D. Save in LIVE mode by holding A/B/C/D.",
    "MASTER is a global output level, not stored per preset.",
    "Editing, preset import/export and IR loading use M-VAVE's M-EFCS software (Windows/macOS) or app (iOS/Android).",
  ],
  unverified: [
    "The amp slot order and voicings come from retail listings, not the manual text; firmware updates may change them.",
    "Factory IR names per slot are unconfirmed. Presets name a cabinet style; pick the matching slot in M-EFCS or load your own IR.",
    "The manual names the delays Analog, Tape and Dual; some listings say Analog, Digital and Reverse. Check your firmware.",
    "M-EFCS preset files are an undocumented M-VAVE format, so Resoniq does not write native preset files.",
    "There is no compressor, separate drive pedal, pitch or shimmer block; shimmer-like pads use Cloud reverb plus modulation.",
  ],
};

export type TankGDevice = { slug: typeof TANK_G_SLUG; ampSlot: number; collection: TankGCollection };

export const isTankG = (rig: RigSpec | null | undefined): rig is RigSpec & { device: TankGDevice } => rig?.device?.slug === TANK_G_SLUG;
export const tankGAmp = (slot: number) => TANK_G_AMPS.find(a => a.slot === slot);

function moduleOf(block: RigBlock): ModuleKey | null {
  if (block.category === "gate") return null;
  if (block.category === "delay") return "delay";
  if (block.category === "reverb") return "reverb";
  return "mod";
}

/** Rejects anything the hardware can't do: unknown slots, extra blocks, unsupported effects or controls. */
export function validateTankGRig(rig: RigSpec, deviceGearId: string) {
  const bad = (msg: string): never => { throw new ApiError(400, `TANK-G: ${msg}`); };
  const d = rig.device;
  if (!d || d.slug !== TANK_G_SLUG) return bad("missing device metadata.");
  if (!Number.isInteger(d.ampSlot) || !tankGAmp(d.ampSlot!)) bad("amp slot must be 1–9.");
  if (!d.collection || !(d.collection in TANK_G_COLLECTIONS)) bad("unknown collection.");
  if (rig.amp?.ref?.gearId !== deviceGearId) bad("the amp must be the TANK-G itself.");
  const knobs = Object.keys(rig.amp?.settings ?? {});
  if (knobs.length !== AMP_KNOBS.length || AMP_KNOBS.some(k => !knobs.includes(k))) bad(`amp settings must be exactly ${AMP_KNOBS.join(", ")}.`);
  if (rig.eq && Object.keys(rig.eq).length) bad("there is no separate EQ block; use the amp tone stack.");
  const order = ["gate", "mod", "delay", "reverb"];
  let last = -1;
  for (const b of rig.chain) {
    if (b.ref?.gearId !== deviceGearId) bad("every block must be a TANK-G module.");
    const mod = moduleOf(b);
    const pos = order.indexOf(mod ?? "gate");
    if (pos <= last) bad("blocks must be one each of gate, modulation, delay, reverb, in signal order.");
    last = pos;
    if (b.placement !== (mod ? "loop" : "pre")) bad("the gate sits before the amp; effects after it.");
    if (!mod) {
      if (Object.keys(b.params).join() !== "Threshold" || typeof b.params.Threshold !== "number" || b.params.Threshold <= 0 || b.params.Threshold > 10) bad("the gate takes only a Threshold above 0.");
      continue;
    }
    const spec = TANK_G_MODULES[mod];
    const type = b.params.Type as keyof typeof spec.types;
    if (typeof type !== "string" || !(type in spec.types)) bad(`${spec.knob} supports ${Object.keys(spec.types).join(", ")}.`);
    if (mod === "mod" && b.category !== MOD_CATEGORY[type as keyof typeof MOD_CATEGORY]) bad("modulation category must match its type.");
    const amount = spec.types[type];
    const second = mod === "mod" ? "Speed" : mod === "delay" ? "Time" : "Mix";
    const keys = Object.keys(b.params).sort().join();
    if (keys !== ["Type", amount, second].sort().join()) bad(`${type} takes ${amount} and ${second}.`);
    for (const k of [amount, second]) if (typeof b.params[k] !== "number" || (b.params[k] as number) < 0 || (b.params[k] as number) > 10) bad(`${type} ${k} must be 0–10.`);
  }
  if (!rig.cab?.speakers) bad("name an IR cabinet style.");
}

/** Normalized 0–10 → approximate clock position on a 7-to-5 o'clock sweep. */
export function clock(v: number) {
  const minutes = Math.round(((7 + v) * 60) / 15) * 15;
  const h = Math.floor(minutes / 60) % 12 || 12;
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** Each multi-zone knob is split into thirds; the module is off in the gaps. Approximate by design. */
function zoneClock(zone: number, v: number) {
  return clock(zone * (10 / 3) + 0.4 + (v / 10) * (10 / 3 - 0.8));
}

export type SheetRow = { control: string; setting: string; position: string };

/** The panel, knob by knob, for setting the preset by hand in LIVE mode. */
export function tankGSheet(rig: RigSpec): SheetRow[] {
  // Member rigs can claim the device too, so render defensively rather than trusting the shape.
  const amp = isTankG(rig) ? tankGAmp(rig.device.ampSlot) : undefined;
  if (!amp || !rig.amp) return [];
  const s = rig.amp.settings;
  const find = (m: ModuleKey) => rig.chain.find(b => b.enabled && moduleOf(b) === m);
  const gate = rig.chain.find(b => b.enabled && b.category === "gate");
  const rows: SheetRow[] = [
    { control: "NOISE GATE", setting: gate ? `Threshold ${gate.params.Threshold}` : "Off", position: gate ? clock(gate.params.Threshold as number) : "Fully counter-clockwise" },
    { control: "TYPE", setting: `Slot ${amp.slot} · ${amp.voicing}`, position: `Position ${amp.slot} of 9` },
    ...AMP_KNOBS.map(k => ({ control: k.toUpperCase(), setting: String(s[k] ?? "—"), position: typeof s[k] === "number" ? clock(s[k]) : "—" })),
  ];
  for (const m of ["mod", "delay", "reverb"] as const) {
    const spec = TANK_G_MODULES[m];
    const b = find(m);
    const type = b?.params.Type as string;
    const zone = Object.keys(spec.types).indexOf(type);
    const amount = spec.types[type as keyof typeof spec.types];
    if (!b || zone < 0 || typeof b.params[amount] !== "number") {
      rows.push({ control: spec.knob, setting: "Off", position: "Between two zones (both module lights off)" });
      rows.push({ control: spec.second, setting: "—", position: "Any (module off)" });
      continue;
    }
    const second = m === "mod" ? "Speed" : m === "delay" ? "Time" : "Mix";
    rows.push({ control: spec.knob, setting: `${type} · ${amount} ${b.params[amount]}`, position: `${["First", "Middle", "Last"][zone]} zone, ≈${zoneClock(zone, b.params[amount] as number)}` });
    rows.push({ control: spec.second, setting: String(b.params[second] ?? "—"), position: typeof b.params[second] === "number" ? clock(b.params[second] as number) : "—" });
  }
  rows.push({ control: "IR CAB", setting: rig.cab?.speakers ?? "Off", position: "Choose the matching slot in M-EFCS" });
  rows.push({ control: "MASTER", setting: "Global", position: "Set for your monitoring level" });
  return rows;
}

/** Plain-text setup sheet: what a player needs at the pedal, with the provenance stated. */
export function tankGSheetText(name: string, rig: RigSpec, origin: string, toneId: string, disclosure: string) {
  const rows = tankGSheet(rig);
  const w = Math.max(...rows.map(r => r.control.length));
  return [
    `${name} — M-VAVE TANK-G setup sheet`,
    `${origin}/t/${toneId}`,
    "",
    disclosure,
    "Values are normalized 0–10 knob positions (5 ≈ noon), not native parameter readouts. Clock positions are approximate.",
    "",
    ...rows.map(r => `${r.control.padEnd(w)}  ${r.setting}  (${r.position})`),
    "",
    rig.setupGuide ?? "",
    "",
    rig.notes ? `Playing: ${rig.notes}` : "",
    "",
    `Verified capabilities and limits: ${origin}/gear/${TANK_G_SLUG}`,
  ].join("\n").replace(/\n{3,}/g, "\n\n");
}

/** Query-string filters for the TANK-G library; anything unrecognized is ignored. */
export function parseTankGFilters(get: (k: string) => string | null | undefined) {
  const slot = Number(get("amp"));
  const effect = get("effect");
  const collection = get("collection");
  return {
    ampSlot: tankGAmp(slot) ? slot : undefined,
    effect: effect && TANK_G_EFFECTS.includes(effect) ? effect : undefined,
    collection: collection && collection in TANK_G_COLLECTIONS ? collection : undefined,
  };
}

/** Bank 1–9 × footswitch A–D: slot 0 is 1A, slot 35 is 9D. */
export const TANK_G_SLOTS = 36;
export const slotLabel = (i: number) => `${Math.floor(i / 4) + 1}${"ABCD"[i % 4]}`;

/** A default layout: clean banks first, then rock, metal and lead, by name; extras that don't fit are returned separately. */
export function bankLayout<T extends { name: string; declared: RigSpec | null }>(tones: T[]) {
  const order = Object.keys(TANK_G_COLLECTIONS);
  const rank = (t: T) => { const i = order.indexOf(t.declared?.device?.collection ?? ""); return i < 0 ? order.length : i; };
  const sorted = [...tones].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  return { slots: sorted.slice(0, TANK_G_SLOTS), extra: sorted.slice(TANK_G_SLOTS) };
}
