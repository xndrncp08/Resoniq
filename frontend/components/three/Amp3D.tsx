"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Icon from "@/components/icons/Icon";
import type { AmpSettings } from "@/types/tone";
import type { AmpKnob } from "@/lib/stores/rig-store";
import { usePreferences, usePreferencesHydration } from "@/lib/stores/preferences";
import { decideScene3d, lowPowerDevice, webglAvailable } from "@/components/three/webgl";

// three.js and the scene download only when a 3D view is about to be seen.
const AmpScene = dynamic(() => import("@/components/three/AmpScene"), { ssr: false, loading: () => <Loading /> });

const noSubscribe = () => () => {};

function Loading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="label-engraved animate-pulse">Warming up the tubes…</span>
    </div>
  );
}

/** If WebGL fails mid-flight (context creation, driver), drop the 3D view; the HTML controls stay. */
class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * A 3D amp head whose knobs are the tone's knobs. Mounts when scrolled near,
 * honours the device's 3D preference, and disappears cleanly without WebGL.
 */
export default function Amp3D({ amp, onKnob, caption, className = "" }: { amp: AmpSettings; onKnob?: (knob: AmpKnob, value: number) => void; caption?: ReactNode; className?: string }) {
  usePreferencesHydration();
  const pref = usePreferences((s) => s.scene3d);
  const setPref = usePreferences((s) => s.setScene3d);
  // null while server rendering; the probe runs once in the browser.
  const probed = useSyncExternalStore(noSubscribe, webglAvailable, () => null);
  const [failed, setFailed] = useState(false);
  const supported = probed === null ? null : probed && !failed;
  const [near, setNear] = useState(false);
  // Data saver or a low-memory device: draw the amp only when asked.
  const manual = useSyncExternalStore(noSubscribe, lowPowerDevice, () => false) && !near;
  const box = useRef<HTMLDivElement>(null);

  // Mount only once the stage is on screen and the browser is idle, so the 3D
  // parse and shader compile never compete with the page's own load.
  useEffect(() => {
    const el = box.current;
    if (!el || near || manual) return;
    let idle = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      idle = typeof requestIdleCallback === "function" ? requestIdleCallback(() => setNear(true), { timeout: 2500 }) : window.setTimeout(() => setNear(true), 300);
    }, { threshold: 0.25 });
    io.observe(el);
    return () => {
      io.disconnect();
      if (typeof cancelIdleCallback === "function") cancelIdleCallback(idle);
      else clearTimeout(idle);
    };
  }, [near, manual, pref, supported]);

  const decision = supported === null ? null : decideScene3d(pref, supported);
  if (decision === "unsupported") return null;
  if (decision === "hidden") {
    return (
      <button type="button" onClick={() => setPref("auto")} className={`focus-ring inline-flex h-9 items-center gap-2 rounded-full border border-line px-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted hover:border-copper/50 hover:text-ink ${className}`}>
        <Icon name="tone" size={14} /> Show 3D amp
      </button>
    );
  }

  return (
    <figure className={`relative overflow-hidden rounded-panel border border-line bg-[radial-gradient(120%_90%_at_50%_0%,#1b1f27_0%,#0b0d11_60%,#06080b_100%)] ${className}`}>
      <div ref={box} className="relative aspect-[16/9] w-full sm:aspect-[21/9]">
        {manual && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button type="button" onClick={() => setNear(true)} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-surface-2 px-5 font-body text-sm text-ink hover:border-copper/50">
              <Icon name="play" size={16} /> Load the 3D amp
            </button>
          </div>
        )}
        {near && decision === "render" && (
          <SceneBoundary onError={() => setFailed(true)}>
            <AmpScene amp={amp} onKnob={onKnob} className="!absolute inset-0" />
          </SceneBoundary>
        )}
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5">
        <span className="font-body text-xs text-muted">{caption}</span>
        <button type="button" onClick={() => setPref("off")} className="focus-ring rounded-full px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted hover:text-ink">
          Hide 3D
        </button>
      </figcaption>
    </figure>
  );
}
