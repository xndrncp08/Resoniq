import { describe, expect, it } from "vitest";
import { APPS, MAX_WINDOWS } from "@/lib/studio/apps";
import { LayoutError, parseWorkspaceLayout } from "@/lib/studio/layout-validation";
import { createWindowStore, toLayout } from "@/lib/studio/window-store";

const viewport = { width: 1400, height: 800 };
const fresh = () => createWindowStore(null, viewport);

/** Asserts every entry except `changed` kept its object identity. */
function expectUntouched(before: Record<string, object>, after: Record<string, object>, changed: string[]) {
  for (const id of Object.keys(before)) {
    if (changed.includes(id)) continue;
    expect(after[id], `window ${id} should be the same object`).toBe(before[id]);
  }
}

describe("window store: stacking and focus", () => {
  it("opens windows on top and focused, cascading their positions", () => {
    const s = fresh();
    const a = s.getState().openWindow("amp-lab");
    const b = s.getState().openWindow("amp-lab");
    const { windows, focusedId, order, maxZIndex } = s.getState();
    expect(order).toEqual([a, b]);
    expect(focusedId).toBe(b);
    expect(windows[b].zIndex).toBe(maxZIndex);
    expect(windows[b].zIndex).toBeGreaterThan(windows[a].zIndex);
    expect(windows[a].isFocused).toBe(false);
    expect(windows[b].x).toBeGreaterThan(windows[a].x);
  });

  it("focusing raises one window and only touches the old and new focus", () => {
    const s = fresh();
    const ids = Array.from({ length: 5 }, () => s.getState().openWindow("amp-lab"));
    const before = s.getState().windows;
    s.getState().focusWindow(ids[1]);
    const after = s.getState().windows;
    expect(after[ids[1]].zIndex).toBe(s.getState().maxZIndex);
    expect(after[ids[1]].isFocused).toBe(true);
    expect(after[ids[4]].isFocused).toBe(false);
    expectUntouched(before, after, [ids[1], ids[4]]);
  });

  it("focusing the window that's already on top changes nothing", () => {
    const s = fresh();
    s.getState().openWindow("amp-lab");
    const top = s.getState().openWindow("amp-lab");
    const before = s.getState();
    s.getState().focusWindow(top);
    expect(s.getState()).toBe(before);
  });

  it("singletons and an already-open song focus instead of opening again", () => {
    const s = fresh();
    const lib = s.getState().openWindow("library");
    s.getState().openWindow("amp-lab");
    expect(s.getState().openWindow("library")).toBe(lib);
    const t = s.getState().openWindow("tone", { props: { songId: "song1" } });
    expect(s.getState().openWindow("tone", { props: { songId: "song1" } })).toBe(t);
    expect(s.getState().openWindow("tone", { props: { songId: "song2" } })).not.toBe(t);
    expect(s.getState().order).toHaveLength(4);
  });

  it("closing the focused window hands focus to the next one down", () => {
    const s = fresh();
    const a = s.getState().openWindow("amp-lab");
    const b = s.getState().openWindow("amp-lab");
    const c = s.getState().openWindow("amp-lab");
    s.getState().focusWindow(a);
    s.getState().focusWindow(c);
    s.getState().closeWindow(c);
    expect(s.getState().focusedId).toBe(a);
    expect(s.getState().windows[a].isFocused).toBe(true);
    expect(s.getState().order).toEqual([a, b]);
  });

  it("caps the number of windows", () => {
    const s = fresh();
    for (let i = 0; i < MAX_WINDOWS + 5; i++) s.getState().openWindow("amp-lab");
    expect(s.getState().order).toHaveLength(MAX_WINDOWS);
  });

  it("renumbers zIndex long before it grows unbounded, keeping the order", () => {
    const s = fresh();
    const a = s.getState().openWindow("amp-lab");
    const b = s.getState().openWindow("amp-lab");
    for (let i = 0; i < 6000; i++) s.getState().focusWindow(i % 2 ? a : b);
    const { windows, maxZIndex } = s.getState();
    expect(maxZIndex).toBeLessThan(5001);
    expect(windows[a].zIndex).toBeGreaterThan(windows[b].zIndex);
  });
});

