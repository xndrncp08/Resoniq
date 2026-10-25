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

export type AnalysisWindow = { start_s: number; duration_s: number; total_s: number | null };

/** Measured over a section's louder seconds: level and tone colour of the whole mix. */
export interface SectionCharacter {
  rms_db: number;
  centroid_hz: number;
  low_db: number;
  mid_db: number;
  high_db: number;
  flatness_db: number;
}

/** A stretch of the recording with a consistent sound. Sections sharing a type were measured once, on one excerpt. */
export interface EngineSection {
  id: string;
  type: string;
  start_s: number;
  end_s: number;
  traits: string[];
  character: SectionCharacter;
  excerpt: AnalysisWindow;
  raw_features: Record<string, number | null>;
  tone_profile: EngineToneProfile;
  recipe: EngineRecipe;
}

/** Per-second (thinned) measurements over the whole recording. */
export interface EngineTimeline {
  step_s: number;
  rms_db: number[];
  centroid_hz: number[];
  low_db: number[];
  mid_db: number[];
  high_db: number[];
  flatness_db: number[];
}

export interface EngineAnalysis {
  raw_features: Record<string, number | null>;
  /** Which stretch was measured for the headline result. Absent on older analyses. */
  analysis_window?: AnalysisWindow;
  /** Present when the recording has more than one distinct sound. */
  sections?: EngineSection[] | null;
  main_section?: string | null;
  timeline?: EngineTimeline | null;
  tone_profile: EngineToneProfile;
  /** Absent in analyses stored before the recipe step existed. */
  recipe?: EngineRecipe;
}
