import type { AmpKnob, AmpModelId, AmpSwitch } from "@/lib/studio/patch";
import type { GrilleKind, PanelFinish, PanelItem } from "@/components/studio/three/paint";

/** How each amp design is built: proportions, materials and hardware. Purely visual. */
export type Look = {
  size: [number, number, number];
  tolex: { color: string; grain: "pebble" | "leather" | "smooth"; roughness: number; sheen?: number };
  piping: string | null;
  front: { kind: GrilleKind; color: string; metalness: number; roughness: number; glow: string; backlight?: [string, string] };
  tubes: boolean;
  panel: PanelFinish & { metalness: number; roughness: number };
  knob: { style: "chicken" | "knurled" | "dome"; body: string; cap: string; pointer: string; metalness: number; roughness: number; glassy?: boolean };
  switches: "toggle" | "button";
  power: "rocker" | "led";
  corners: string | null;
  handle: { strap: string; ends: string };
  logo: string;
};

export const LOOKS: Record<AmpModelId, Look> = {
  halcyon: {
    size: [2.05, 0.86, 0.72],
    tolex: { color: "#e6dcc8", grain: "pebble", roughness: 0.72 },
    piping: null,
    front: { kind: "lattice", color: "#efe8da", metalness: 0.35, roughness: 0.45, glow: "#ff9a4a" },
    tubes: true,
    panel: { base: ["#16161a", "#0d0d10"], brushed: false, ink: "#efe8da", accent: "#efe8da", divider: "rgba(239,232,218,0.35)", metalness: 0.2, roughness: 0.6 },
    knob: { style: "chicken", body: "#141414", cap: "#1d1d1d", pointer: "#f3efe8", metalness: 0.1, roughness: 0.35 },
    switches: "toggle",
    power: "rocker",
    corners: "#1a1a1a",
    handle: { strap: "#5a3420", ends: "#c9ced6" },
    logo: "Halcyon 50",
  },
  basalt: {
    size: [2.1, 0.9, 0.78],
    tolex: { color: "#151516", grain: "leather", roughness: 0.62, sheen: 0.3 },
    piping: null,
    front: { kind: "hex", color: "#1b1c1f", metalness: 0.85, roughness: 0.38, glow: "#ff5a2a" },
    tubes: true,
    panel: { base: ["#3a3c41", "#26282c"], brushed: true, ink: "#e9e6e1", accent: "#ff4d3a", divider: "rgba(255,77,58,0.5)", metalness: 0.8, roughness: 0.35 },
    knob: { style: "knurled", body: "#101012", cap: "#2b2d31", pointer: "#ff4d3a", metalness: 0.6, roughness: 0.3 },
    switches: "toggle",
    power: "rocker",
    corners: "#c9ced6",
    handle: { strap: "#0f0f10", ends: "#c9ced6" },
    logo: "Basalt 120",
  },
  gilded: {
    size: [1.95, 0.84, 0.7],
    tolex: { color: "#ede4d3", grain: "smooth", roughness: 0.55 },
    piping: null,
    front: { kind: "kintsugi", color: "#ffffff", metalness: 0.1, roughness: 0.18, glow: "#ffcf7a" },
    tubes: false,
    panel: { base: ["#c9a76a", "#a8864c"], brushed: true, ink: "#2a1d12", accent: "#2a1d12", divider: "rgba(42,29,18,0.35)", metalness: 0.95, roughness: 0.32 },
    knob: { style: "dome", body: "#2c1a1e", cap: "#3a2328", pointer: "#e2c27e", metalness: 0.2, roughness: 0.28 },
    switches: "button",
    power: "led",
    corners: null,
    handle: { strap: "#1a1412", ends: "#c9a76a" },
    logo: "Kintsugi",
  },
  lumen: {
    size: [1.9, 0.78, 0.66],
    tolex: { color: "#eef0f2", grain: "smooth", roughness: 0.4 },
    piping: "#c9ced6",
    front: { kind: "slats", color: "#d4d8de", metalness: 0.9, roughness: 0.25, glow: "#cfe6ff" },
    tubes: true,
    panel: { base: ["#d9dde2", "#b9bec5"], brushed: true, ink: "#1f2329", accent: "#2d6cdf", divider: "rgba(31,35,41,0.25)", metalness: 0.9, roughness: 0.28 },
    knob: { style: "knurled", body: "#c9ced6", cap: "#eef0f3", pointer: "#2d6cdf", metalness: 0.95, roughness: 0.22 },
    switches: "toggle",
    power: "led",
    corners: "#c9ced6",
    handle: { strap: "#c9ced6", ends: "#c9ced6" },
    logo: "Lumen",
  },
  prism: {
    size: [2.0, 0.84, 0.72],
    tolex: { color: "#0b4c55", grain: "smooth", roughness: 0.32, sheen: 0.12 },
    piping: null,
    front: { kind: "glass", color: "#b9a8ff", metalness: 0.05, roughness: 0.15, glow: "#9b6bff", backlight: ["#7b4dff", "#2fe0d6"] },
    tubes: true,
    panel: { base: ["#cfd6dc", "#aeb6be"], brushed: true, ink: "#11313a", accent: "#11313a", divider: "rgba(17,49,58,0.3)", metalness: 0.85, roughness: 0.3 },
    knob: { style: "dome", body: "#6a3bd6", cap: "#8c63ff", pointer: "#e8fffd", metalness: 0.1, roughness: 0.08, glassy: true },
    switches: "button",
    power: "led",
    corners: null,
    handle: { strap: "#d9dde2", ends: "#d9dde2" },
    logo: "Prism",
  },
};

export type PanelSlot = PanelItem & { key?: AmpKnob | AmpSwitch };

/**
 * Where everything sits on a faceplate (u = 0..1 across it): input jack,
 * switches, knobs, power, then the logo. The painted labels and the 3D
 * controls both come from this, so they always line up.
 */
export function panelLayout(knobs: { key: AmpKnob; label: string }[], switches: { key: AmpSwitch; label: string }[]): PanelSlot[] {
  const items: PanelSlot[] = [{ u: 0.045, label: "Input", kind: "jack" }];
  let u = 0.105;
  for (const s of switches) {
    items.push({ u, label: s.label, kind: "switch", key: s.key });
    u += 0.058;
  }
  const start = u + 0.035;
  const end = 0.78;
  const step = knobs.length > 1 ? (end - start) / (knobs.length - 1) : 0;
  knobs.forEach((k, i) => items.push({ u: start + i * step, label: k.label, kind: "knob", key: k.key }));
  items.push({ u: 0.84, label: "Power", kind: "power" });
  return items;
}
