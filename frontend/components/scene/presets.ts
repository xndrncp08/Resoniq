import type { SceneRoute } from "@/components/scene/state";

/**
 * Where the camera sits and how loud the field is on each route. Changing
 * route tweens between these (a camera move, not a cut). Content-heavy
 * pages keep the field low and quiet so it never competes with reading.
 */
export type ScenePreset = {
  camera: [x: number, y: number, z: number];
  /** Field tilt around x, radians: closer to -PI/2 lies flatter, like a floor. */
  tilt: number;
  /** Overall brightness and wave height, 0..1. */
  intensity: number;
  /** 0 = signal teal, 1 = copper. */
  warmth: number;
};

export const PRESETS: Record<SceneRoute, ScenePreset> = {
  home: { camera: [0, -1.5, 13], tilt: -0.42, intensity: 0.9, warmth: 0.15 },
  analyze: { camera: [0, -3.5, 10], tilt: -1.05, intensity: 0.75, warmth: 0.25 },
  dashboard: { camera: [0, -5, 9.5], tilt: -1.25, intensity: 0.5, warmth: 0.35 },
  library: { camera: [2, -4, 11], tilt: -1.15, intensity: 0.4, warmth: 0.1 },
  studio: { camera: [0, -1.5, 13], tilt: -0.42, intensity: 0.7, warmth: 0.2 },
  share: { camera: [-2, -4, 11], tilt: -1.1, intensity: 0.45, warmth: 0.4 },
  auth: { camera: [0, -2, 14], tilt: -0.7, intensity: 0.55, warmth: 0.1 },
  other: { camera: [0, -2, 13], tilt: -0.8, intensity: 0.5, warmth: 0.2 },
};
