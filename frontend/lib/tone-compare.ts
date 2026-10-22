import type { RigBlock } from "@/types/rig";
import type { ToneView } from "@/lib/tones";

export type KnobRow = { control: string; a: number | null; b: number | null; delta: number | null };
export type ChainRow = { position: number; a: RigBlock | null; b: RigBlock | null; same: boolean };
export type ToneDiff = {
  inferredAmp: KnobRow[];
  declaredAmp: KnobRow[];
  chain: ChainRow[];
  instrument: { a: string | null; b: string | null };
};

function knobRows(a: Record<string, number> | undefined, b: Record<string, number> | undefined): KnobRow[] {
  const keys = [...new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])];
  return keys.map((control) => {
    const va = a?.[control] ?? null;
    const vb = b?.[control] ?? null;
    return { control, a: va, b: vb, delta: va !== null && vb !== null ? Math.round((vb - va) * 100) / 100 : null };
  });
}

const blockName = (b: RigBlock | null) => (b ? `${b.category}:${b.ref?.gearId ?? b.ref?.model ?? ""}` : "");

/** Side-by-side differences between two tones. Inferred and declared values are compared only with their own kind. */
export function diffTones(a: ToneView, b: ToneView): ToneDiff {
  const amp = (t: ToneView) => {
    if (!t.inferred) return undefined;
    const { gain, bass, mids, treble, presence } = t.inferred.amp;
    return { Gain: gain, Bass: bass, Mids: mids, Treble: treble, Presence: presence };
  };
  const ca = a.declared?.chain ?? [];
  const cb = b.declared?.chain ?? [];
  const instrument = (t: ToneView) => {
    const i = t.declared?.instrument;
    return i ? [i.ref?.brand, i.ref?.model].filter(Boolean).join(" ") || i.kind.toLowerCase() : null;
  };
  return {
    inferredAmp: knobRows(amp(a), amp(b)),
    declaredAmp: knobRows(a.declared?.amp?.settings, b.declared?.amp?.settings),
    chain: Array.from({ length: Math.max(ca.length, cb.length) }, (_, i) => ({
      position: i + 1,
      a: ca[i] ?? null,
      b: cb[i] ?? null,
      same: blockName(ca[i] ?? null) === blockName(cb[i] ?? null),
    })),
    instrument: { a: instrument(a), b: instrument(b) },
  };
}
