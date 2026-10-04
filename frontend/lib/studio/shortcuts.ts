/**
 * Studio keyboard shortcuts. All use Alt+Shift, which browsers and
 * operating systems leave alone (Ctrl/Cmd+W, +N, +T are reserved).
 */
export type ShortcutAction = "tile" | "cascade" | "minimizeAll" | "close" | "cycle" | "maximize" | "spatial";

/** `code`/`action` are absent for rows that only document a gesture (arrow keys on a focused title bar). */
export type Shortcut = { label: string; keys: string[]; code?: string; action?: ShortcutAction };

export const SHORTCUTS: Shortcut[] = [
  { label: "Tile windows", keys: ["Alt", "Shift", "T"], code: "KeyT", action: "tile" },
  { label: "Cascade windows", keys: ["Alt", "Shift", "C"], code: "KeyC", action: "cascade" },
  { label: "Minimize all", keys: ["Alt", "Shift", "M"], code: "KeyM", action: "minimizeAll" },
  { label: "Maximize or restore focused", keys: ["Alt", "Shift", "F"], code: "KeyF", action: "maximize" },
  { label: "Close focused window", keys: ["Alt", "Shift", "W"], code: "KeyW", action: "close" },
  { label: "Next window", keys: ["Alt", "Shift", "N"], code: "KeyN", action: "cycle" },
  { label: "Spatial mode on/off", keys: ["Alt", "Shift", "S"], code: "KeyS", action: "spatial" },
  { label: "Move a window (title bar focused)", keys: ["Arrows"] },
  { label: "Resize a window (title bar focused)", keys: ["Shift", "Arrows"] },
];
