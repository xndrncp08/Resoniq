/**
 * Keeping several browsers on the same beat without a socket: the server
 * stores where playback was at a server time; each client estimates how far
 * its clock is from the server's, works out where playback should be now,
 * and corrects gently (a small speed change) or, for big gaps, by seeking.
 */

export type RoomClock = { playing: boolean; positionSec: number; stateAt: number };

/** Server clock minus client clock, from one request: the server's time is taken as of the request's midpoint. */
export const clockOffset = (sentAt: number, receivedAt: number, serverNow: number) => serverNow - (sentAt + receivedAt) / 2;

/** Keeps the offset from the fastest round trips (the least distorted by network delay). */
export function bestOffset(samples: { rtt: number; offset: number }[]): number {
  if (!samples.length) return 0;
  const sorted = [...samples].sort((a, b) => a.rtt - b.rtt).slice(0, 3);
  return sorted.reduce((s, x) => s + x.offset, 0) / sorted.length;
}

/** Where playback should be, in seconds, at client time `clientNow`. */
export function expectedPosition(c: RoomClock, clientNow: number, offset: number, duration = Infinity): number {
  const at = c.playing ? c.positionSec + (clientNow + offset - c.stateAt) / 1000 : c.positionSec;
  return Math.max(0, Math.min(duration, at));
}

export const SEEK_THRESHOLD = 0.35;
export const DEAD_ZONE = 0.04;

/**
 * What to do about the gap between where this player is and where it should
 * be: nothing; nudge the speed up to ±5% so it catches up inaudibly over a
 * few seconds; or jump.
 */
export function correction(localSec: number, expectedSec: number): { seekTo: number | null; rate: number } {
  const drift = expectedSec - localSec;
  if (Math.abs(drift) > SEEK_THRESHOLD) return { seekTo: expectedSec, rate: 1 };
  if (Math.abs(drift) < DEAD_ZONE) return { seekTo: null, rate: 1 };
  return { seekTo: null, rate: 1 + Math.max(-0.05, Math.min(0.05, drift * 0.25)) };
}