describe("window store: bounds, minimize, maximize", () => {
  it("updateBounds changes one entry, clamps to the app minimum and keeps the title bar reachable", () => {
    const s = fresh();
    const a = s.getState().openWindow("amp-lab");
    const b = s.getState().openWindow("amp-lab");
    const before = s.getState().windows;
    s.getState().updateBounds(a, { x: -5000, y: -300, width: 10, height: 10 });
    const w = s.getState().windows[a];
    expect(w.width).toBe(APPS["amp-lab"].minSize.width);
    expect(w.height).toBe(APPS["amp-lab"].minSize.height);
    expect(w.y).toBe(0);
    expect(w.x + w.width).toBeGreaterThan(0);
    expectUntouched(before, s.getState().windows, [a]);
    expect(s.getState().windows[b]).toBe(before[b]);
  });

  it("an unchanged bounds update is a no-op", () => {
    const s = fresh();
    const a = s.getState().openWindow("amp-lab");
    const before = s.getState();
    const { x, y, width, height } = before.windows[a];
    s.getState().updateBounds(a, { x, y, width, height });
    expect(s.getState()).toBe(before);
  });

  it("maximize fills the canvas and restores the previous bounds", () => {
    const s = fresh();
    const a = s.getState().openWindow("amp-lab", { bounds: { x: 100, y: 80, width: 500, height: 450 } });
    s.getState().maximizeWindow(a);
    expect(s.getState().windows[a]).toMatchObject({ x: 0, y: 0, width: 1400, height: 800, isMaximized: true });
    s.getState().maximizeWindow(a);
    expect(s.getState().windows[a]).toMatchObject({ x: 100, y: 80, width: 500, height: 450, isMaximized: false });
  });

  it("dragging a maximized window un-maximizes it", () => {
    const s = fresh();
    const a = s.getState().openWindow("amp-lab");
    s.getState().maximizeWindow(a);
    s.getState().updateBounds(a, { x: 40 });
    expect(s.getState().windows[a].isMaximized).toBe(false);
  });

  it("minimize hides and passes focus on; restore brings it back on top", () => {
    const s = fresh();
    const a = s.getState().openWindow("amp-lab");
    const b = s.getState().openWindow("amp-lab");
    s.getState().minimizeWindow(b);
    expect(s.getState().windows[b]).toMatchObject({ isMinimized: true, isFocused: false });
    expect(s.getState().focusedId).toBe(a);
    s.getState().restoreWindow(b);
    expect(s.getState().windows[b]).toMatchObject({ isMinimized: false, isFocused: true });
    expect(s.getState().windows[b].zIndex).toBe(s.getState().maxZIndex);
  });

  it("minimizeAll leaves nothing focused", () => {
    const s = fresh();
    s.getState().openWindow("amp-lab");
    s.getState().openWindow("songs");
    s.getState().minimizeAll();
    expect(Object.values(s.getState().windows).every((w) => w.isMinimized && !w.isFocused)).toBe(true);
    expect(s.getState().focusedId).toBeNull();
  });
});

describe("window store: arranging", () => {
  it("tiles visible windows into a non-overlapping grid inside the canvas", () => {
    const s = fresh();
    const ids = Array.from({ length: 4 }, () => s.getState().openWindow("amp-lab"));
    s.getState().minimizeWindow(ids[3]);
    s.getState().tileWindows();
    const tiles = ids.slice(0, 3).map((id) => s.getState().windows[id]);
    for (const t of tiles) {
      expect(t.x + t.width).toBeLessThanOrEqual(viewport.width);
      expect(t.y + t.height).toBeLessThanOrEqual(viewport.height);
    }
    for (let i = 0; i < tiles.length; i++)
      for (let j = i + 1; j < tiles.length; j++) {
        const [p, q] = [tiles[i], tiles[j]];
        const overlap = p.x < q.x + q.width && q.x < p.x + p.width && p.y < q.y + q.height && q.y < p.y + p.height;
        expect(overlap).toBe(false);
      }
    expect(s.getState().windows[ids[3]].isMinimized).toBe(true);
  });

  it("cascade offsets windows in stacking order", () => {
    const s = fresh();
    const a = s.getState().openWindow("amp-lab");
    const b = s.getState().openWindow("amp-lab");
    s.getState().tileWindows();
    s.getState().cascadeWindows();
    const { windows } = s.getState();
    expect(windows[b].x - windows[a].x).toBe(32);
    expect(windows[b].y - windows[a].y).toBe(32);
  });

  it("a smaller viewport pulls stray windows back and resizes maximized ones, touching nothing else", () => {
    const s = fresh();
    const stray = s.getState().openWindow("amp-lab", { bounds: { x: 1200, y: 100 } });
    const maxed = s.getState().openWindow("amp-lab");
    const fine = s.getState().openWindow("amp-lab", { bounds: { x: 20, y: 20 } });
    s.getState().maximizeWindow(maxed);
    const before = s.getState().windows;
    s.getState().setViewport(900, 600);
    const after = s.getState().windows;
    expect(after[stray].x).toBeLessThanOrEqual(900 - 96);
    expect(after[maxed]).toMatchObject({ width: 900, height: 600 });
    expect(after[fine]).toBe(before[fine]);
  });

  it("resetLayout opens the default desktop", () => {
    const s = fresh();
    s.getState().openWindow("amp-lab");
    s.getState().resetLayout();
    expect(s.getState().order.map((id) => s.getState().windows[id].appKey)).toEqual(["songs", "library"]);
  });
});

