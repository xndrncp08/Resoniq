"use client";

import Link from "next/link";
import Icon from "@/components/icons/Icon";
import { LinkButton } from "@/components/app/ui";
import { AmpFace } from "@/components/studio/hardware";
import { AMP_DESIGNS, CAB_DESIGNS, EFFECT_DESIGNS, type StudioPatch } from "@/lib/studio/patch";

// Honest about where the settings come from: only a studio patch is the member's own dialled sound.
const FROM: Record<string, string> = {
  studio: "Dialled in the Amp Studio",
  device: "A TANK-G preset",
  analysis: "Starting point from an analysis",
  rig: "From the rig they described",
  default: "Studio defaults",
};

/**
 * A member's signature tone, drawn as its amp panel (the same hardware as the
 * Amp Studio, read-only) with the signal chain beneath. Plain HTML and SVG,
 * so profiles stay light on phones.
 */
export default function SignatureRig({ tone, patch, from }: { tone: { id: string; name: string }; patch: StudioPatch; from: string }) {
  const amp = AMP_DESIGNS[patch.amp.model];
  const chain = patch.effects.filter((e) => e.on);
  const names = [...chain.filter((e) => e.placement === "pre").map((e) => EFFECT_DESIGNS[e.type].name), amp.name, CAB_DESIGNS[patch.cab.model].name, ...chain.filter((e) => e.placement !== "pre").map((e) => EFFECT_DESIGNS[e.type].name)];

  return (
    <section aria-labelledby="signature-h" className="panel overflow-hidden">
      <div className="bg-[radial-gradient(120%_90%_at_50%_10%,#1d2129_0%,#0b0d11_55%,#05070a_100%)] px-3 pb-4 pt-2">
        <AmpFace model={patch.amp.model} amp={patch.amp} knobs={amp.knobs} switches={amp.switches} powered readOnly compact />
      </div>
      <div className="space-y-3 p-4 sm:p-5">
        <div>
          <p className="label-engraved text-copper">Signature sound</p>
          <h2 id="signature-h" className="mt-1 font-display text-xl font-semibold leading-tight"><Link href={`/t/${tone.id}`} className="hover:text-copper-soft">{tone.name}</Link></h2>
          <p className="mt-0.5 font-mono text-[11px] text-muted">{FROM[from] ?? FROM.default}</p>
        </div>
        <ol aria-label="Signal chain" className="flex flex-wrap items-center gap-1.5 font-body text-xs">
          {names.map((name, i, all) => (
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
