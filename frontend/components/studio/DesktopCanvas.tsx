"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence } from "motion/react";
import FloatingWindow from "@/components/studio/FloatingWindow";
import { useWindowStore, useWindowStoreApi } from "@/lib/studio/store-context";

/**
 * The surface windows float on. It subscribes to `order` only, which changes
 * when windows open or close, never when they move or take focus, so the
 * canvas re-renders a handful of times per session.
 */
export default function DesktopCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const order = useWindowStore((s) => s.order);
  const store = useWindowStoreApi();

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
      // Clicking empty desktop clears nothing on purpose: losing focus by
      // accident while reaching for a window edge is more annoying than useful.
      className="relative min-h-0 flex-1 overflow-hidden"
      aria-label="Desktop"
    >
      <AnimatePresence>
        {order.map((id) => (
          <FloatingWindow key={id} id={id} />
        ))}
      </AnimatePresence>
      {order.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">open an app from the dock</p>
        </div>
      )}
    </div>
  );
}
