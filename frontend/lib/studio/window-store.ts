import { createStore } from "zustand/vanilla";
import { APPS, MAX_WINDOWS } from "@/lib/studio/apps";
import type {
  AppKey,
  Bounds,
  OpenWindowOptions,
  SavedWindow,
  WindowInstance,
  WindowState,
  WindowStore,
  WorkspaceLayout,
} from "@/lib/studio/types";

/**
 * Window manager state.
 *
 * Re-render isolation is a property of how state changes, not of the
 * components: every action replaces only the `windows` entries it actually
 * changes and keeps every other entry's object identity. A window subscribed
 * to `windows[id]` therefore re-renders only when its own entry changes, and
 * the canvas, subscribed to `order`, only when windows open or close.
 *
 * Drags and resizes don't come through here frame by frame: windows move via
 * motion values and commit their final bounds once, at gesture end.
 */

const GAP = 12;
const CASCADE_STEP = 32;
const OFFSCREEN_KEEP = 96; // px of a window that must stay on the canvas
// zIndex grows with every focus; renumber long before it gets near the dock/overlay layers.
const Z_RENORMALIZE_AT = 5000;

const defaultViewport = { width: 1280, height: 760 };

function newId(appKey: AppKey) {
  return `${appKey}-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Keeps a window at least partly reachable, and no smaller than its app
 * allows in the dimensions listed in `enforceMin`. A plain move passes none,
 * so a window tiled below its preferred size doesn't jump bigger when dragged.
 */
export function clampBounds(
  b: Bounds,
  appKey: AppKey,
  viewport: WindowState["viewport"],
  enforceMin: { width?: boolean; height?: boolean } = { width: true, height: true },
): Bounds {
  const min = APPS[appKey].minSize;
  const minW = enforceMin.width ? min.width : 1;
  const minH = enforceMin.height ? min.height : 1;
  const width = Math.round(Math.max(minW, Math.min(b.width, Math.max(minW, viewport.width))));
  const height = Math.round(Math.max(minH, Math.min(b.height, Math.max(minH, viewport.height))));
  const x = Math.round(Math.min(Math.max(b.x, OFFSCREEN_KEEP - width), viewport.width - OFFSCREEN_KEEP));
  // The title bar must stay grabbable: never above the canvas, never below its bottom.
  const y = Math.round(Math.min(Math.max(b.y, 0), viewport.height - 40));
  return { x, y, width, height };
}

const boundsOf = (w: WindowInstance): Bounds => ({ x: w.x, y: w.y, width: w.width, height: w.height });

/** The topmost visible window other than `exceptId`, for handing focus on. */
function topmostVisible(windows: Record<string, WindowInstance>, exceptId?: string) {
  let top: WindowInstance | null = null;
  for (const w of Object.values(windows)) {
    if (w.id === exceptId || w.isMinimized) continue;
    if (!top || w.zIndex > top.zIndex) top = w;
  }
  return top;
}

/** Returns `windows` with only the given entries replaced (and the old focus cleared). */
function withFocus(state: WindowState, id: string | null, patch: Partial<WindowInstance> = {}) {
  const windows = { ...state.windows };
  let maxZIndex = state.maxZIndex;
  if (state.focusedId && state.focusedId !== id && windows[state.focusedId]) {
    windows[state.focusedId] = { ...windows[state.focusedId], isFocused: false };
  }
  if (id && windows[id]) {
    maxZIndex += 1;
    windows[id] = { ...windows[id], ...patch, isFocused: true, zIndex: maxZIndex };
  }
  return { windows, maxZIndex, focusedId: id };
}

/** Rewrites zIndex as 1..n in current stacking order. Touches every window, so it's rare. */
function renormalize(state: Pick<WindowState, "windows" | "maxZIndex">) {
  if (state.maxZIndex < Z_RENORMALIZE_AT) return state;
  const sorted = Object.values(state.windows).sort((a, b) => a.zIndex - b.zIndex);
  const windows: Record<string, WindowInstance> = {};
  sorted.forEach((w, i) => (windows[w.id] = { ...w, zIndex: i + 1 }));
  return { windows, maxZIndex: sorted.length };
}

function cascadeOrigin(count: number, viewport: WindowState["viewport"]) {
  const k = count % 8;
  return { x: Math.min(48 + k * CASCADE_STEP, viewport.width / 3), y: Math.min(24 + k * CASCADE_STEP, viewport.height / 3) };
}

export function toLayout(state: WindowState): WorkspaceLayout {
  return {
    version: 1,
    focusedId: state.focusedId,
    spatial: state.spatial,
    windows: state.order.map((id) => {
      const w = state.windows[id];
      const saved: SavedWindow = {
        id: w.id,
        appKey: w.appKey,
        title: w.title,
        props: w.props,
        x: w.x,
        y: w.y,
        width: w.width,
        height: w.height,
        zIndex: w.zIndex,
        isMinimized: w.isMinimized,
        isMaximized: w.isMaximized,
        restoreBounds: w.restoreBounds,
      };
      return saved;
    }),
  };
}

function stateFromLayout(layout: WorkspaceLayout): Omit<WindowState, "viewport" | "spatial"> {
  const windows: Record<string, WindowInstance> = {};
  let maxZIndex = 0;
  for (const s of layout.windows.slice(0, MAX_WINDOWS)) {
    windows[s.id] = { ...s, isFocused: s.id === layout.focusedId && !s.isMinimized };
    maxZIndex = Math.max(maxZIndex, s.zIndex);
  }
  const focusedId = layout.focusedId && windows[layout.focusedId] && !windows[layout.focusedId].isMinimized ? layout.focusedId : null;
  return { windows, order: Object.keys(windows), maxZIndex, focusedId };
}

export function createWindowStore(initial?: WorkspaceLayout | null, viewport = defaultViewport) {
  const base: WindowState = initial
    ? { ...stateFromLayout(initial), viewport, spatial: initial.spatial ?? false }
    : { windows: {}, order: [], maxZIndex: 0, focusedId: null, viewport, spatial: false };

  return createStore<WindowStore>()((set, get) => ({
    ...base,

    openWindow(appKey, options: OpenWindowOptions = {}) {
      const state = get();
      const meta = APPS[appKey];
      const existing = Object.values(state.windows).find(
        (w) =>
          w.appKey === appKey && (meta.singleton || (appKey === "tone" && !!options.props?.songId && w.props.songId === options.props.songId)),
      );
      if (existing) {
        set(withFocus(state, existing.id, { isMinimized: false }));
        return existing.id;
      }
      if (state.order.length >= MAX_WINDOWS) {
        // At the cap, recycle focus to the topmost window rather than silently doing nothing.
        const top = topmostVisible(state.windows);
        if (top) set(withFocus(state, top.id));
        return top?.id ?? "";
      }

      const id = newId(appKey);
      const origin = cascadeOrigin(state.order.length, state.viewport);
      const bounds = clampBounds(
        {
          x: options.bounds?.x ?? origin.x,
          y: options.bounds?.y ?? origin.y,
          width: options.bounds?.width ?? meta.defaultSize.width,
          height: options.bounds?.height ?? meta.defaultSize.height,
        },
        appKey,
        state.viewport,
      );
      const instance: WindowInstance = {
        id,
        appKey,
        title: options.title ?? meta.title,
        props: options.props ?? {},
        ...bounds,
        zIndex: 0,
        isMinimized: false,
        isMaximized: false,
        isFocused: false,
        restoreBounds: null,
      };
      const next = withFocus({ ...state, windows: { ...state.windows, [id]: instance } }, id);
      set({ ...next, ...renormalize(next), order: [...state.order, id] });
      return id;
    },

    closeWindow(id) {
      const state = get();
      if (!state.windows[id]) return;
      const windows = { ...state.windows };
      delete windows[id];
      const order = state.order.filter((o) => o !== id);
      if (state.focusedId === id) {
        const next = topmostVisible(windows);
        set({ ...withFocus({ ...state, windows, focusedId: null }, next?.id ?? null), order });
      } else {
        set({ windows, order });
      }
    },

    focusWindow(id) {
      const state = get();
      const w = state.windows[id];
      if (!w) return;
      // Already on top and focused: no state change, so nothing re-renders.
      if (state.focusedId === id && w.zIndex === state.maxZIndex && !w.isMinimized) return;
      const next = withFocus(state, id, { isMinimized: false });
      set({ ...next, ...renormalize(next) });
    },

    updateBounds(id, partial) {
      const state = get();
      const w = state.windows[id];
      if (!w) return;
      const bounds = clampBounds({ ...boundsOf(w), ...partial }, w.appKey, state.viewport, {
        width: partial.width !== undefined,
        height: partial.height !== undefined,
      });
      const same = bounds.x === w.x && bounds.y === w.y && bounds.width === w.width && bounds.height === w.height;
      if (same) return;
      // Moving or resizing a maximized window takes it out of maximized mode.
      set({ windows: { ...state.windows, [id]: { ...w, ...bounds, isMaximized: false, restoreBounds: w.isMaximized ? null : w.restoreBounds } } });
    },

    minimizeWindow(id) {
      const state = get();
      const w = state.windows[id];
      if (!w || w.isMinimized) return;
      const windows = { ...state.windows, [id]: { ...w, isMinimized: true, isFocused: false } };
      if (state.focusedId === id) {
        const next = topmostVisible(windows, id);
        set(withFocus({ ...state, windows, focusedId: null }, next?.id ?? null));
      } else {
        set({ windows });
      }
    },

    restoreWindow(id) {
      const state = get();
      if (!state.windows[id]) return;
      const next = withFocus(state, id, { isMinimized: false });
      set({ ...next, ...renormalize(next) });
    },

    maximizeWindow(id) {
      const state = get();
      const w = state.windows[id];
      if (!w) return;
      const patch: Partial<WindowInstance> = w.isMaximized
        ? { ...(w.restoreBounds ?? boundsOf(w)), isMaximized: false, restoreBounds: null }
        : { x: 0, y: 0, width: state.viewport.width, height: state.viewport.height, isMaximized: true, restoreBounds: boundsOf(w) };
      const next = withFocus(state, id, { ...patch, isMinimized: false });
      set({ ...next, ...renormalize(next) });
    },

    setTitle(id, title) {
      const state = get();
      const w = state.windows[id];
      if (!w || w.title === title) return;
      set({ windows: { ...state.windows, [id]: { ...w, title } } });
    },

    setBadge(id, badge) {
      const state = get();
      const w = state.windows[id];
      if (!w || (w.badge ?? null) === badge) return;
      set({ windows: { ...state.windows, [id]: { ...w, badge } } });
    },

    minimizeAll() {
      const state = get();
      const windows: Record<string, WindowInstance> = {};
      for (const [id, w] of Object.entries(state.windows)) {
        windows[id] = w.isMinimized ? w : { ...w, isMinimized: true, isFocused: false };
      }
      set({ windows, focusedId: null });
    },

    tileWindows() {
      const state = get();
      const visible = state.order.map((id) => state.windows[id]).filter((w) => !w.isMinimized);
      if (!visible.length) return;
      const cols = Math.ceil(Math.sqrt(visible.length));
      const rows = Math.ceil(visible.length / cols);
      const cellW = (state.viewport.width - GAP * (cols + 1)) / cols;
      const cellH = (state.viewport.height - GAP * (rows + 1)) / rows;
      const windows = { ...state.windows };
      visible.forEach((w, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        windows[w.id] = {
          ...w,
          x: Math.round(GAP + col * (cellW + GAP)),
          y: Math.round(GAP + row * (cellH + GAP)),
          // Exact cells, even below an app's preferred minimum: content
          // scrolls instead. Moving a tile later keeps its size (see clampBounds).
          width: Math.round(cellW),
          height: Math.round(cellH),
          isMaximized: false,
          restoreBounds: null,
        };
      });
      set({ windows });
    },

    cascadeWindows() {
      const state = get();
      const visible = Object.values(state.windows)
        .filter((w) => !w.isMinimized)
        .sort((a, b) => a.zIndex - b.zIndex);
      const windows = { ...state.windows };
      visible.forEach((w, i) => {
        const k = i % 10;
        windows[w.id] = {
          ...w,
          ...clampBounds(
            { x: 24 + k * CASCADE_STEP, y: 16 + k * CASCADE_STEP, width: APPS[w.appKey].defaultSize.width, height: APPS[w.appKey].defaultSize.height },
            w.appKey,
            state.viewport,
          ),
          isMaximized: false,
          restoreBounds: null,
        };
      });
      set({ windows });
    },

    resetLayout() {
      set({ windows: {}, order: [], maxZIndex: 0, focusedId: null });
      const { openWindow, viewport } = get();
      openWindow("songs", { bounds: { x: GAP * 2, y: GAP * 2 } });
      openWindow("library", { bounds: { x: Math.max(GAP * 2, viewport.width - APPS.library.defaultSize.width - GAP * 2), y: GAP * 2 } });
    },

    setViewport(width, height) {
      const state = get();
      if (state.viewport.width === width && state.viewport.height === height) return;
      const viewport = { width, height };
      const windows = { ...state.windows };
      let changed = false;
      for (const w of Object.values(state.windows)) {
        // Maximized windows follow the viewport; others are only pulled back if now out of reach.
        const target = w.isMaximized ? { x: 0, y: 0, width, height } : clampBounds(boundsOf(w), w.appKey, viewport, {});
        if (target.x !== w.x || target.y !== w.y || target.width !== w.width || target.height !== w.height) {
          windows[w.id] = { ...w, ...target };
          changed = true;
        }
      }
      set(changed ? { viewport, windows } : { viewport });
    },

    setSpatial(spatial) {
      if (get().spatial !== spatial) set({ spatial });
    },

    hydrate(layout) {
      set({ ...stateFromLayout(layout), spatial: layout.spatial ?? false });
    },
  }));
}

export type WindowStoreApi = ReturnType<typeof createWindowStore>;
