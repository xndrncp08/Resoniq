/**
 * Shared physics for the tactile controls: how heavy a control feels, how
 * it resists being pushed past its range, and how it carries momentum when
 * released. Pure functions, so the feel is testable without a browser.
 */

export type Weight = "heavy" | "medium" | "light" | "smooth";

export type WeightProfile = {
  /** Pointer travel (px) for a full 0-100 sweep. Heavier = more travel. */
  travelPx: number;
  /** Inertia: how far a flick carries (Motion's `power`) and how fast it settles (`timeConstant`, ms). */
  power: number;
  timeConstant: number;
  /** Release speed (units/s) below which a control stops where it was let go. */
  flickThreshold: number;
  /** Rubber-band stiffness past the ends: smaller = stiffer. Max visual overshoot in value units. */
  rubber: number;
  /** Spring used when it settles back from past an end. */
  bounceStiffness: number;
  bounceDamping: number;
};

/**
 * - heavy: gain and drive. Long travel, little glide, stiff ends: a pot with
 *   real resistance, so big jumps in distortion take deliberate movement.
 * - medium: tone-stack EQ.
 * - light: pedal tone/level trims. Short travel, more glide.
 * - smooth: master volume. Even, linear and fluid, with soft ends.
 */
export const WEIGHTS: Record<Weight, WeightProfile> = {
  heavy: { travelPx: 280, power: 0.12, timeConstant: 160, flickThreshold: 60, rubber: 4, bounceStiffness: 700, bounceDamping: 38 },
  medium: { travelPx: 200, power: 0.2, timeConstant: 220, flickThreshold: 45, rubber: 6, bounceStiffness: 520, bounceDamping: 30 },
  light: { travelPx: 140, power: 0.3, timeConstant: 260, flickThreshold: 35, rubber: 8, bounceStiffness: 420, bounceDamping: 24 },
  smooth: { travelPx: 220, power: 0.25, timeConstant: 300, flickThreshold: 30, rubber: 10, bounceStiffness: 360, bounceDamping: 26 },
};

export const MIN = 0;
export const MAX = 100;

export const clampValue = (v: number, min = MIN, max = MAX) => Math.max(min, Math.min(max, v));

/**
 * Rubber-band: past an end, displayed travel grows more and more slowly and
 * approaches `limit` asymptotically (the curve iOS uses for overscroll), so
 * pushing harder always moves a little but never runs away.
 */
export function rubberBand(overshoot: number, limit: number): number {
  if (overshoot === 0 || limit <= 0) return 0;
  const sign = Math.sign(overshoot);
  const x = Math.abs(overshoot);
  return sign * limit * (1 - 1 / (x / limit + 1));
}

/** The value to *display* for a raw dragged value: inside the range as-is, outside it rubber-banded. */
export function elasticValue(raw: number, profile: WeightProfile, min = MIN, max = MAX): number {
  if (raw < min) return min + rubberBand(raw - min, profile.rubber);
  if (raw > max) return max + rubberBand(raw - max, profile.rubber);
  return raw;
}

/** Tracks recent samples to estimate release velocity (units per second). */
export class VelocityTracker {
  private samples: { t: number; v: number }[] = [];
  constructor(private windowMs = 90) {}

  add(value: number, t: number) {
    this.samples.push({ t, v: value });
    while (this.samples.length > 2 && t - this.samples[0].t > this.windowMs) this.samples.shift();
  }

  velocity(now: number): number {
    const recent = this.samples.filter((s) => now - s.t <= this.windowMs);
    if (recent.length < 2) return 0;
    const first = recent[0];
    const last = recent[recent.length - 1];
    const dt = (last.t - first.t) / 1000;
    return dt > 0 ? (last.v - first.v) / dt : 0;
  }

  reset() {
    this.samples = [];
  }
}

/**
 * Where a flick would come to rest, mirroring Motion's inertia (decay)
 * maths: target = from + velocity * power, clamped. Below the profile's
 * flick threshold the control stays put.
 */
export function projectRelease(from: number, velocity: number, profile: WeightProfile, min = MIN, max = MAX): number {
  if (Math.abs(velocity) < profile.flickThreshold) return clampValue(from, min, max);
  return clampValue(from + velocity * profile.power, min, max);
}

/** Index of the detent nearest to an angle, for rotary switches. */
export function nearestDetent(angle: number, detents: number[]): number {
  let best = 0;
  for (let i = 1; i < detents.length; i++) {
    if (Math.abs(detents[i] - angle) < Math.abs(detents[best] - angle)) best = i;
  }
  return best;
}

/** A tiny vibration where the hardware supports it (most Android browsers); a no-op elsewhere. */
export function haptic(pattern: number | number[] = 8) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator && hapticsEnabled()) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Some browsers throw without a user activation; haptics are optional.
    }
  }
}

let hapticsOn = true;
export const setHapticsEnabled = (on: boolean) => {
  hapticsOn = on;
};
export const hapticsEnabled = () => hapticsOn;
