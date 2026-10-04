import { APPS, MAX_WINDOWS } from "@/lib/studio/apps";
import type { AppKey, Bounds, SavedWindow, WorkspaceLayout } from "@/lib/studio/types";

/**
 * Validates a workspace layout coming back from the client before it's
 * stored or rendered. Anything unknown is rejected; numbers are bounded so
 * a tampered layout can't produce absurd geometry.
 */

export class LayoutError extends Error {}

const ID = /^[a-z-]{1,16}-[0-9a-f]{8}$/;
const SONG_ID = /^[A-Za-z0-9_-]{1,64}$/;
const COORD = 20000;

function fail(message: string): never {
  throw new LayoutError(message);
}

function obj(v: unknown, field: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) fail(`${field} must be an object.`);
  return v as Record<string, unknown>;
}

function num(v: unknown, field: string, min: number, max: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) fail(`${field} must be a number.`);
  return Math.round(Math.max(min, Math.min(max, v)));
}

function bool(v: unknown, field: string): boolean {
  if (typeof v !== "boolean") fail(`${field} must be a boolean.`);
  return v;
}

function bounds(v: unknown, field: string): Bounds {
  const b = obj(v, field);
  return {
    x: num(b.x, `${field}.x`, -COORD, COORD),
    y: num(b.y, `${field}.y`, -COORD, COORD),
    width: num(b.width, `${field}.width`, 1, COORD),
    height: num(b.height, `${field}.height`, 1, COORD),
  };
}

function savedWindow(v: unknown, i: number): SavedWindow {
  const w = obj(v, `windows[${i}]`);
  if (typeof w.id !== "string" || !ID.test(w.id)) fail(`windows[${i}].id is invalid.`);
  if (typeof w.appKey !== "string" || !(w.appKey in APPS)) fail(`windows[${i}].appKey is unknown.`);
  const appKey = w.appKey as AppKey;
  if (typeof w.title !== "string" || !w.title.trim() || w.title.length > 120) fail(`windows[${i}].title is invalid.`);

  const props = obj(w.props ?? {}, `windows[${i}].props`);
  let songId: string | undefined;
  if (appKey === "tone") {
    if (typeof props.songId !== "string" || !SONG_ID.test(props.songId)) fail(`windows[${i}].props.songId is invalid.`);
    songId = props.songId;
  }

  const b = bounds(w, `windows[${i}]`);
  return {
    id: w.id,
    appKey,
    title: w.title.trim(),
    props: songId ? { songId } : {},
    ...b,
    zIndex: num(w.zIndex, `windows[${i}].zIndex`, 0, 1_000_000),
    isMinimized: bool(w.isMinimized, `windows[${i}].isMinimized`),
    isMaximized: bool(w.isMaximized, `windows[${i}].isMaximized`),
    restoreBounds: w.restoreBounds === null || w.restoreBounds === undefined ? null : bounds(w.restoreBounds, `windows[${i}].restoreBounds`),
  };
}

export function parseWorkspaceLayout(v: unknown): WorkspaceLayout {
  const layout = obj(v, "layout");
  if (layout.version !== 1) fail("layout.version must be 1.");
  if (!Array.isArray(layout.windows) || layout.windows.length > MAX_WINDOWS) {
    fail(`layout.windows must be a list of at most ${MAX_WINDOWS} windows.`);
  }
  const windows = layout.windows.map(savedWindow);
  if (new Set(windows.map((w) => w.id)).size !== windows.length) fail("layout.windows has duplicate ids.");
  const focusedId = typeof layout.focusedId === "string" && windows.some((w) => w.id === layout.focusedId) ? layout.focusedId : null;
  if (layout.spatial !== undefined && typeof layout.spatial !== "boolean") fail("layout.spatial must be a boolean.");
  return { version: 1, windows, focusedId, spatial: layout.spatial === true };
}
