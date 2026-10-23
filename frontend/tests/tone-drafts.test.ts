import { describe, expect, it } from "vitest";
import { TONE_PRESETS } from "@/lib/tone-presets";
import { parseDraftInput } from "@/lib/tone-draft-validation";
import { INITIAL_PRESET_KEYS } from "@/lib/tone-drafts";
import { MANAGED_CREATORS, creatorHandleFor } from "@/lib/managed-creators";
import { normalizeHandle, handleFromName } from "@/lib/handles";
import { parseImportArgs } from "@/scripts/publish-initial-tones";
import { INITIAL_IMPORT_CONFIRMATION } from "@/lib/tone-drafts";

const body = () => ({ name: "Clean", description: "Suggested starting settings", creatorId: "c1", rig: { instrument: { kind: "GUITAR" }, amp: { ref: { model: "Test" }, settings: { Gain: 3 } }, chain: [], references: { genres: ["blues"] } } });

describe("prepared preset manifest", () => {
  it("retains all 28 actual presets while selecting exactly 26 for the first import", () => {
    expect(TONE_PRESETS).toHaveLength(28);
    expect(new Set(TONE_PRESETS.map(p => p.key)).size).toBe(28);
    expect(INITIAL_PRESET_KEYS).toHaveLength(26);
    expect(TONE_PRESETS.filter(p => !INITIAL_PRESET_KEYS.includes(p.key)).map(p => p.key)).toEqual(["acoustic-inspired-electric", "acoustic-inspired-fingerpicked"]);
    for (const preset of TONE_PRESETS) expect(MANAGED_CREATORS.some(c => c.handle === creatorHandleFor(preset.key, preset.instrument, preset.genres))).toBe(true);
  });
  it("reserves the managed handle namespace from signup and profile edits", () => {
    for (const c of MANAGED_CREATORS) expect(() => normalizeHandle(c.handle)).toThrow("reserved");
    expect(handleFromName("Resoniq Clara")).toBeNull();
  });
});

describe("draft validation", () => {
  it("keeps the import CLI read-only by default and requires explicit approval for writes", () => {
    expect(parseImportArgs([]).action).toBe("status");
    expect(() => parseImportArgs(["--action", "publish"])).toThrow("Writes require");
    expect(() => parseImportArgs(["--action", "reset"])).toThrow("Use --action");
    expect(parseImportArgs(["--action", "prepare", "--admin-id", "a1", "--confirm", INITIAL_IMPORT_CONFIRMATION]).action).toBe("prepare");
  });
  it("catches renamed identical rigs and ignores JSON object key ordering", () => {
    const a = body();
    const b = { ...a, name: "Different name", description: "Different copy", rig: { references: a.rig.references, chain: [], amp: a.rig.amp, instrument: a.rig.instrument } };
    expect(parseDraftInput(a).fingerprint).toBe(parseDraftInput(b).fingerprint);
  });
  it("rejects incomplete presets and invalid genre or creator selection", () => {
    expect(() => parseDraftInput({ ...body(), creatorId: null })).toThrow("managed creator");
    expect(() => parseDraftInput({ ...body(), rig: { chain: [] } })).toThrow("instrument");
    expect(() => parseDraftInput({ ...body(), rig: { ...body().rig, references: { genres: ["not-real"] } } })).toThrow("genres");
  });
});
