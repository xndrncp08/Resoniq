"use client";

import { memo, useRef, type ReactNode } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from "motion/react";
import { AudioLines, Columns3, Keyboard, Layers, Library, ListMusic, Minimize2, RotateCcw, SlidersHorizontal, Upload } from "lucide-react";
import { APP_KEYS, APPS } from "@/lib/studio/apps";
import { spring } from "@/lib/motion";
import { useWindowStore, useWindowStoreApi } from "@/lib/studio/store-context";
import type { AppKey } from "@/lib/studio/types";

const ICONS: Record<AppKey, ReactNode> = {
  songs: <ListMusic size={18} />,
  tone: <AudioLines size={18} />,
  library: <Library size={18} />,
  upload: <Upload size={18} />,
  "amp-lab": <SlidersHorizontal size={18} />,
  shortcuts: <Keyboard size={18} />,
};

/**
 * Launcher, running windows and arrange actions. Each running-window button
 * subscribes to its own window, so focus changes re-render two buttons, not
 * the dock.
 */
export default function Dock() {
  const order = useWindowStore((s) => s.order);
  // Running-window count per app, as a string so this re-renders only when a count changes.
  const counts = useWindowStore((s) => {
    const n: Partial<Record<AppKey, number>> = {};
    for (const w of Object.values(s.windows)) n[w.appKey] = (n[w.appKey] ?? 0) + 1;
    return APP_KEYS.map((k) => n[k] ?? 0).join(",");
  });
  const countFor = (k: AppKey) => Number(counts.split(",")[APP_KEYS.indexOf(k)]);
  const store = useWindowStoreApi();
  const a = store.getState();
  // Cursor x over the launcher, for magnification. Infinity = not hovering.
  const mouseX = useMotionValue(Infinity);

  return (
    <nav aria-label="Dock" className="pointer-events-none absolute inset-x-0 bottom-3 z-[9000] flex justify-center px-3">
      <div className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-bg-elevated/80 p-1.5 shadow-2xl backdrop-blur-xl">
        <div
          className="flex items-end gap-1"
          onPointerMove={(e) => mouseX.set(e.clientX)}
          onPointerLeave={() => mouseX.set(Infinity)}
        >
          {APP_KEYS.filter((k) => APPS[k].launchable).map((k) => (
            <LauncherButton key={k} label={APPS[k].label} count={countFor(k)} mouseX={mouseX} onClick={() => a.openWindow(k)}>
              {ICONS[k]}
            </LauncherButton>
          ))}
        </div>

        {order.length > 0 && <span aria-hidden className="mx-1 h-7 w-px flex-shrink-0 bg-white/10" />}
        <ul aria-label="Open windows" className="flex items-center gap-1">
          {order.map((id) => (
            <RunningWindow key={id} id={id} />
          ))}
        </ul>

        <span aria-hidden className="mx-1 h-7 w-px flex-shrink-0 bg-white/10" />
        <DockButton label="Minimize all (Alt+Shift+M)" onClick={() => a.minimizeAll()}>
          <Minimize2 size={16} />
        </DockButton>
        <DockButton label="Tile windows (Alt+Shift+T)" onClick={() => a.tileWindows()}>
          <Columns3 size={16} />
        </DockButton>
        <DockButton label="Cascade windows (Alt+Shift+C)" onClick={() => a.cascadeWindows()}>
          <Layers size={16} />
        </DockButton>
        <DockButton label="Reset layout" onClick={() => a.resetLayout()}>
          <RotateCcw size={16} />
        </DockButton>
      </div>
    </nav>
  );
}

/**
 * Launcher icon with macOS-style magnification: scale follows the cursor's
 * distance on a spring. Reduced motion keeps icons still. A dot marks a
 * running app; a number shows how many windows it has open.
 */
function LauncherButton({
  label,
  count,
  mouseX,
  onClick,
  children,
}: {
  label: string;
  count: number;
  mouseX: MotionValue<number>;
  onClick: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();
  const distance = useTransform(mouseX, (x) => {
    const r = ref.current?.getBoundingClientRect();
    return r ? x - (r.left + r.width / 2) : Infinity;
  });
  const target = useTransform(distance, [-110, 0, 110], [1, 1.4, 1]);
  const scale = useSpring(target, { stiffness: 420, damping: 30, mass: 0.4 });
  const name = count > 0 ? `${label} (${count} open)` : `Open ${label}`;

  return (
    <motion.button
      ref={ref}
      type="button"
      aria-label={name}
      title={name}
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      style={{ scale: reduce ? 1 : scale, transformOrigin: "50% 100%" }}
      className="focus-ring relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
    >
      {children}
      {count > 1 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-copper px-1 font-mono text-[9px] font-semibold leading-none text-bg">
          {count}
        </span>
      )}
      {count > 0 && <span aria-hidden className="absolute bottom-0.5 h-1 w-1 rounded-full bg-signal shadow-[0_0_6px_var(--color-signal)]" />}
    </motion.button>
  );
}

function DockButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.92 }}
      transition={spring.snappy}
      className="focus-ring flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
    >
      {children}
    </motion.button>
  );
}

const RunningWindow = memo(function RunningWindow({ id }: { id: string }) {
  const win = useWindowStore((s) => s.windows[id]);
  const store = useWindowStoreApi();
  if (!win) return null;

  // macOS-style: clicking the focused, visible window minimizes it; anything else brings it forward.
  const onClick = () => {
    const s = store.getState();
    if (win.isFocused && !win.isMinimized) s.minimizeWindow(id);
    else s.restoreWindow(id);
  };

  return (
    <li className="relative flex-shrink-0">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={win.isFocused}
        aria-label={`${win.title}${win.isMinimized ? " (minimized)" : ""}`}
        title={win.title}
        className={`focus-ring flex h-10 max-w-[150px] items-center gap-2 rounded-xl px-2.5 font-body text-xs transition-colors ${
          win.isFocused ? "bg-white/[0.08] text-ink" : "text-muted hover:bg-white/[0.04] hover:text-ink"
        } ${win.isMinimized ? "opacity-50" : ""}`}
      >
        <span aria-hidden className="flex-shrink-0">{ICONS[win.appKey]}</span>
        <span className="truncate">{win.title}</span>
      </button>
      {win.isFocused && (
        // One indicator shared across buttons: it slides to whichever window takes focus.
        <motion.span
          layoutId="dock-focus"
          transition={spring.snappy}
          aria-hidden
          className="absolute -bottom-1 left-1/2 h-1 w-4 -translate-x-1/2 rounded-full bg-signal shadow-[0_0_8px_var(--color-signal)]"
        />
      )}
    </li>
  );
});
