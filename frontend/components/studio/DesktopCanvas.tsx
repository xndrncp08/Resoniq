"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import FloatingWindow from "@/components/studio/FloatingWindow";
import { useWindowStore, useWindowStoreApi } from "@/lib/studio/store-context";

// three.js and the post-processing stack load only once spatial mode is switched on.
const SpatialScene = dynamic(() => import("@/components/studio/spatial/SpatialScene"), { ssr: false });

// How far the stage tilts toward the cursor in spatial mode, in degrees.
const TILT_X = 1.6;
const TILT_Y = 2.4;

/**
 * The surface windows float on. It subscribes to `order` (changes only on
 * open/close) and the spatial flag, never to window positions or focus.
 *
 * Spatial mode wraps the windows in a perspective stage that tilts toward
 * the cursor (one transform on one element, whatever the window count)
 * over a WebGL scene. Windows stay real DOM, so text stays crisp and every
 * app works unchanged.
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
      {spatial && <SpatialScene store={store} pointer={{ x: sx, y: sy }} still={reduce} />}

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
