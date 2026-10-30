import { describe, expect, it } from "vitest";
import { parseSetlist, parseSetlistPatch, parseSong, MAX_SONGS } from "@/lib/setlists";
import { describeSignature, isMidiSignature, midiSignature, programChange } from "@/lib/midi";
import { sanitizeMidi } from "@/lib/stores/preferences";

describe("setlist validation", () => {
  it("accepts a full song and drops empty optional fields", () => {
    expect(parseSong({ id: "a1", title: " Gold ", artist: "", bpm: 120, key: "F#m", toneId: "cmvojgj1700011372ikd39mcf", minutes: 4.25, midiProgram: 12, notes: "Capo 2" }, 0))
      .toEqual({ id: "a1", title: "Gold", bpm: 120, key: "F#m", toneId: "cmvojgj1700011372ikd39mcf", minutes: 4.3, midiProgram: 12, notes: "Capo 2" });
  });

  it("refuses bad tempos, keys, MIDI programs, ids and oversized sets with readable messages", () => {
    expect(() => parseSong({ id: "a", title: "x", bpm: 999 }, 0)).toThrow(/Song 1 tempo/);
    expect(() => parseSong({ id: "a", title: "x", key: "H" }, 2)).toThrow(/Song 3 key/);
    expect(() => parseSong({ id: "a", title: "x", midiProgram: 0 }, 0)).toThrow(/MIDI program/);
    expect(() => parseSong({ id: "a b", title: "x" }, 0)).toThrow(/id/);
    expect(() => parseSong({ id: "a", title: "  " }, 0)).toThrow(/title is required/);
    expect(() => parseSong({ id: "a", title: "x", toneId: "../../etc" }, 0)).toThrow(/tone/);
    expect(() => parseSetlist({ name: "Gig", items: [{ id: "a", title: "x" }, { id: "a", title: "y" }] })).toThrow(/own id/);
    expect(() => parseSetlist({ name: "Gig", items: Array.from({ length: MAX_SONGS + 1 }, (_, i) => ({ id: `s${i}`, title: "x" })) })).toThrow(/at most/);
    expect(() => parseSetlist({ name: "Gig", date: "31/12/2026" })).toThrow(/YYYY-MM-DD/);
  });

  it("patches only what's sent", () => {
    expect(parseSetlistPatch({ venue: "" })).toEqual({ venue: null });
    expect(() => parseSetlistPatch({})).toThrow(/Nothing/);
  });
});

describe("MIDI", () => {
  it("turns footswitch presses into signatures and ignores releases and clock", () => {
    expect(midiSignature([0xb0, 80, 127])).toBe("cc:1:80");
    expect(midiSignature([0xb0, 80, 0])).toBeNull();
    expect(midiSignature([0xc3, 5])).toBe("pc:4:5");
    expect(midiSignature([0x9f, 60, 100])).toBe("note:16:60");
    expect(midiSignature([0x90, 60, 0])).toBeNull();
    expect(midiSignature([0xf8])).toBeNull();
    expect(describeSignature("cc:1:80")).toBe("CC 80 · ch 1");
  });

  it("builds program changes 1–128 on channels 1–16", () => {
    expect(programChange(1)).toEqual([0xc0, 0]);
    expect(programChange(128, 16)).toEqual([0xcf, 127]);
    expect(programChange(999, 99)).toEqual([0xcf, 127]);
  });

  it("only keeps valid mappings from device storage", () => {
    expect(isMidiSignature("cc:16:127")).toBe(true);
    expect(isMidiSignature("cc:17:1")).toBe(false);
    expect(sanitizeMidi({ next: "<script>", prev: "pc:2:3", output: 5 as never, channel: 40 })).toEqual({ next: null, prev: "pc:2:3", output: null, channel: 16 });
  });
});
