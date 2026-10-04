"use client";

import { memo, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { animate, motion, useDragControls, useMotionValue, useReducedMotion, type Variants } from "motion/react";
import { Maximize2, Minimize2, Minus, X } from "lucide-react";
import { APPS } from "@/lib/studio/apps";
import { useWindowStore, useWindowStoreApi } from "@/lib/studio/store-context";
import { spring } from "@/lib/motion";
import { APP_COMPONENTS } from "@/components/studio/apps";

type Dir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const HANDLES: { dir: Dir; className: string }[] = [
  { dir: "n", className: "-top-1 inset-x-3 h-2 cursor-ns-resize" },
  { dir: "s", className: "-bottom-1 inset-x-3 h-2 cursor-ns-resize" },
  { dir: "e", className: "-right-1 inset-y-3 w-2 cursor-ew-resize" },
  { dir: "w", className: "-left-1 inset-y-3 w-2 cursor-ew-resize" },
  { dir: "ne", className: "-right-1 -top-1 h-4 w-4 cursor-nesw-resize" },
  { dir: "sw", className: "-bottom-1 -left-1 h-4 w-4 cursor-nesw-resize" },
  { dir: "nw", className: "-left-1 -top-1 h-4 w-4 cursor-nwse-resize" },
  { dir: "se", className: "-bottom-1 -right-1 h-4 w-4 cursor-nwse-resize" },
];

const KEY_STEP = 16;

const visibility: Variants = {
  open: { opacity: 1, scale: 1, visibility: "visible" },
  // Minimized windows stay mounted (audio keeps playing, edits survive) but
  // are hidden, inert and out of the paint after the animation.
  minimized: { opacity: 0, scale: 0.92, transitionEnd: { visibility: "hidden" } },
};

/**
 * One floating window. It subscribes to its own store entry only, so other
 * windows opening, moving or taking focus never re-render it.
 *
 * Position and size live in motion values written straight to the compositor
 * (transform, width, height). Dragging (Motion drag with gentle momentum,
 * bounded by the canvas) and the 8-way resize change only those values; the
 * store gets one update when the gesture ends. Store-driven changes (tile,
 * cascade, maximize, restore from a saved layout) animate the motion values
 * to the new bounds on a spring.
 */
function FloatingWindowImpl({ id }: { id: string }) {
  const live = useWindowStore((s) => s.windows[id]);
  // After a close, AnimatePresence keeps rendering this window for its exit
  // animation, but the store entry is already gone. Render the last state it
  // had (React's "adjust state while rendering" pattern, no effect needed).
  const [last, setLast] = useState(live);
  if (live && live !== last) setLast(live);
  const win = live ?? last;
  // Change only on canvas resize / mode switch, which re-render every window once.
  const viewport = useWindowStore((s) => s.viewport);
  const spatial = useWindowStore((s) => s.spatial);
  const store = useWindowStoreApi();
  const reduce = useReducedMotion();
  const dragControls = useDragControls();

  const x = useMotionValue(win.x);
  const y = useMotionValue(win.y);
  const width = useMotionValue(win.width);
  const height = useMotionValue(win.height);
  // Spatial depth: z and a slight turn toward the viewer, composed into the same transform.
  const z = useMotionValue(0);
  const rotateY = useMotionValue(0);
  // While a gesture runs, the motion values are the source of truth.
  const gesture = useRef<"drag" | "resize" | null>(null);
  const resizeStart = useRef<{ dir: Dir; px: number; py: number; x: number; y: number; w: number; h: number } | null>(null);

  useEffect(() => {
    if (gesture.current) return;
    const t = reduce ? { duration: 0 } : spring.layout;
    const running = [animate(x, win.x, t), animate(y, win.y, t), animate(width, win.width, t), animate(height, win.height, t)];
    return () => running.forEach((a) => a.stop());
  }, [win.x, win.y, win.width, win.height, x, y, width, height, reduce]);

  // Focus moves a window forward; the rest settle back. Windows off-center
  // angle in, like screens around a desk. Keyed off isFocused (which only
  // the old and new focused windows change), so focus still re-renders two.
  useEffect(() => {
    const centerX = (win.x + win.width / 2) / Math.max(1, viewport.width) - 0.5;
    const targetZ = !spatial || win.isMaximized ? 0 : win.isFocused ? 60 : -40;
    const targetRot = !spatial || win.isMaximized ? 0 : Math.max(-7, Math.min(7, -centerX * 12));
    const t = reduce ? { duration: 0 } : spring.layout;
    const running = [animate(z, targetZ, t), animate(rotateY, targetRot, t)];
    return () => running.forEach((a) => a.stop());
  }, [spatial, win.isFocused, win.isMaximized, win.x, win.width, viewport.width, z, rotateY, reduce]);

  const meta = APPS[win.appKey];
  const App = APP_COMPONENTS[win.appKey];
  const actions = store.getState();

  function commit() {
    store.getState().updateBounds(id, { x: x.get(), y: y.get(), width: width.get(), height: height.get() });
  }

  function startResize(dir: Dir, e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current = "resize";
    resizeStart.current = { dir, px: e.clientX, py: e.clientY, x: x.get(), y: y.get(), w: width.get(), h: height.get() };
    store.getState().focusWindow(id);
  }

  function moveResize(e: ReactPointerEvent<HTMLDivElement>) {
    const s = resizeStart.current;
    if (!s) return;
    const { width: vw, height: vh } = store.getState().viewport;
    const dx = e.clientX - s.px;
    const dy = e.clientY - s.py;
    let nx = s.x, ny = s.y, nw = s.w, nh = s.h;
    if (s.dir.includes("e")) nw = Math.min(s.w + dx, vw - s.x);
    if (s.dir.includes("s")) nh = Math.min(s.h + dy, vh - s.y);
    if (s.dir.includes("w")) {
      nw = s.w - Math.max(dx, -s.x);
      nx = s.x + (s.w - nw);
    }
    if (s.dir.includes("n")) {
      nh = s.h - Math.max(dy, -s.y);
      ny = s.y + (s.h - nh);
    }
    // Hold the opposite edge still when hitting the minimum size.
    if (nw < meta.minSize.width) {
      if (s.dir.includes("w")) nx -= meta.minSize.width - nw;
      nw = meta.minSize.width;
    }
    if (nh < meta.minSize.height) {
      if (s.dir.includes("n")) ny -= meta.minSize.height - nh;
      nh = meta.minSize.height;
    }
    x.set(nx);
    y.set(ny);
    width.set(nw);
    height.set(nh);
  }

  function endResize() {
    if (!resizeStart.current) return;
    resizeStart.current = null;
    gesture.current = null;
    commit();
  }

  function onTitleKeyDown(e: React.KeyboardEvent) {
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const step = arrows[e.key];
    if (step) {
      e.preventDefault();
      const s = store.getState().windows[id];
      store
        .getState()
        .updateBounds(
          id,
          e.shiftKey
            ? { width: s.width + step[0] * KEY_STEP, height: s.height + step[1] * KEY_STEP }
            : { x: s.x + step[0] * KEY_STEP, y: s.y + step[1] * KEY_STEP },
        );
    } else if (e.key === "Enter") {
      e.preventDefault();
      actions.maximizeWindow(id);
    }
  }

  const focused = win.isFocused;

  return (
    <motion.section
      role="dialog"
      aria-modal="false"
      aria-labelledby={`${id}-title`}
      inert={win.isMinimized}
      data-window={id}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={win.isMinimized ? "minimized" : "open"}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.14 } }}
      variants={visibility}
      transition={spring.snappy}
      drag={!win.isMaximized}
      dragControls={dragControls}
      dragListener={false}
      // Numeric bounds, not the canvas ref: with ref constraints Motion
      // rescales the position whenever the element's size changes, so every
      // resize would silently move the window away from its stored position.
      dragConstraints={{
        left: 0,
        top: 0,
        right: Math.max(0, viewport.width - win.width),
        bottom: Math.max(0, viewport.height - win.height),
      }}
      dragElastic={0.06}
      dragMomentum
      dragTransition={{ power: 0.16, timeConstant: 160, bounceStiffness: 520, bounceDamping: 42 }}
      onDragStart={() => (gesture.current = "drag")}
      onDragTransitionEnd={() => {
        if (gesture.current !== "drag") return;
        gesture.current = null;
        commit();
      }}
      onPointerDownCapture={() => store.getState().focusWindow(id)}
      style={{ x, y, z, rotateY, width, height, zIndex: win.zIndex, transformOrigin: "50% 100%" }}
      // The outer box only positions and stacks. The visible chrome is the
      // inner panel, which clips its content to the rounded corners; the
      // resize handles sit beside it so that clipping can't eat their hit areas.
      className="absolute left-0 top-0"
    >
      <div
        className={`flex h-full flex-col overflow-hidden rounded-xl border shadow-2xl [contain:layout_paint] ${
          focused
            ? // Only the focused window pays for backdrop blur; with 20 blurred,
              // overlapping windows every drag frame would re-blur all of them.
              "border-white/15 bg-bg-elevated/80 ring-1 ring-signal/30 backdrop-blur-xl"
            : "border-white/10 bg-bg-elevated/95"
        } ${win.isMaximized ? "rounded-none" : ""}`}
      >
        <header
          tabIndex={0}
          aria-label={`${win.title} window. Drag to move; arrow keys move, Shift+arrows resize, Enter maximizes.`}
          onPointerDown={(e) => {
            if (e.button === 0 && !win.isMaximized) dragControls.start(e);
          }}
          onDoubleClick={() => actions.maximizeWindow(id)}
          onKeyDown={onTitleKeyDown}
          className={`focus-ring flex h-10 flex-shrink-0 cursor-grab touch-none select-none items-center gap-3 border-b px-3 transition-opacity active:cursor-grabbing ${
            focused ? "border-white/10 opacity-100" : "border-white/[0.06] opacity-60"
          }`}
        >
          <div className="flex items-center gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
            <TrafficLight label={`Close ${win.title}`} tone="bg-[#FF5F57]" onClick={() => actions.closeWindow(id)}>
              <X size={8} strokeWidth={3} />
            </TrafficLight>
            <TrafficLight label={`Minimize ${win.title}`} tone="bg-[#FEBC2E]" onClick={() => actions.minimizeWindow(id)}>
              <Minus size={8} strokeWidth={3} />
            </TrafficLight>
            <TrafficLight
              label={`${win.isMaximized ? "Restore" : "Maximize"} ${win.title}`}
              tone="bg-[#28C840]"
              onClick={() => actions.maximizeWindow(id)}
            >
              {win.isMaximized ? <Minimize2 size={7} strokeWidth={3} /> : <Maximize2 size={7} strokeWidth={3} />}
            </TrafficLight>
          </div>
          <h2 id={`${id}-title`} className="min-w-0 flex-1 truncate text-center font-display text-[13px] font-medium">
            {win.title}
          </h2>
          <span className="flex min-w-[54px] justify-end">
            {win.badge && (
              <span className="rounded-full border border-signal/30 bg-signal/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-signal">
                {win.badge}
              </span>
            )}
          </span>
        </header>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-auto overscroll-contain">
          <App windowId={id} props={win.props} />
        </div>
      </div>

      {!win.isMaximized &&
        HANDLES.map((h) => (
          <div
            key={h.dir}
            aria-hidden
            onPointerDown={(e) => startResize(h.dir, e)}
            onPointerMove={moveResize}
            onPointerUp={endResize}
            onPointerCancel={endResize}
            className={`absolute z-10 touch-none ${h.className}`}
          />
        ))}
    </motion.section>
  );
}

function TrafficLight({
  label,
  tone,
  onClick,
  children,
}: {
  label: string;
  tone: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      // 12px dot, 24px hit area (the pseudo-element extends it).
      className={`focus-ring group/light relative flex h-3 w-3 items-center justify-center rounded-full text-black/60 before:absolute before:-inset-1.5 before:content-[''] ${tone}`}
    >
      <span className="opacity-0 transition-opacity group-hover/light:opacity-100 group-focus-visible/light:opacity-100">{children}</span>
    </button>
  );
}

export default memo(FloatingWindowImpl);
