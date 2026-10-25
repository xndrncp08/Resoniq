"use client";

import dynamic from "next/dynamic";
import { defaultPatch, newEffect, type AmpModelId, type EffectType, type StudioPatch } from "@/lib/studio/patch";
import { AMP_DESIGNS } from "@/lib/studio/patch";
import { ampFrame } from "@/components/studio/three/Amp";
import { LOOKS, panelLayout } from "@/components/studio/three/looks";
import { CAB_SIZE, speakerSpots } from "@/components/studio/three/Cab";
import { PEDAL } from "@/components/studio/three/Pedalboard";
import { geometry } from "@/components/studio/three/StudioScene";
import type { StudioView } from "@/lib/stores/studio-store";

const StudioScene = dynamic(() => import("@/components/studio/three/StudioScene"), { ssr: false });
type V3 = [number, number, number];
type Shot = { patch: StudioPatch; view: StudioView; pos: V3; look: V3 };

const KNOB_MODEL: Record<string, AmpModelId> = { halcyon: "halcyon", basalt: "basalt", kintsugi: "gilded", lumen: "lumen", prism: "prism" };

/** A point on an amp's faceplate in world space: u across the panel, a little in front of it. */
function onPanel(model: AmpModelId, u: number, ampY: number, dz = 0.06): V3 {
  const f = ampFrame(LOOKS[model]);
  return [(u - 0.5) * f.PW, ampY + f.controlsY, 0.04 + f.FRONT + dz];
}

function shotFor(id: string): Shot {
  const [what, part] = id.split("-");
  const model = KNOB_MODEL[what] ?? "halcyon";
  const patch = { ...defaultPatch(model), amp: { ...defaultPatch(model).amp, gain: 7.5, master: 7 } };
  const g = geometry(patch);
  const f = ampFrame(LOOKS[model]);
  const layout = panelLayout(AMP_DESIGNS[model].knobs, AMP_DESIGNS[model].switches);
  const knobU = layout.find((i) => i.kind === "knob" && i.key === "gain")!.u;
  if (part === "knob") {
    const t = onPanel(model, knobU, g.ampY, 0.05);
    return { patch, view: "amp", look: t, pos: [t[0] + 0.08, t[1] + 0.07, t[2] + 0.5] };
  }
  if (part === "glow") {
    const t: V3 = [0.25, g.ampY + 0.05, 0.04 + f.FRONT];
    return { patch, view: "amp", look: t, pos: [t[0] + 0.35, t[1] + 0.12, t[2] + 1.15] };
  }
  if (part === "tubes") {
    const t: V3 = [0.18, g.ampY + f.GRILLE.y, 0.04 + f.FRONT - 0.08];
    return { patch, view: "amp", look: t, pos: [t[0] + 0.1, t[1] + 0.04, t[2] + 0.62] };
  }
  if (part === "seam") {
    const t: V3 = [-0.35, g.ampY + f.GRILLE.y + 0.02, 0.04 + f.FRONT];
    return { patch, view: "amp", look: t, pos: [t[0] + 0.15, t[1] + 0.05, t[2] + 0.85] };
  }
  if (part === "power") {
    const t = onPanel(model, 0.84, g.ampY, 0.02);
    return { patch, view: "amp", look: t, pos: [t[0] - 0.06, t[1] + 0.03, t[2] + 0.26] };
  }
  if (part === "panel") {
    const t = onPanel(model, 0.9, g.ampY, 0);
    return { patch, view: "amp", look: t, pos: [t[0] - 0.05, t[1] + 0.05, t[2] + 0.42] };
  }
  if (what === "input") {
    const t = onPanel("halcyon", 0.045, g.ampY, 0.04);
    return { patch, view: "amp", look: [t[0], t[1] - 0.03, t[2]], pos: [t[0] + 0.12, t[1] + 0.04, t[2] + 0.36] };
  }
  if (what === "speaker") {
    const [, , cd] = CAB_SIZE[patch.cab.model];
    const spots = speakerSpots(patch.cab.model);
    const [sx, sy] = part === "mic" ? spots[1] : spots[2];
    const t: V3 = [sx, g.cabY + sy, cd / 2 - 0.05];
    return { patch, view: "cab", look: t, pos: part === "mic" ? [t[0] - 0.3, t[1] + 0.12, t[2] + 0.95] : [t[0] + 0.05, t[1] + 0.05, t[2] + 0.95] };
  }
  // Pedals: one effect on the board, seen from above at a slant.
  const type = ({ ember: "overdrive", tidepool: "chorus", orbit: "phaser", echo: "delay" } as Record<string, EffectType>)[part] ?? "overdrive";
  const withFx = { ...patch, effects: [newEffect(type, `lab-${type}`)] };
  const t: V3 = [0, g.boardY + PEDAL.h / 2, g.boardZ];
  return { patch: withFx, view: "fx", look: t, pos: [0.08, t[1] + 0.5, t[2] + 0.42] };
}

/** Renders a single avatar shot full-bleed at 512×512 for capture. */
export default function AvatarLab({ shot }: { shot: string }) {
  const s = shotFor(shot);
  const noop = () => {};
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black">
      <div id="avatar-shot" className="relative h-[512px] w-[512px] bg-[radial-gradient(80%_80%_at_50%_30%,#1f232b,#07080a)]">
        <StudioScene className="!absolute inset-0" patch={s.patch} view={s.view} knobs={AMP_DESIGNS[s.patch.amp.model].knobs} switches={AMP_DESIGNS[s.patch.amp.model].switches} powered onKnob={noop} onSwitch={noop} onPower={noop} onMic={noop} onEffectParam={noop} onEffectToggle={noop} shot={{ pos: s.pos, look: s.look }} />
      </div>
    </div>
  );
}
