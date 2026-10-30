import { describe, expect, it } from "vitest";
import { bestOffset, clockOffset, correction, expectedPosition } from "@/lib/rooms/sync";

describe("listening room sync", () => {
  it("estimates the server clock from a round trip and trusts the fastest samples", () => {
    expect(clockOffset(1000, 1100, 6050)).toBe(5000);
    expect(bestOffset([{ rtt: 900, offset: 300 }, { rtt: 40, offset: 10 }, { rtt: 60, offset: 14 }, { rtt: 50, offset: 12 }])).toBe(12);
    expect(bestOffset([])).toBe(0);
  });

  it("advances the position in real time only while playing, within the take", () => {
    const clock = { playing: true, positionSec: 10, stateAt: 100_000 };
    expect(expectedPosition(clock, 102_000 - 500, 500)).toBeCloseTo(12);
    expect(expectedPosition({ ...clock, playing: false }, 999_999, 0)).toBe(10);
    expect(expectedPosition(clock, 500_000, 0, 60)).toBe(60);
  });

  it("ignores tiny gaps, nudges speed for small drift, and seeks for big jumps", () => {
    expect(correction(10, 10.02)).toEqual({ seekTo: null, rate: 1 });
    const behind = correction(10, 10.2);
    expect(behind.seekTo).toBeNull();
    expect(behind.rate).toBeGreaterThan(1);
    expect(behind.rate).toBeLessThanOrEqual(1.05);
    expect(correction(10.2, 10).rate).toBeLessThan(1);
    expect(correction(10, 14)).toEqual({ seekTo: 14, rate: 1 });
  });
});
