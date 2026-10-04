/**
 * The bridge between pages and the shared WebGL scene in the root layout.
 *
 * The scene lives outside every page's React tree and reads this object once
 * per frame, so publishing to it never re-renders anything: pages just write.
 * High-frequency inputs (pointer, audio) are plain fields; nothing here is
 * user data, so a client-side module singleton is fine.
 */

export type SceneRoute = "home" | "analyze" | "dashboard" | "library" | "studio" | "share" | "auth" | "other";

/** A rectangle in 0..1 canvas units, origin bottom-left (the field's grid space). */
export type Rect = [x0: number, y0: number, x1: number, y1: number];

export const sceneState = {
  route: "other" as SceneRoute,
  /** Cursor in -1..1 across the viewport (y down), for ripples and parallax. */
  pointer: { x: 0, y: 0 },
  /** Studio spatial mode: open (unfocused) windows and the focused one. Empty elsewhere. */
  windows: [] as Rect[],
  focus: null as Rect | null,
  /** 0..1 how busy the analysis pipeline is; the field brightens and quickens with it. */
  energy: 0,
  /** Live playback: overall level 0..1 and a coarse spectrum (low, mid, high bands, 0..1). */
  audio: { level: 0, low: 0, mid: 0, high: 0, playing: false },
};

export function routeFor(pathname: string): SceneRoute {
  if (pathname === "/") return "home";
  if (pathname === "/analyze") return "analyze";
  if (pathname.startsWith("/analyze/")) return "dashboard";
  if (pathname.startsWith("/library")) return "library";
  if (pathname.startsWith("/studio")) return "studio";
  if (pathname.startsWith("/t/")) return "share";
  if (pathname === "/login" || pathname === "/signup") return "auth";
  return "other";
}
