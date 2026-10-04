import { describe, expect, it } from "vitest";
import { gainsFromAmp, knobToDb, logFrequencies, MAX_DB, responseDb, xForHz } from "@/lib/eq";

const flat = { bass: 0, mids: 0, treble: 0, presence: 0 };

describe("EQ model", () => {
  it("maps knob noon to flat and the ends to ±MAX_DB", () => {
    expect(knobToDb(50)).toBe(0);
    expect(knobToDb(0)).toBe(-MAX_DB);
    expect(knobToDb(100)).toBe(MAX_DB);
    expect(knobToDb(150)).toBe(MAX_DB);
    expect(gainsFromAmp({ bass: 50, mids: 75, treble: 25, presence: 50 })).toEqual({ bass: 0, mids: 6, treble: -6, presence: 0 });
  });

  it("is flat when every band is at 0 dB", () => {
    for (const db of responseDb(flat, logFrequencies(64))) expect(Math.abs(db)).toBeLessThan(1e-9);
  });

  it("shelves reach their gain at the far end and leave the other end alone", () => {
    const [low, high] = responseDb({ ...flat, bass: 12 }, [20, 15000]);
    expect(low).toBeCloseTo(12, 0);
    expect(Math.abs(high)).toBeLessThan(0.2);
    const [lowT, highT] = responseDb({ ...flat, treble: -12 }, [20, 18000]);
    expect(Math.abs(lowT)).toBeLessThan(0.2);
    expect(highT).toBeCloseTo(-12, 0);
  });

  it("peaking bands hit their gain at the center frequency", () => {
    const [mid] = responseDb({ ...flat, mids: 9 }, [750]);
    expect(mid).toBeCloseTo(9, 5);
  });

  it("places frequencies on a log axis", () => {
    expect(xForHz(20)).toBe(0);
    expect(xForHz(20000)).toBeCloseTo(1, 10);
    expect(xForHz(632.46)).toBeCloseTo(0.5, 3);
  });
});

describe("EQ model vs Web Audio", () => {
  it("matches Chrome's BiquadFilterNode.getFrequencyResponse for the same settings", () => {
    // Captured in Chrome from an OfflineAudioContext at 48 kHz with the four
    // BANDS filters set to bass +9, mids -6, treble +4.5, presence -12 dB.
    const freqs = [20, 60, 120, 300, 750, 1500, 3000, 4500, 8000, 15000];
    const chrome = [8.984, 8.324, 4.232, -1.403, -6.329, -3.649, -4.602, -8.486, 0.446, 3.932];
    const ours = responseDb({ bass: 9, mids: -6, treble: 4.5, presence: -12 }, freqs, 48000);
    ours.forEach((db, i) => expect(Math.abs(db - chrome[i])).toBeLessThan(0.05));
  });
});
