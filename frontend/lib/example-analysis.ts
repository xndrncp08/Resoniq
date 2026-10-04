import type { RecipeCore } from "@/types/tone";

/**
 * The landing page's example is a real engine result, not a mock-up.
 *
 * Produced by POST /analyze/file on python-engine 0.2.0 (heuristic recipe,
 * no LLM) with the recording below, and copied here unedited. Re-run it
 * and update this file if the engine's heuristics change.
 */
export const EXAMPLE_SOURCE = {
  title: "Metal riff without and with noise gate (hard gating)",
  author: "Skimel",
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  url: "https://commons.wikimedia.org/wiki/File:Metal_riff_without_and_with_noise_gate_(hard_gating).wav",
} as const;

/** A few of the raw measurements behind the recipe. */
export const EXAMPLE_MEASUREMENTS = [
  { label: "Spectral centroid", value: "1,973 Hz" },
  { label: "85% rolloff", value: "3,774 Hz" },
  { label: "Saturation (flatness)", value: "0.80" },
  { label: "Crest factor", value: "15.5 dB" },
] as const;

export const EXAMPLE_RECIPE: RecipeCore = {
  confidenceScore: 82,
  recipeDescription:
    "A vintage high-gain (JCM800 family) voice at around 92% gain through a 2x12 open-back cab, played on the neck pickup with compressor, tremolo, delay.",
  amp: { family: "Marshall", model: "vintage high-gain (JCM800 family)", gain: 92, bass: 53, mids: 56, treble: 42, presence: 39 },
  cabinet: { type: "2x12 open-back", speaker: "Celestion G12H-style" },
  pickup: "Neck",
  pedalboard: [
    { slot: 1, name: "Compressor", type: "dynamics", enabled: true, tone: 50, level: 60 },
    { slot: 2, name: "Tremolo", type: "modulation", enabled: true, tone: 50, level: 60 },
    { slot: 3, name: "Delay", type: "time", enabled: true, tone: 50, level: 60 },
  ],
  similarArtists: ["Jimmy Page", "Slash", "Angus Young"],
};