describe("workspace layout round-trip and validation", () => {
  it("saves and rehydrates the exact desktop", () => {
    const s = fresh();
    s.getState().openWindow("songs");
    const t = s.getState().openWindow("tone", { props: { songId: "abc123" }, title: "My song" });
    s.getState().maximizeWindow(t);
    s.getState().minimizeWindow(s.getState().order[0]);
    const layout = parseWorkspaceLayout(JSON.parse(JSON.stringify(toLayout(s.getState()))));
    const restored = createWindowStore(layout, viewport);
    expect(restored.getState().order).toEqual(s.getState().order);
    for (const id of s.getState().order) {
      const { isFocused: _a, ...want } = s.getState().windows[id];
      const { isFocused: _b, ...got } = restored.getState().windows[id];
      expect(got).toEqual(want);
    }
    expect(restored.getState().focusedId).toBe(t);
  });

  it.each([
    ["wrong version", { version: 2, windows: [], focusedId: null }],
    ["unknown app", { version: 1, windows: [{ id: "x-0000abcd", appKey: "terminal" }], focusedId: null }],
    ["tone without a song", { version: 1, windows: [{ id: "tone-0000abcd", appKey: "tone", title: "t", props: {}, x: 0, y: 0, width: 1, height: 1, zIndex: 1, isMinimized: false, isMaximized: false, restoreBounds: null }], focusedId: null }],
    ["too many windows", { version: 1, windows: Array(MAX_WINDOWS + 1).fill({}), focusedId: null }],
    ["script in an id", { version: 1, windows: [{ id: "<script>", appKey: "songs" }], focusedId: null }],
  ])("rejects %s", (_label, input) => {
    expect(() => parseWorkspaceLayout(input)).toThrow(LayoutError);
  });

  it("clamps absurd geometry and drops props apps don't take", () => {
    const layout = parseWorkspaceLayout({
      version: 1,
      focusedId: "nope-00000000",
      windows: [
        { id: "songs-0000abcd", appKey: "songs", title: " Songs ", props: { songId: "x" }, x: 1e9, y: -1e9, width: 1e9, height: 0, zIndex: -5, isMinimized: false, isMaximized: false, restoreBounds: null },
      ],
    });
    expect(layout.windows[0]).toMatchObject({ title: "Songs", props: {}, x: 20000, y: -20000, width: 20000, height: 1, zIndex: 0 });
    expect(layout.focusedId).toBeNull();
  });
});

describe("window store: tiles stay put", () => {
  it("moving a tile smaller than the app minimum keeps its size", () => {
    const s = createWindowStore(null, { width: 1000, height: 600 });
    const ids = Array.from({ length: 4 }, () => s.getState().openWindow("amp-lab"));
    s.getState().tileWindows();
    const { width, height } = s.getState().windows[ids[0]];
    expect(height).toBeLessThan(APPS["amp-lab"].minSize.height);
    s.getState().updateBounds(ids[0], { x: 30, y: 40 });
    expect(s.getState().windows[ids[0]]).toMatchObject({ x: 30, y: 40, width, height });
  });
});

describe("spatial mode", () => {
  it("toggles without touching any window, and round-trips through the saved layout", () => {
    const s = fresh();
    s.getState().openWindow("songs");
    s.getState().openWindow("amp-lab");
    const before = s.getState().windows;
    s.getState().setSpatial(true);
    expect(s.getState().windows).toBe(before);
    const layout = parseWorkspaceLayout(JSON.parse(JSON.stringify(toLayout(s.getState()))));
    expect(layout.spatial).toBe(true);
    expect(createWindowStore(layout, viewport).getState().spatial).toBe(true);
  });

  it("treats layouts saved before spatial mode as flat, and rejects a non-boolean flag", () => {
    expect(parseWorkspaceLayout({ version: 1, windows: [], focusedId: null }).spatial).toBe(false);
    expect(() => parseWorkspaceLayout({ version: 1, windows: [], focusedId: null, spatial: "yes" })).toThrow(LayoutError);
  });
});
