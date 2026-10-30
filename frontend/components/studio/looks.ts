import type { CSSProperties } from "react";
import type { AmpModelId, CabModelId } from "@/lib/studio/patch";

/**
 * How each amp design is drawn: covering, grille, faceplate and hardware.
 * Purely visual; the sound lives in lib/studio/dsp.ts.
 */
export type KnobLook = "chicken" | "knurled" | "dome" | "skirted" | "pedal" | "rack";
export type GrilleLook = { kind: "cloth" | "slats" | "hex" | "glass" | "plate" | "diamond"; color: string; accent?: string };

export type AmpLook = {
  tolex: string;
  /** Tolex grain: leather/pebble use the noise texture, tweed a diagonal weave, wood a grain. */
  grain: "pebble" | "leather" | "smooth" | "tweed" | "wood";
  piping: string | null;
  grille: GrilleLook;
  panel: { background: string; ink: string; accent: string; brushed: boolean };
  knob: KnobLook;
  jewel: string;
  logo: { color: string; font: "script" | "block" | "serif" | "mono" };
  corners: string | null;
};

export const AMP_LOOKS: Record<AmpModelId, AmpLook> = {
  lumen: {
    tolex: "#e9ecef", grain: "smooth", piping: "#b9bec5",
    grille: { kind: "slats", color: "#cfd4da" },
    panel: { background: "linear-gradient(180deg,#e2e6ea,#b9bec5)", ink: "#1f2329", accent: "#2d6cdf", brushed: true },
    knob: "knurled", jewel: "#7fb6ff", logo: { color: "#2d6cdf", font: "block" }, corners: "#c9ced6",
  },
  atlas: {
    tolex: "#151515", grain: "pebble", piping: null,
    grille: { kind: "cloth", color: "#9aa0a6", accent: "#c8ccd1" },
    panel: { background: "linear-gradient(180deg,#1a1a1c,#0d0d0f)", ink: "#e9e6e1", accent: "#d8dbe0", brushed: false },
    knob: "skirted", jewel: "#ff3b30", logo: { color: "#e9e6e1", font: "script" }, corners: "#c9ced6",
  },
  juniper: {
    tolex: "#c8a96a", grain: "tweed", piping: null,
    grille: { kind: "cloth", color: "#6b3a24", accent: "#8a5232" },
    panel: { background: "linear-gradient(180deg,#e7e9ec,#a9adb3)", ink: "#1a1a1a", accent: "#1a1a1a", brushed: true },
    knob: "chicken", jewel: "#ff4b2b", logo: { color: "#f3e7c9", font: "script" }, corners: null,
  },
  bellwether: {
    tolex: "#2a1517", grain: "leather", piping: "#d8c7a0",
    grille: { kind: "diamond", color: "#5a3a2a", accent: "#b8945c" },
    panel: { background: "linear-gradient(180deg,#c98a52,#8c5a2e)", ink: "#1d1209", accent: "#1d1209", brushed: true },
    knob: "chicken", jewel: "#ff3b30", logo: { color: "#e6d6b0", font: "serif" }, corners: "#c9ced6",
  },
  halcyon: {
    tolex: "#e6dcc8", grain: "pebble", piping: null,
    grille: { kind: "cloth", color: "#d8cdb6", accent: "#efe8da" },
    panel: { background: "linear-gradient(180deg,#1a1a1e,#0d0d10)", ink: "#efe8da", accent: "#efe8da", brushed: false },
    knob: "chicken", jewel: "#ff9a4a", logo: { color: "#3a2a1a", font: "serif" }, corners: "#1a1a1a",
  },
  gilded: {
    tolex: "#ede4d3", grain: "smooth", piping: null,
    grille: { kind: "cloth", color: "#f3ede2", accent: "#c9a76a" },
    panel: { background: "linear-gradient(180deg,#d7b778,#a8864c)", ink: "#2a1d12", accent: "#2a1d12", brushed: true },
    knob: "dome", jewel: "#ffcf7a", logo: { color: "#a8864c", font: "serif" }, corners: null,
  },
  monarch: {
    tolex: "#4a2c1a", grain: "wood", piping: "#c9a24a",
    grille: { kind: "cloth", color: "#b39b74", accent: "#d1bc94" },
    panel: { background: "linear-gradient(180deg,#d4b260,#9c7c33)", ink: "#1c1408", accent: "#1c1408", brushed: true },
    knob: "dome", jewel: "#5bd68b", logo: { color: "#c9a24a", font: "script" }, corners: null,
  },
  basalt: {
    tolex: "#151516", grain: "leather", piping: null,
    grille: { kind: "hex", color: "#1b1c1f", accent: "#3a3c41" },
    panel: { background: "linear-gradient(180deg,#3a3c41,#232529)", ink: "#e9e6e1", accent: "#ff4d3a", brushed: true },
    knob: "knurled", jewel: "#ff4d3a", logo: { color: "#e9e6e1", font: "block" }, corners: "#c9ced6",
  },
  foundry: {
    tolex: "#0f0f10", grain: "pebble", piping: null,
    grille: { kind: "plate", color: "#9da3aa" },
    panel: { background: "linear-gradient(180deg,#121214,#050506)", ink: "#f2f2f2", accent: "#ff2a2a", brushed: false },
    knob: "skirted", jewel: "#ff2a2a", logo: { color: "#ff2a2a", font: "block" }, corners: "#c9ced6",
  },
  prism: {
    tolex: "#0b4c55", grain: "smooth", piping: "#7fe3ee",
    grille: { kind: "glass", color: "#9fe6ee", accent: "#37e6c9" },
    panel: { background: "linear-gradient(180deg,rgba(18,34,40,.92),rgba(8,16,20,.96))", ink: "#dffbff", accent: "#37e6c9", brushed: false },
    knob: "dome", jewel: "#37e6c9", logo: { color: "#dffbff", font: "mono" }, corners: null,
  },
};

