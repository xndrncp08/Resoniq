/**
 * The stages python-engine reports while analyzing (STAGES in
 * python-engine/main.py), in order, with what the UI calls them. Keep the
 * two lists in step; an unknown stage name still renders, just unlabeled.
 */
export const ANALYSIS_STAGES = [
  { id: "decoding", label: "Decode", group: "decode" },
  { id: "features.spectrum", label: "Spectrum", group: "measure" },
  { id: "features.dynamics", label: "Dynamics", group: "measure" },
  { id: "features.onsets", label: "Pick attack", group: "measure" },
  { id: "features.harmonics", label: "Harmonics", group: "measure" },
  { id: "features.tempo", label: "Tempo", group: "measure" },
  { id: "features.effects", label: "Effects", group: "measure" },
  { id: "inference", label: "Infer gear", group: "infer" },
  { id: "recipe", label: "Write recipe", group: "recipe" },
] as const;

export type StageEvent = { type: "stage"; stage: string; index: number; total: number };

/** Progress beyond the engine's own stages (waiting out a cold start or restart), so a wait never looks like a hang. */
export type AnalysisNotice = { type: "notice"; code: "waking" | "retrying" };

/** 0..1 through the analysis for a reported stage index (a stage counts as half done while it runs). */
export const stageProgress = (index: number, total: number) => Math.min(1, (index + 0.5) / Math.max(1, total));
