/**
 * Types for the Studio desktop: a canvas of floating windows, each hosting
 * one of Resoniq's tools.
 */

/** Position and size in CSS pixels, relative to the desktop canvas. */
export type Bounds = { x: number; y: number; width: number; height: number };

/** The tools a window can host. Keys are persisted, so never rename one. */
export type AppKey = "songs" | "tone" | "library" | "upload" | "amp-lab" | "shortcuts";

/** Per-app props. Only `tone` windows carry one: the song they show. */
export type AppProps = { songId?: string };

export type WindowInstance = {
  id: string;
  appKey: AppKey;
  title: string;
  props: AppProps;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  isMinimized: boolean;
  isMaximized: boolean;
  isFocused: boolean;
  /** Bounds to return to when un-maximizing. */
  restoreBounds: Bounds | null;
  /** Short status shown in the title bar (e.g. "analyzing"). Set by the app; not saved. */
  badge?: string | null;
};

export type WindowState = {
  /** Keyed by id so one window's update leaves every other entry untouched. */
  windows: Record<string, WindowInstance>;
  /** Ids in open order: what the canvas maps over. Changes only on open/close. */
  order: string[];
  /** Highest zIndex handed out so far. */
  maxZIndex: number;
  focusedId: string | null;
  /** Size of the desktop canvas, used to place, clamp and tile windows. */
  viewport: { width: number; height: number };
  /**
   * Spatial mode: a 3D scene behind the windows and depth on the windows
   * themselves (focus moves a window forward on z). Saved with the layout.
   */
  spatial: boolean;
};

export type OpenWindowOptions = {
  props?: AppProps;
  title?: string;
  bounds?: Partial<Bounds>;
};

export type WindowActions = {
  /** Opens (or, for single-instance apps and an already-open song, focuses) a window. Returns its id. */
  openWindow: (appKey: AppKey, options?: OpenWindowOptions) => string;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  updateBounds: (id: string, bounds: Partial<Bounds>) => void;
  minimizeWindow: (id: string) => void;
  /** Restores a minimized window and focuses it. */
  restoreWindow: (id: string) => void;
  /** Toggles maximized; the previous bounds are kept for the way back. */
  maximizeWindow: (id: string) => void;
  setTitle: (id: string, title: string) => void;
  setBadge: (id: string, badge: string | null) => void;
  minimizeAll: () => void;
  tileWindows: () => void;
  cascadeWindows: () => void;
  resetLayout: () => void;
  setViewport: (width: number, height: number) => void;
  setSpatial: (spatial: boolean) => void;
  /** Replaces the desktop with a saved layout (already validated). */
  hydrate: (layout: WorkspaceLayout) => void;
};

export type WindowStore = WindowState & WindowActions;

/** What gets saved per user: everything needed to rebuild the desktop. */
export type SavedWindow = Pick<
  WindowInstance,
  "id" | "appKey" | "title" | "props" | "x" | "y" | "width" | "height" | "zIndex" | "isMinimized" | "isMaximized" | "restoreBounds"
>;

export type WorkspaceLayout = {
  version: 1;
  windows: SavedWindow[];
  focusedId: string | null;
  /** Absent in layouts saved before spatial mode existed. */
  spatial?: boolean;
};
