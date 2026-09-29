import type { RecipeCore } from "@/types/tone";

/**
 * Response shape of python-engine `POST /analyze` (see python-engine/app/schemas.py).
 * Stored verbatim in `Song.analysisData`.
 */

export interface EngineToneProfile {
  gain_percent: number;
  eq: { bass: number; mid: number; treble: number };
  amp_family: string;
  cabinet: string;
  pickup_position: string;
  effects_chain: { name: string; confidence: number }[];
  playing_style_tags: string[];
  match_confidence: number;
}

/** `recipe` is camelCase and already matches the ToneRecipe contract. */
export interface EngineRecipe extends RecipeCore {
  /** "llm" when Claude wrote the recipe, "heuristic" when the engine fell back to its rules. */
  source: "llm" | "heuristic";
}

export interface EngineAnalysis {
  raw_features: Record<string, number | null>;
  tone_profile: EngineToneProfile;
  /** Absent in analyses stored before the recipe step existed. */
  recipe?: EngineRecipe;
}
