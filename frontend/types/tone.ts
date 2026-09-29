/**
 * Integration contract shared by every module.
 *
 * The dashboard and library render ToneRecipe and nothing else — they never
 * read the python-engine response or the Prisma `Tone.data` JSON directly.
 * Converting those into a ToneRecipe is lib/tone-recipe.ts's job.
 */

export type PickupPosition = "Bridge" | "Middle" | "Neck" | "Bridge/Middle" | "Neck/Middle";

/** All knob values are 0-100. */
export interface AmpSettings {
  family: string;
  model: string;
  gain: number;
  bass: number;
  mids: number;
  treble: number;
  presence: number;
}

export interface CabinetSettings {
  type: string;
  speaker: string;
}

/** Conventional `type` values: "dynamics" | "drive" | "modulation" | "time" (see lib/effectConfig.ts). */
export interface PedalSlot {
  slot: number;
  name: string;
  type: string;
  enabled: boolean;
  drive?: number;
  tone?: number;
  level?: number;
}

export interface ToneRecipe {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  /** 0-100. Heuristic confidence, not a calibrated probability. */
  confidenceScore: number;
  recipeDescription: string;
  amp: AmpSettings;
  cabinet: CabinetSettings;
  pickup: PickupPosition;
  pedalboard: PedalSlot[];
  similarArtists: string[];
  isFavorite: boolean;
  /** ISO 8601 */
  createdAt: string;
}

/** The sound-describing part of a recipe — what the analysis engine produces and what a saved tone stores. */
export type RecipeCore = Pick<
  ToneRecipe,
  "confidenceScore" | "recipeDescription" | "amp" | "cabinet" | "pickup" | "pedalboard" | "similarArtists"
>;
