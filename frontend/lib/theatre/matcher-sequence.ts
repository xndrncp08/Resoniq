import type { __UNSTABLE_Project_OnDiskState as OnDiskState } from "@theatre/core";

/**
 * Keyframes for the tone-matcher reveal (components/tone/ToneMatcher.tsx),
 * in Theatre.js's saved-project format. Written as data here rather than an
 * exported studio file, so the timing is readable and reviewable in diffs.
 *
 * To tweak it visually: run the dev server and open an analysis page with
 * `?theatre` in the URL. That loads @theatre/studio (development only; it's
 * AGPL-licensed and must never ship), where the sequence can be scrubbed
 * and edited. Copy the new times back here.
 */

export const MATCHER_PROJECT_ID = "Resoniq tone matcher";
export const MATCHER_SHEET = "Matcher";
export const MATCHER_OBJECT = "Reveal";

/** 0..1 progress channels the component reads, one per stage of the reveal. */
export const MATCHER_PROPS = ["inputs", "flow", "outputs", "eq", "confidence", "glow"] as const;
export type MatcherProp = (typeof MATCHER_PROPS)[number];

/** [time in seconds, value] pairs per channel. */
const TIMELINE: Record<MatcherProp, [number, number][]> = {
  inputs: [[0, 0], [0.8, 1]], // measurements light up
  flow: [[0.45, 0], [1.7, 1]], // signal paths travel from inputs to outputs
  outputs: [[1.25, 0], [2.4, 1]], // amp settings fill
  eq: [[1.5, 0], [2.8, 1]], // EQ curve bends from flat to the recipe
  confidence: [[2.3, 0], [3.1, 1]], // confidence resolves last
  glow: [[2.55, 0], [2.85, 1], [3.5, 0.35]], // a settle-in pulse on the result
};

export const MATCHER_LENGTH_S = 3.5;

// Bezier handles are [leftX, leftY, rightX, rightY]; a segment eases with the
// left keyframe's right handle and the right keyframe's left handle. These
// give an expo-style ease-out: fast departure, long settle.
const EASE_OUT_HANDLES: [number, number, number, number] = [0.3, 1, 0.16, 1];

export function matcherState(): OnDiskState {
  const trackIdByPropPath: Record<string, string> = {};
  const trackData: Record<string, unknown> = {};

  for (const prop of MATCHER_PROPS) {
    const trackId = `track-${prop}`;
    trackIdByPropPath[JSON.stringify([prop])] = trackId;
    trackData[trackId] = {
      type: "BasicKeyframedTrack",
      __debugName: `${MATCHER_OBJECT}:${prop}`,
      keyframes: TIMELINE[prop].map(([position, value], i) => ({
        id: `kf-${prop}-${i}`,
        position,
        value,
        handles: EASE_OUT_HANDLES,
        connectedRight: true,
        type: "bezier",
      })),
    };
  }

  // The nominal id types (SheetId, ObjectAddressKey, ...) are plain strings
  // at runtime; the cast is where this hand-written state meets them.
  return {
    definitionVersion: "0.4.0",
    revisionHistory: ["resoniq-matcher-1"],
    sheetsById: {
      [MATCHER_SHEET]: {
        staticOverrides: { byObject: {} },
        sequence: {
          type: "PositionalSequence",
          length: MATCHER_LENGTH_S,
          subUnitsPerUnit: 30,
          tracksByObject: { [MATCHER_OBJECT]: { trackIdByPropPath, trackData } },
        },
      },
    },
  } as unknown as OnDiskState;
}
