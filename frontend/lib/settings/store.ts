"use client";

import { useSyncExternalStore } from "react";
import { setHapticsEnabled } from "@/components/ui/tactile/physics";

/**
 * Per-device display preferences, kept in localStorage. These are
 * conveniences for this browser (battery, motion sickness, a quiet phone),
 * not account data, so they don't sync. Reduced motion is deliberately not
 * here: the OS setting is the single source of truth for that.
 */
export type ScenePref = "auto" | "on" | "off";
export type QualityPref = "auto" | "high" | "low";

export type Settings = {
  /** The WebGL background. Auto turns it off for reduced motion, Save-Data and low-memory devices. */
  scene: ScenePref;
  quality: QualityPref;
  haptics: boolean;
};

const KEY = "resoniq:settings";
const DEFAULTS: Settings = { scene: "auto", quality: "auto", haptics: true };

let current: Settings = DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    if (raw && typeof raw === "object") {
      current = {
        scene: ["auto", "on", "off"].includes(raw.scene) ? raw.scene : DEFAULTS.scene,
        quality: ["auto", "high", "low"].includes(raw.quality) ? raw.quality : DEFAULTS.quality,
        haptics: typeof raw.haptics === "boolean" ? raw.haptics : DEFAULTS.haptics,
      };
    }
  } catch {
    // Private mode, blocked storage or junk: defaults are fine.
  }
  setHapticsEnabled(current.haptics);
}

export function getSettings(): Settings {
  load();
  return current;
}

export function updateSettings(patch: Partial<Settings>) {
  load();
  current = { ...current, ...patch };
  setHapticsEnabled(current.haptics);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Not persisted this time; still applies for this visit.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Current settings; the server (and first client render) see the defaults. */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, () => DEFAULTS);
}
