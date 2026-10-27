import { AMP_DESIGNS, CAB_DESIGNS, EFFECT_DESIGNS, type AmpKnob, type StudioPatch } from "@/lib/studio/patch";

/** What the last edit set, for the readout. Covers every edit key; anything unexpected shows nothing rather than crashing. */
export function describeEdit(key: string, p: StudioPatch): string | null {
  const [area, a, b] = key.split(".");
  const show = (label: string, v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? `${label} ${v.toFixed(1)}` : typeof v === "boolean" ? `${label} ${v ? "ON" : "OFF"}` : null;
  if (area === "amp") {
    if (a === "model") return AMP_DESIGNS[p.amp.model]?.name.toUpperCase() ?? null;
    return a in p.amp ? show(a.toUpperCase(), p.amp[a as AmpKnob]) : null;
  }
  if (area === "cab") {
    if (a === "model") return CAB_DESIGNS[p.cab.model]?.name.toUpperCase() ?? null;
    if (a === "on") return show("CABINET", p.cab.on);
    if (a === "micPosition") return show("MIC POSITION", p.cab.micPosition);
    if (a === "micDistance") return show("MIC DISTANCE", p.cab.micDistance);
    return null;
  }
  if (area === "fx") {
    const e = p.effects.find((x) => x.id === a);
    if (!e) return null;
    const name = EFFECT_DESIGNS[e.type].name.toUpperCase();
    if (b === "on") return show(name, e.on);
    if (b === "voice") return e.voice ? `${name} ${e.voice.toUpperCase()}` : null;
    return b ? show(b.toUpperCase(), e.params[b]) : null;
  }
  return null;
}
