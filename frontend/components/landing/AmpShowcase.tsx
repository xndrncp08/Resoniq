"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import Icon from "@/components/icons/Icon";
import type { AmpSettings } from "@/types/tone";
import { AMP_KNOBS, clampKnob, type AmpKnob } from "@/lib/stores/rig-store";
import { webglAvailable } from "@/components/three/webgl";

const AmpScene = dynamic(() => import("@/components/three/AmpScene"), { ssr: false, loading: () => null });

const START: AmpSettings = { family: "Plexi", model: "Resoniq Plexi 50", gain: 62, bass: 48, mids: 70, treble: 58, presence: 52 };
const NAMES: Record<AmpKnob, string> = { gain: "Gain", bass: "Bass", mids: "Mids", treble: "Treble", presence: "Presence" };

/**
 * The hero's photograph is the first paint. Asking for the amp swaps in an
 * original, procedurally built 3D head (no third-party embed); the sliders
 * beneath it are the same five knobs for keyboards and screen readers.
 */
export default function AmpShowcase() {
  const [active, setActive] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [amp, setAmp] = useState(START);
  const trigger = useRef<HTMLButtonElement>(null);
  const setKnob = (k: AmpKnob, v: number) => setAmp((a) => ({ ...a, [k]: clampKnob(v) }));

  function open() {
    if (!webglAvailable()) return setUnsupported(true);
    setActive(true);
  }

  return (
    <div className="relative isolate overflow-hidden rounded-[24px] border border-line bg-bg-0 shadow-panel">
      <div className="relative aspect-[4/3] sm:aspect-[16/10]">
        {active ? (
          <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_10%,#1d2129_0%,#0b0d11_55%,#05070a_100%)]">
            <AmpScene amp={amp} onKnob={setKnob} className="!absolute inset-0" />
          </div>
        ) : (
          <>
            <Image src="/images/studio-guitar-1920.webp" alt="Black electric guitar, tube amplifier and copper and teal pedals in a warmly lit studio" fill sizes="(max-width: 1024px) 100vw, 62vw" preload className="object-cover object-[65%_center]" />
            <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/90 via-transparent to-transparent p-5 sm:p-8">
              <div>
                <p className="label-engraved mb-3 text-signal">Every tone opens on a real panel</p>
                <button ref={trigger} onClick={open} className="focus-ring inline-flex min-h-12 items-center gap-3 rounded-full bg-ink px-6 font-body text-sm font-semibold text-bg hover:bg-copper-soft">
                  <Icon name="play" size={18} /> Dial in the amp in 3D
                </button>
                <p className="mt-3 max-w-sm font-body text-xs text-ink-dim">{unsupported ? "This browser can't draw 3D. Every tone page still has the full knob panel." : "Built in Resoniq, drawn in your browser. Turn the knobs; the tubes answer the gain."}</p>
              </div>
            </div>
          </>
        )}
      </div>
      {active ? (
        <div className="grid grid-cols-5 gap-2 border-t border-line px-4 py-3 sm:px-5">
          {AMP_KNOBS.map((k) => (
            <label key={k} className="min-w-0 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted">
              <span className="flex justify-between gap-1"><span className="truncate">{NAMES[k]}</span><span className="tabular-nums text-ink">{amp[k]}</span></span>
              <input type="range" min={0} max={100} value={amp[k]} onChange={(e) => setKnob(k, e.target.valueAsNumber)} className="mt-1 h-6 w-full accent-copper" />
            </label>
          ))}
          <button type="button" onClick={() => { setActive(false); requestAnimationFrame(() => trigger.current?.focus()); }} className="col-span-5 justify-self-end rounded px-2 py-1 font-mono text-[11px] text-copper hover:text-ink">Close 3D amp</button>
        </div>
      ) : (
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 font-mono text-[11px] text-muted">
          <span>Original model · no downloads until you ask</span>
          <span>Drag knobs · sliders below</span>
        </div>
      )}
    </div>
  );
}
