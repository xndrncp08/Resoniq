import { AMP_DESIGNS, CAB_DESIGNS, EFFECT_DESIGNS, MIC_DESIGNS, SPEAKER_DESIGNS, type StudioPatch } from "@/lib/studio/patch";

/**
 * What changed between two versions of a sound, in the words a player would
 * use ("Gain 5.0 → 7.5", "+ Moth Fuzz"). Works on studio patches, which every
 * tone opens as, so studio, device and rig tones all compare the same way.
 */
const n1 = (v: number) => v.toFixed(1);
const db = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)} dB`;

export function diffPatches(a: StudioPatch, b: StudioPatch): string[] {
  const out: string[] = [];
  if (a.amp.model !== b.amp.model) out.push(`Amp: ${AMP_DESIGNS[a.amp.model].name} → ${AMP_DESIGNS[b.amp.model].name}`);
  if (a.device?.ampSlot !== b.device?.ampSlot && a.device && b.device) out.push(`Amp slot ${a.device.ampSlot} → ${b.device.ampSlot}`);
  for (const k of AMP_DESIGNS[b.amp.model].knobs) if (a.amp[k.key] !== b.amp[k.key]) out.push(`${k.label} ${n1(a.amp[k.key])} → ${n1(b.amp[k.key])}`);
  for (const s of AMP_DESIGNS[b.amp.model].switches) if (a.amp[s.key] !== b.amp[s.key]) out.push(`${s.label} ${b.amp[s.key] ? "on" : "off"}`);
  if (a.input !== b.input) out.push(`Input ${db(a.input)} → ${db(b.input)}`);
  if (a.output !== b.output) out.push(`Output ${db(a.output)} → ${db(b.output)}`);
  if (a.gate.on !== b.gate.on) out.push(`Input gate ${b.gate.on ? "on" : "off"}`);
  else if (b.gate.on && a.gate.threshold !== b.gate.threshold) out.push(`Gate threshold ${a.gate.threshold} → ${b.gate.threshold} dB`);

  if (a.cab.model !== b.cab.model) out.push(`Cabinet: ${CAB_DESIGNS[a.cab.model].name} → ${CAB_DESIGNS[b.cab.model].name}`);
  if (a.cab.on !== b.cab.on) out.push(`Cabinet ${b.cab.on ? "on" : "bypassed"}`);
  if (a.cab.speaker !== b.cab.speaker) out.push(`Speaker: ${SPEAKER_DESIGNS[a.cab.speaker].name} → ${SPEAKER_DESIGNS[b.cab.speaker].name}`);
  if (a.cab.mic !== b.cab.mic) out.push(`Mic: ${MIC_DESIGNS[a.cab.mic].name} → ${MIC_DESIGNS[b.cab.mic].name}`);
  if (a.cab.micPosition !== b.cab.micPosition) out.push(`Mic position ${n1(a.cab.micPosition)} → ${n1(b.cab.micPosition)}`);
  if (a.cab.micDistance !== b.cab.micDistance) out.push(`Mic distance ${n1(a.cab.micDistance)} → ${n1(b.cab.micDistance)}`);

  // Pedals are matched by id first, then (for older saves whose ids changed) by type.
  const unmatched = [...a.effects];
  const take = (pred: (x: (typeof a.effects)[number]) => boolean) => {
    const i = unmatched.findIndex(pred);
    return i === -1 ? null : unmatched.splice(i, 1)[0];
  };
  const pairs = b.effects.map((e) => ({ after: e, before: take((x) => x.id === e.id) }));
  for (const p of pairs) if (!p.before) p.before = take((x) => x.type === p.after.type);
  for (const { before, after } of pairs) {
    const d = EFFECT_DESIGNS[after.type];
    if (!before) { out.push(`+ ${d.name}`); continue; }
    if (before.on !== after.on) out.push(`${d.name} ${after.on ? "on" : "bypassed"}`);
    if (before.placement !== after.placement) out.push(`${d.name} moved ${after.placement === "pre" ? "before the amp" : "after the cabinet"}`);
    if (before.voice !== after.voice && after.voice) out.push(`${d.name}: ${before.voice ?? "—"} → ${after.voice}`);
    for (const p of d.params) if (before.params[p.key] !== after.params[p.key]) out.push(`${d.name} ${p.label} ${n1(before.params[p.key])} → ${n1(after.params[p.key])}`);
  }
  for (const gone of unmatched) out.push(`− ${EFFECT_DESIGNS[gone.type].name}`);
  const order = (p: StudioPatch, keep: Set<string>) => p.effects.map((e) => e.type).filter((t) => keep.has(t)).join();
  const common = new Set(pairs.filter((p) => p.before).map((p) => p.after.type));
  if (!out.some((c) => c.includes(" moved ")) && order(a, common) !== order(b, common)) out.push("Pedal order changed");
  return out;
}
