"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "motion/react";
import { routeFor, sceneState } from "@/components/scene/state";
import { useSettings } from "@/lib/settings/store";

// three.js, R3F and post-processing: their own chunk, fetched after the page is idle.
const SceneCanvas = dynamic(() => import("@/components/scene/SceneCanvas"), { ssr: false });

type Capability = { webgl: boolean; constrained: boolean };

function probe(): Capability {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  let webgl = false;
  try {
    webgl = !!document.createElement("canvas").getContext("webgl2");
  } catch {
    webgl = false;
  }
  return { webgl, constrained: !!nav.connection?.saveData || (nav.deviceMemory !== undefined && nav.deviceMemory < 4) };
}

/**
 * The shared background scene, mounted once in the root layout so it
 * persists across navigations (routes move the camera rather than
 * remounting anything).
 *
 * It only runs when it should: never without WebGL2, and on "auto" not for
 * reduced motion, Save-Data or low-memory devices. It loads after the page
 * has gone idle so it never competes with first paint. Forced on with
 * reduced motion, it renders still.
 */
export default function SceneRoot() {
  const settings = useSettings();
  const reduce = !!useReducedMotion();
  const pathname = usePathname();
  const [cap, setCap] = useState<Capability | null>(null);

  useEffect(() => {
    sceneState.route = routeFor(pathname);
  }, [pathname]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      sceneState.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      sceneState.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useEffect(() => {
    const ready = () => setCap(probe());
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(ready, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(ready, 1200);
    return () => clearTimeout(id);
  }, []);

  const enabled = !!cap?.webgl && (settings.scene === "on" || (settings.scene === "auto" && !reduce && !cap.constrained));

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      {enabled && <SceneCanvas quality={settings.quality} still={reduce} />}
      {/* Keeps text readable over the field: darker toward the top and edges. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_120%,transparent_30%,rgba(10,13,18,0.55)_75%),linear-gradient(to_bottom,rgba(10,13,18,0.7),rgba(10,13,18,0.15)_45%,transparent)]" />
    </div>
  );
}
