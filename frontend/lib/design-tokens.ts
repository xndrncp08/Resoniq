/**
 * Resoniq Design System
 * ----------------------
 * Brand thesis: an amp's tube glow meets a signal's oscilloscope trace.
 * Warm copper (tube warmth) against a deep instrument-panel charcoal,
 * with a cool signal-teal reserved for waveform/frequency visualization only —
 * so the two accents never compete, they narrate two different things
 * (gear = copper, sound-in-motion = teal).
 */

export const colors = {
  bg: "#0A0D12",          // near-black, faint blue-charcoal (instrument panel, not pure black)
  bgElevated: "#12161D",  // card/panel base before glass treatment
  surfaceGlass: "rgba(255,255,255,0.045)",
  borderGlass: "rgba(255,255,255,0.08)",
  textPrimary: "#F3EFE8", // warm off-white, like aged amp tolex piping
  textMuted: "#8B93A1",
  copper: "#FF8A3D",      // primary accent — tube glow / gear / CTAs
  copperDim: "#B85E1F",
  signalTeal: "#37E6C9",  // reserved ONLY for waveform / frequency / live-data
  danger: "#FF5D5D",
} as const;

export const type = {
  display: "'Space Grotesk', sans-serif",  // technical, geometric — instrument nameplates
  body: "'Inter', sans-serif",             // neutral reading face
  mono: "'IBM Plex Mono', monospace",      // numeric readouts: EQ %, Hz, gain
} as const;

export const radius = {
  sm: "8px",
  md: "14px",
  lg: "22px",
  pill: "999px",
} as const;

export const shadow = {
  glow: "0 0 40px -10px rgba(255,138,61,0.35)",
  panel: "0 8px 32px -8px rgba(0,0,0,0.5)",
} as const;
