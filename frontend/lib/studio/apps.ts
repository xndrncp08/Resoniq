import type { AppKey } from "@/lib/studio/types";

/**
 * Metadata for each Studio app. Components live in components/studio/apps
 * and load lazily; this file stays import-free so the window store and its
 * tests don't pull in any UI.
 */
export type AppMeta = {
  title: string;
  /** Short label for the dock. */
  label: string;
  defaultSize: { width: number; height: number };
  minSize: { width: number; height: number };
  /** Single-instance apps focus their existing window instead of opening another. */
  singleton: boolean;
  /** Shown in the dock's launcher. `tone` windows open from the song list instead. */
  launchable: boolean;
};

export const APPS: Record<AppKey, AppMeta> = {
  songs: {
    title: "Songs",
    label: "Songs",
    defaultSize: { width: 420, height: 520 },
    minSize: { width: 300, height: 260 },
    singleton: true,
    launchable: true,
  },
  tone: {
    title: "Tone",
    label: "Tone",
    defaultSize: { width: 980, height: 680 },
    minSize: { width: 520, height: 360 },
    singleton: false,
    launchable: false,
  },
  library: {
    title: "Library",
    label: "Library",
    defaultSize: { width: 860, height: 600 },
    minSize: { width: 420, height: 320 },
    singleton: true,
    launchable: true,
  },
  upload: {
    title: "Upload",
    label: "Upload",
    defaultSize: { width: 560, height: 480 },
    minSize: { width: 380, height: 320 },
    singleton: true,
    launchable: true,
  },
  "amp-lab": {
    title: "Amp & EQ lab",
    label: "Amp lab",
    defaultSize: { width: 520, height: 560 },
    minSize: { width: 420, height: 420 },
    singleton: false,
    launchable: true,
  },
  shortcuts: {
    title: "Keyboard shortcuts",
    label: "Shortcuts",
    defaultSize: { width: 420, height: 400 },
    minSize: { width: 320, height: 260 },
    singleton: true,
    launchable: true,
  },
};

export const APP_KEYS = Object.keys(APPS) as AppKey[];

/** Upper bound on open windows, so a runaway loop or a hostile saved layout can't spawn thousands. */
export const MAX_WINDOWS = 40;
