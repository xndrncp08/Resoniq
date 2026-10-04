"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import FloatingWindow from "@/components/studio/FloatingWindow";
import { sceneState, type Rect } from "@/components/scene/state";
import { useWindowStore, useWindowStoreApi } from "@/lib/studio/store-context";


// How far the stage tilts toward the cursor in spatial mode, in degrees.
const TILT_X = 1.6;
const TILT_Y = 2.4;

/**
 * The surface windows float on. It subscribes to `order` (changes only on
 * open/close) and the spatial flag, never to window positions or focus.
 *
 * Spatial mode wraps the windows in a perspective stage that tilts toward
 * the cursor (one transform on one element, whatever the window count) and
 * feeds window rects to the app's shared background scene. Windows stay
 * real DOM, so text stays crisp and every app works unchanged.
 */
export default function DesktopCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const order = useWindowStore((s) => s.order);
  const spatial = useWindowStore((s) => s.spatial);
  const store = useWindowStoreApi();
  const reduce = !!useReducedMotion();

  // Cursor in -1..1 across the canvas, smoothed so parallax eases instead of jittering.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 50, damping: 18, mass: 0.6 });
  const sy = useSpring(py, { stiffness: 50, damping: 18, mass: 0.6 });
  const tilt = spatial && !reduce;
  const rotateY = useTransform(sx, (v) => (tilt ? v * TILT_Y : 0));
  const rotateX = useTransform(sy, (v) => (tilt ? -v * TILT_X : 0));

  // Spatial mode: hand window rects to the shared background scene so the
  // field swells under them. Converted to full-viewport 0..1 space with the
  // origin bottom-left, which is how the field's grid is laid out.
  useEffect(() => {
    const clear = () => {
      sceneState.windows = [];
      sceneState.focus = null;
    };
    if (!spatial) return clear();
    const publish = () => {
      const el = canvasRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const { windows, focusedId } = store.getState();
      const toRect = (w: { x: number; y: number; width: number; height: number }): Rect => [
        (r.left + w.x) / vw,
        1 - (r.top + w.y + w.height) / vh,
        (r.left + w.x + w.width) / vw,
        1 - (r.top + w.y) / vh,
      ];
      const visible = Object.values(windows).filter((w) => !w.isMinimized);
      sceneState.windows = visible.filter((w) => w.id !== focusedId).map(toRect);
      const f = focusedId ? windows[focusedId] : null;
      sceneState.focus = f && !f.isMinimized ? toRect(f) : null;
    };
    publish();
    const unsubscribe = store.subscribe(publish);
    window.addEventListener("resize", publish);
    return () => {
      unsubscribe();
      window.removeEventListener("resize", publish);
      clear();
    };
  }, [spatial, store]);

  // The store needs the canvas size to place, clamp, tile and maximize.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      store.getState().setViewport(Math.round(width), Math.round(height));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [store]);

  return (
    <div
      ref={canvasRef}
      onPointerMove={(e) => {
        if (!spatial) return;
        const r = e.currentTarget.getBoundingClientRect();
        px.set(((e.clientX - r.left) / r.width) * 2 - 1);
        py.set(((e.clientY - r.top) / r.height) * 2 - 1);
      }}
      // Clicking empty desktop clears nothing on purpose: losing focus by
      // accident while reaching for a window edge is more annoying than useful.
      className="relative min-h-0 flex-1 overflow-hidden"
      style={spatial ? { perspective: 1800, perspectiveOrigin: "50% 40%" } : undefined}
      aria-label="Desktop"
    >
      {/* The stage is flat on purpose, with its own perspective: each window
          still renders with depth and angle, but windows are composited in
          zIndex order. In a preserve-3d context the browser would sort them
          by depth instead, and angled windows at equal depth intersect. */}
      <motion.div
        className="absolute inset-0"
        style={{ rotateX, rotateY, ...(spatial ? { perspective: 1600, perspectiveOrigin: "50% 45%" } : {}) }}
      >
        <AnimatePresence>
          {order.map((id) => (
            <FloatingWindow key={id} id={id} />
          ))}
        </AnimatePresence>
      </motion.div>

      {order.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">open an app from the dock</p>
        </div>
      )}
    </div>
  );
}
