"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";
import Icon from "@/components/icons/Icon";
import { LinkButton } from "@/components/app/ui";
import { webglAvailable } from "@/components/three/webgl";
import { AMP_DESIGNS, CAB_DESIGNS, EFFECT_DESIGNS, type StudioPatch } from "@/lib/studio/patch";
import type { StudioView } from "@/lib/stores/studio-store";

const StudioScene = dynamic(() => import("@/components/studio/three/StudioScene"), { ssr: false, loading: () => null });
const noop = () => {};

// Honest about where the settings come from: only a studio patch is the member's own dialled sound.
const FROM: Record<string, string> = {
  studio: "Dialled in the Amp Studio",
  device: "A TANK-G preset",
  analysis: "Starting point from an analysis",
  rig: "From the rig they described",
  default: "Studio defaults",
};

/**
 * A member's signature tone, drawn as its amp, cab and pedals. The summary is
 * plain HTML; the 3D scene (the same equipment as the Amp Studio) loads only
 * when someone asks for it, so profiles stay light on phones.
 */
export default function SignatureRig({ tone, patch, from }: { tone: { id: string; name: string }; patch: StudioPatch; from: string }) {
  const [view, setView] = useState<StudioView | null>(null);
  const [no3d, setNo3d] = useState(false);
  const amp = AMP_DESIGNS[patch.amp.model];
  const chain = patch.effects.filter((e) => e.on);

  return (
    <section aria-labelledby="signature-h" className="panel overflow-hidden">
      <div className="relative aspect-[16/10] bg-[radial-gradient(120%_90%_at_50%_10%,#1d2129_0%,#0b0d11_55%,#05070a_100%)]">
        {view ? (
          <StudioScene className="!absolute inset-0" patch={patch} view={view} knobs={amp.knobs} switches={amp.switches} powered onKnob={noop} onSwitch={noop} onPower={noop} onMic={noop} onEffectParam={noop} onEffectToggle={noop} />
        ) : (
          <div className="absolute inset-0 flex flex-col justify-end p-4">
            {/* An engraved panel readout of the amp's real settings, before any 3D loads. */}
            <div className="grid grid-cols-4 gap-x-2 gap-y-3 rounded-xl border border-white/10 bg-black/40 p-3 backdrop-blur-sm sm:grid-cols-7 lg:grid-cols-4">
              {amp.knobs.map((k) => (
                <div key={k.key} className="text-center">
                  <div className="mx-auto h-8 w-8 rounded-full border border-white/15 bg-gradient-to-b from-[#2a2e36] to-[#121418] shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]" style={{ transform: `rotate(${(patch.amp[k.key] / 10) * 270 - 135}deg)` }} aria-hidden>
                    <span className="mx-auto mt-0.5 block h-2.5 w-0.5 rounded bg-copper" />
                  </div>
                  <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">{k.label}</p>
                  <p className="font-mono text-[11px] text-ink">{patch.amp[k.key].toFixed(1)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="absolute left-3 top-3 flex gap-1 rounded-full border border-white/10 bg-black/50 p-1 backdrop-blur-md" role="group" aria-label="3D view">
          {(["amp", "cab", "fx"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => (webglAvailable() ? setView(v) : setNo3d(true))} className={`focus-ring rounded-full px-3 py-1 font-body text-xs ${view === v ? "bg-ink text-bg" : "text-ink-dim hover:text-ink"}`}>
              {v === "amp" ? "Amp" : v === "cab" ? "Cab" : "Pedals"}
            </button>
          ))}
        </div>
        {!view && <p className="absolute right-3 top-3.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{no3d ? "3D isn't available on this device" : "Tap a view for 3D"}</p>}
      </div>
      <div className="space-y-3 p-4 sm:p-5">
        <div>
          <p className="label-engraved text-copper">Signature sound</p>
          <h2 id="signature-h" className="mt-1 font-display text-xl font-semibold leading-tight"><Link href={`/t/${tone.id}`} className="hover:text-copper-soft">{tone.name}</Link></h2>
          <p className="mt-0.5 font-mono text-[11px] text-muted">{FROM[from] ?? FROM.default}</p>
        </div>
        <ol aria-label="Signal chain" className="flex flex-wrap items-center gap-1.5 font-body text-xs">
          {[...chain.filter((e) => EFFECT_DESIGNS[e.type].placement === "pre").map((e) => EFFECT_DESIGNS[e.type].name), amp.name, CAB_DESIGNS[patch.cab.model].name, ...chain.filter((e) => EFFECT_DESIGNS[e.type].placement === "post").map((e) => EFFECT_DESIGNS[e.type].name)].map((name, i, all) => (
            <li key={`${name}-${i}`} className="flex items-center gap-1.5">
              <span className={`rounded-full border px-2.5 py-1 ${name === amp.name ? "border-copper/50 bg-copper/10 text-ink" : "border-line text-ink-dim"}`}>{name}</span>
              {i < all.length - 1 && <Icon name="chevron-right" size={12} className="text-muted" aria-hidden />}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/studio?tone=${tone.id}`} icon="amp" size="sm" variant="primary">Play it in the Amp Studio</LinkButton>
          <LinkButton href={`/t/${tone.id}`} icon="tone" size="sm">Inspect tone</LinkButton>
        </div>
      </div>
    </section>
  );
}
