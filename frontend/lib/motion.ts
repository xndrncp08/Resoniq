import type { Transition } from "framer-motion";

/**
 * Shared motion tokens. Duration-based springs (Motion's `bounce` model)
 * for anything that moves: they settle naturally and stay interruptible,
 * unlike fixed duration + easing curves. `bounce: 0` for entrances so
 * nothing overshoots on load; a little bounce only for direct manipulation.
 */
export const spring = {
  /** Section and card entrances. */
  enter: { type: "spring", duration: 0.7, bounce: 0 },
  /** Selection indicators, toggles, list reflow. */
  snappy: { type: "spring", duration: 0.35, bounce: 0.15 },
  /** Layout changes (reorder, filter, remove). */
  layout: { type: "spring", duration: 0.45, bounce: 0.1 },
} satisfies Record<string, Transition>;

/** Stagger step between siblings in a group entrance. */
export const STAGGER_S = 0.06;