export type CabLook = { tolex: string; grain: AmpLook["grain"]; grille: GrilleLook; piping: string | null };
export const CAB_LOOKS: Record<CabModelId, CabLook> = {
  "4x12-closed": { tolex: "#141415", grain: "leather", grille: { kind: "cloth", color: "#2a2a2c", accent: "#4a4a4e" }, piping: "#cfcfcf" },
  "2x12-closed": { tolex: "#1b1b1d", grain: "pebble", grille: { kind: "cloth", color: "#3a3226", accent: "#6a5a40" }, piping: null },
  "2x12-open": { tolex: "#e6dcc8", grain: "pebble", grille: { kind: "cloth", color: "#d8cdb6", accent: "#efe8da" }, piping: null },
  "4x10-open": { tolex: "#c8a96a", grain: "tweed", grille: { kind: "cloth", color: "#6b3a24", accent: "#8a5232" }, piping: null },
  "1x12-open": { tolex: "#2a1517", grain: "leather", grille: { kind: "diamond", color: "#5a3a2a", accent: "#b8945c" }, piping: "#d8c7a0" },
  "1x10-open": { tolex: "#4a2c1a", grain: "wood", grille: { kind: "cloth", color: "#b39b74", accent: "#d1bc94" }, piping: null },
};

// A static noise tile for tolex grain (no runtime cost beyond one decoded image).
const NOISE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

/** CSS background for a covering. */
export function tolexStyle(color: string, grain: AmpLook["grain"]): CSSProperties {
  const shade = "linear-gradient(180deg,rgba(255,255,255,.07),rgba(0,0,0,.28))";
  const layers: Record<AmpLook["grain"], string> = {
    pebble: `${shade},${NOISE}`,
    leather: `${shade},${NOISE}`,
    smooth: shade,
    tweed: `${shade},repeating-linear-gradient(45deg,rgba(60,35,10,.35) 0 2px,transparent 2px 5px),repeating-linear-gradient(-45deg,rgba(255,240,200,.18) 0 1px,transparent 1px 6px)`,
    wood: `${shade},repeating-linear-gradient(92deg,rgba(0,0,0,.18) 0 2px,transparent 2px 9px,rgba(255,220,170,.06) 9px 11px,transparent 11px 17px)`,
  };
  return { backgroundColor: color, backgroundImage: layers[grain], backgroundSize: grain === "pebble" || grain === "leather" ? "auto, 160px 160px" : undefined };
}

/** CSS background for a grille. */
export function grilleStyle(g: GrilleLook): CSSProperties {
  const a = g.accent ?? g.color;
  switch (g.kind) {
    case "cloth":
      return { backgroundColor: g.color, backgroundImage: `repeating-linear-gradient(45deg,${a}55 0 1px,transparent 1px 4px),repeating-linear-gradient(-45deg,rgba(0,0,0,.35) 0 1px,transparent 1px 4px),radial-gradient(120% 90% at 50% 40%,transparent 50%,rgba(0,0,0,.35))` };
    case "diamond":
      return { backgroundColor: g.color, backgroundImage: `linear-gradient(45deg,${a}66 1px,transparent 1px),linear-gradient(-45deg,${a}66 1px,transparent 1px),radial-gradient(120% 90% at 50% 40%,transparent 50%,rgba(0,0,0,.4))`, backgroundSize: "14px 14px,14px 14px,auto" };
    case "slats":
      return { backgroundColor: g.color, backgroundImage: "repeating-linear-gradient(90deg,rgba(255,255,255,.55) 0 2px,rgba(0,0,0,.25) 2px 4px,transparent 4px 12px),linear-gradient(180deg,rgba(255,255,255,.25),rgba(0,0,0,.25))" };
    case "hex":
      return { backgroundColor: g.color, backgroundImage: `radial-gradient(circle at 50% 50%,#050506 38%,transparent 40%),radial-gradient(circle at 0 0,#050506 38%,transparent 40%),radial-gradient(circle at 100% 100%,#050506 38%,transparent 40%),linear-gradient(180deg,${a},${g.color})`, backgroundSize: "10px 10px,10px 10px,10px 10px,auto" };
    case "plate":
      return { backgroundColor: g.color, backgroundImage: "repeating-linear-gradient(45deg,rgba(255,255,255,.35) 0 2px,transparent 2px 12px),repeating-linear-gradient(-45deg,rgba(0,0,0,.25) 0 2px,transparent 2px 12px),linear-gradient(180deg,#c7ccd2,#6f757c)" };
    case "glass":
      return { backgroundColor: "#0a2a30", backgroundImage: `radial-gradient(80% 120% at 50% 110%,${a}88,transparent 60%),linear-gradient(180deg,${g.color}33,${g.color}11),repeating-linear-gradient(90deg,rgba(255,255,255,.04) 0 1px,transparent 1px 6px)` };
  }
}

export function brushed(background: string): string {
  return `repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 1px,rgba(0,0,0,.04) 1px 2px,transparent 2px 3px),${background}`;
}
