/**
 * Web MIDI helpers for Gig Mode: turning incoming messages into a stable
 * "signature" a footswitch can be learned by, and building program changes.
 */

/** "cc:<channel>:<controller>", "pc:<channel>:<program>" or "note:<channel>:<note>"; null for anything else (releases, clock, sysex). */
export function midiSignature(data: ArrayLike<number>): string | null {
  const [status, a, b] = [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0];
  const kind = status & 0xf0;
  const channel = (status & 0x0f) + 1;
  if (kind === 0xb0 && b > 0) return `cc:${channel}:${a}`; // a pressed switch; value 0 is the release
  if (kind === 0xc0) return `pc:${channel}:${a}`;
  if (kind === 0x90 && b > 0) return `note:${channel}:${a}`;
  return null;
}

export const isMidiSignature = (v: unknown): v is string => typeof v === "string" && /^(cc|pc|note):(1[0-6]|[1-9]):(1[01]\d|12[0-7]|\d{1,2})$/.test(v);

/** Program change for a 1–128 program number on a 1–16 channel. */
export function programChange(program: number, channel = 1): number[] {
  return [0xc0 | (Math.max(1, Math.min(16, channel)) - 1), Math.max(1, Math.min(128, program)) - 1];
}

export const describeSignature = (sig: string) => {
  const [kind, ch, n] = sig.split(":");
  return `${kind === "cc" ? "CC" : kind === "pc" ? "Program" : "Note"} ${n} · ch ${ch}`;
};
