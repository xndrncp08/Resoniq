import type { EngineAnalysis, EngineToneProfile } from "@/types/engine";
import type { PedalSlot, PickupPosition, RecipeCore, ToneRecipe } from "@/types/tone";
import { chainPosition, classifyEffect } from "@/lib/effectConfig";

/**
 * Adapters from storage/engine shapes to the ToneRecipe contract.
 * UI code should only ever consume the ToneRecipe these return.
 */

export type SongMeta = {
  id: string;
  title: string | null;
  artist: string | null;
  fileUrl: string;
  createdAt: Date | string;
};

/** What `Tone.data` holds for tones saved from the ToneRecipe dashboard. */
export type StoredToneData = { version: 2; recipe: RecipeCore };

/** What `Tone.data` held before the ToneRecipe contract existed. */
type LegacyToneData = {
  profile?: EngineToneProfile;
  amp?: { gain: number; bass: number; mid: number; treble: number; presence: number };
  pre?: { name: string; params: Record<string, number> }[];
  post?: { name: string; params: Record<string, number> }[];
};

const NO_EFFECTS = "No significant effects detected";

const PICKUPS: Record<string, PickupPosition> = {
  bridge: "Bridge",
  middle: "Middle",
  neck: "Neck",
  "bridge + middle": "Bridge/Middle",
  "neck + middle": "Neck/Middle",
};

// Illustrative reference points per amp voicing — "sounds in this
// neighbourhood", never a claim about what these artists actually used.
const AMP_FAMILIES: { match: RegExp; family: string; artists: string[] }[] = [
  { match: /fender|blackface/i, family: "Fender", artists: ["John Mayer", "Cory Wong", "Mark Knopfler"] },
  { match: /two-rock|boutique clean/i, family: "Boutique clean", artists: ["John Mayer", "Josh Kiszka", "Tom Misch"] },
  { match: /vox|chime/i, family: "Vox", artists: ["The Edge", "Brian May", "Peter Buck"] },
  { match: /tweed/i, family: "Tweed", artists: ["Neil Young", "Billy Gibbons", "Keith Richards"] },
  { match: /plexi|marshall|jcm800/i, family: "Marshall", artists: ["Jimmy Page", "Slash", "Angus Young"] },
  { match: /5150|rectifier|djent|metal/i, family: "Modern high gain", artists: ["Mark Tremonti", "Misha Mansoor", "Adam Jones"] },
];

function ampFamily(ampFamilyLabel: string) {
  return (
    AMP_FAMILIES.find((f) => f.match.test(ampFamilyLabel)) ?? {
      family: "Boutique",
      artists: ["Derek Trucks", "Gary Clark Jr.", "Joe Bonamassa"],
    }
  );
}

function speakerFor(cabinetType: string): string {
  if (cabinetType.includes("4x12")) return "Celestion Vintage 30-style";
  if (cabinetType.includes("1x12")) return "Jensen C12N-style";
  return "Celestion G12H-style";
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function toPedal(name: string, slot: number, params: Record<string, number> = {}): PedalSlot {
  const type = classifyEffect(name);
  return {
    slot,
    name,
    type,
    enabled: true,
    ...(type === "drive" ? { drive: params.drive ?? 45 } : {}),
    tone: params.tone ?? 50,
    level: params.level ?? params.mix ?? 60,
  };
}

/** Rule-based recipe for analyses that predate the engine's own `recipe` field. */
export function heuristicRecipe(profile: EngineToneProfile): RecipeCore {
  const { family, artists } = ampFamily(profile.amp_family);
  const effects = profile.effects_chain.filter((fx) => fx.name !== NO_EFFECTS);
  const ordered = [
    ...effects.filter((fx) => chainPosition(fx.name) === "pre"),
    ...effects.filter((fx) => chainPosition(fx.name) === "post"),
  ];
  const pickup = PICKUPS[profile.pickup_position] ?? "Bridge";

  return {
    confidenceScore: clamp(profile.match_confidence),
    recipeDescription:
      `A ${profile.amp_family} voice at around ${profile.gain_percent}% gain through a ` +
      `${profile.cabinet} cab, played on the ${pickup.toLowerCase()} pickup` +
      (ordered.length ? ` with ${ordered.map((fx) => fx.name.toLowerCase()).join(", ")}.` : ", no obvious effects."),
    amp: {
      family,
      model: profile.amp_family,
      gain: clamp(profile.gain_percent),
      bass: clamp(profile.eq.bass),
      mids: clamp(profile.eq.mid),
      treble: clamp(profile.eq.treble),
      presence: clamp(profile.eq.treble * 0.8),
    },
    cabinet: { type: profile.cabinet, speaker: speakerFor(profile.cabinet) },
    pickup,
    pedalboard: ordered.map((fx, i) => toPedal(fx.name, i + 1)),
    similarArtists: artists,
  };
}

export function recipeCoreFromAnalysis(analysis: EngineAnalysis): RecipeCore {
  if (analysis.recipe) {
    const { source, ...core } = analysis.recipe;
    return core;
  }
  return heuristicRecipe(analysis.tone_profile);
}

function iso(d: Date | string): string {
  return typeof d === "string" ? d : d.toISOString();
}

/** A freshly analyzed song, before the user has saved it as a tone. */
export function recipeFromAnalysis(analysis: EngineAnalysis, song: SongMeta): ToneRecipe {
  return {
    ...recipeCoreFromAnalysis(analysis),
    id: song.id,
    title: song.title ?? "Untitled upload",
    artist: song.artist ?? "Unknown artist",
    audioUrl: song.fileUrl,
    isFavorite: false,
    createdAt: iso(song.createdAt),
  };
}

function isStored(data: unknown): data is StoredToneData {
  return typeof data === "object" && data !== null && (data as { version?: unknown }).version === 2;
}

function coreFromLegacy(data: LegacyToneData): RecipeCore | null {
  if (!data.profile) return null;
  const core = heuristicRecipe(data.profile);
  if (data.amp) {
    core.amp = {
      ...core.amp,
      gain: clamp(data.amp.gain),
      bass: clamp(data.amp.bass),
      mids: clamp(data.amp.mid),
      treble: clamp(data.amp.treble),
      presence: clamp(data.amp.presence),
    };
  }
  if (data.pre || data.post) {
    core.pedalboard = [...(data.pre ?? []), ...(data.post ?? [])].map((p, i) =>
      toPedal(p.name, i + 1, p.params),
    );
  }
  return core;
}

/** A saved library tone. Returns null if `data` is in neither known format. */
export function recipeFromStoredTone(
  tone: { id: string; name: string; favorite: boolean; createdAt: Date | string; data: unknown },
  song: SongMeta | null,
): ToneRecipe | null {
  const core = isStored(tone.data) ? tone.data.recipe : coreFromLegacy((tone.data ?? {}) as LegacyToneData);
  if (!core) return null;
  return {
    ...core,
    id: tone.id,
    title: tone.name,
    artist: song?.artist ?? "Unknown artist",
    audioUrl: song?.fileUrl ?? "",
    isFavorite: tone.favorite,
    createdAt: iso(tone.createdAt),
  };
}
