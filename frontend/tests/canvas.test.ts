import { describe, expect, it } from "vitest";
import { parseChordLine, transposeChord, transposeKey, transposeText } from "@/lib/canvas/chords";
import { mergeCanvas, type CanvasContent, type CanvasSection } from "@/lib/canvas/merge";

describe("chords", () => {
  it("splits inline chords over their words", () => {
    expect(parseChordLine("[Am]Hold the [F]line")).toEqual([{ chord: "Am", text: "Hold the " }, { chord: "F", text: "line" }]);
    expect(parseChordLine("No chords here")).toEqual([{ chord: null, text: "No chords here" }]);
    expect(parseChordLine("Intro [G] [D]")).toEqual([{ chord: null, text: "Intro " }, { chord: "G", text: " " }, { chord: "D", text: "" }]);
    expect(parseChordLine("")).toEqual([]);
  });

  it("transposes keeping sharps or flats, slash chords and extensions", () => {
    expect(transposeChord("F#m7/C#", 2)).toBe("G#m7/D#");
    expect(transposeChord("Bb", 2)).toBe("C");
    expect(transposeChord("Eb", 1)).toBe("E");
    expect(transposeChord("Ab/Eb", -1)).toBe("G/D");
    expect(transposeChord("B", 1)).toBe("C");
    expect(transposeChord("C", -1)).toBe("B");
    expect(transposeChord("N.C.", 3)).toBe("N.C.");
    expect(transposeText("[Am]Hold [F]on", 3)).toBe("[Cm]Hold [G#]on");
    expect(transposeKey("Am", 3)).toBe("Cm");
  });
});

const sec = (id: string, lyrics: string, name = id): CanvasSection => ({ id, kind: "verse", name, lyrics });
const content = (sections: CanvasSection[], extra: Partial<CanvasContent> = {}): CanvasContent => ({ title: "Song", key: null, bpm: null, sections, arrangement: sections.map((s) => s.id), ...extra });
let n = 0;
const newId = () => `copy${n++}`;

describe("canvas merge", () => {
  const base = content([sec("v1", "one"), sec("c1", "chorus")]);

  it("keeps both people's edits to different sections", () => {
    const local = content([sec("v1", "one, rewritten"), sec("c1", "chorus")]);
    const remote = content([sec("v1", "one"), sec("c1", "chorus, louder")], { bpm: 120 });
    const { merged, conflicts } = mergeCanvas(base, local, remote, newId);
    expect(merged.sections.map((s) => s.lyrics)).toEqual(["one, rewritten", "chorus, louder"]);
    expect(merged.bpm).toBe(120);
    expect(conflicts).toEqual([]);
  });

  it("never loses words when both changed the same section", () => {
    const local = content([sec("v1", "mine"), sec("c1", "chorus")]);
    const remote = content([sec("v1", "theirs"), sec("c1", "chorus")]);
    const { merged, conflicts } = mergeCanvas(base, local, remote, () => "mine-copy");
    expect(merged.sections.map((s) => [s.id, s.lyrics])).toEqual([["v1", "theirs"], ["mine-copy", "mine"], ["c1", "chorus"]]);
    expect(merged.arrangement).toEqual(["v1", "mine-copy", "c1"]);
    expect(merged.sections[1].name).toBe("v1 (your edit)");
    expect(conflicts).toHaveLength(1);
  });

  it("handles additions and deletions on either side", () => {
    const local = content([sec("v1", "one"), sec("c1", "chorus"), sec("b1", "bridge")]);
    const remote = content([sec("c1", "chorus")]);
    const { merged } = mergeCanvas(base, local, remote, newId);
    expect(merged.sections.map((s) => s.id)).toEqual(["c1", "b1"]);
    // Deleted here but edited there: the edit wins.
    const edited = mergeCanvas(base, content([sec("c1", "chorus")]), content([sec("v1", "one, edited"), sec("c1", "chorus")]), newId);
    expect(edited.merged.sections.map((s) => s.id)).toEqual(["v1", "c1"]);
    expect(edited.conflicts[0]).toMatch(/wasn't deleted/);
  });

  it("merges arrangements and drops references to removed sections", () => {
    const local = { ...base, arrangement: ["v1", "c1", "c1"] };
    const remote = { ...base, arrangement: ["c1", "v1"] };
    expect(mergeCanvas(base, local, remote, newId).merged.arrangement).toEqual(["c1", "v1"]);
    expect(mergeCanvas(base, local, base, newId).merged.arrangement).toEqual(["v1", "c1", "c1"]);
    const gone = content([sec("v1", "one")], { arrangement: ["v1", "c1"] });
    expect(mergeCanvas(base, base, gone, newId).merged.arrangement).toEqual(["v1"]);
  });
});
