import { beforeEach, describe, expect, it } from "vitest";
import { createTone, getTone, updateTone } from "@/lib/tones";
import { listVersions, MAX_VERSIONS, versionSettings } from "@/lib/tone-versions";
import { parseStoredToneData } from "@/lib/tone-validation";
import { defaultPatch } from "@/lib/studio/patch";
import { validRecipe } from "../fixtures";
import { makeActor, prisma, resetDb } from "./db";

beforeEach(resetDb);

const studio = (gain: number) => ({ version: 2 as const, studio: { ...defaultPatch("basalt"), amp: { ...defaultPatch("basalt").amp, gain } } });

describe("Tone Time Machine", () => {
  it("records creation and every real change, with notes and readable changes, and skips no-op saves", async () => {
    const me = await makeActor();
    const id = await createTone(me, { name: "Lead", data: parseStoredToneData(studio(5)) });
    await updateTone(me, id, { data: parseStoredToneData(studio(7.5)), revisionNote: "More gain for the solo" });
    await updateTone(me, id, { data: parseStoredToneData(studio(7.5)) });
    await updateTone(me, id, { favorite: true });
    await updateTone(me, id, { name: "Solo lead" });
    const v = await listVersions(me.id, id);
    expect(v.map((x) => x.kind)).toEqual(["SAVED", "SAVED", "CREATED"]);
    expect(v[1]).toMatchObject({ note: "More gain for the solo", changes: ["Gain 5.0 → 7.5"] });
    expect(v[0].changes).toEqual(["Renamed “Lead” → “Solo lead”"]);
  });

  it("keeps a baseline of tones that existed before history began", async () => {
    const me = await makeActor();
    const id = await createTone(me, { name: "Old", data: parseStoredToneData(studio(4)) });
    await prisma.toneVersion.deleteMany({ where: { toneId: id } });
    await updateTone(me, id, { data: parseStoredToneData(studio(6)) });
    expect((await listVersions(me.id, id)).map((x) => [x.kind, x.patch.amp.gain])).toEqual([["SAVED", 6], ["BASELINE", 4]]);
  });

  it("restores exactly, as a new version, without losing anything", async () => {
    const me = await makeActor();
    const id = await createTone(me, { name: "Analysed", data: parseStoredToneData({ version: 2, recipe: validRecipe() }) });
    const first = (await listVersions(me.id, id))[0];
    await updateTone(me, id, { data: parseStoredToneData(studio(9)) });
    const settings = await versionSettings(me.id, id, first.id);
    await updateTone(me, id, { data: parseStoredToneData(settings.data), revisionNote: "Restored" }, "RESTORED");
    const tone = (await getTone(id, me.id))!;
    // The studio patch added later is gone again: the old version had none.
    expect(tone.studio).toBeNull();
    expect(tone.inferred).toBeTruthy();
    const kinds = (await listVersions(me.id, id)).map((x) => x.kind);
    expect(kinds).toEqual(["RESTORED", "SAVED", "CREATED"]);
  });

  it("is the owner's alone and stays bounded", async () => {
    const me = await makeActor();
    const other = await makeActor();
    const id = await createTone(me, { name: "Mine", data: parseStoredToneData(studio(1)) });
    await expect(listVersions(other.id, id)).rejects.toMatchObject({ status: 404 });
    for (let g = 0; g < MAX_VERSIONS + 5; g++) await updateTone(me, id, { data: parseStoredToneData(studio((g % 10) + 0.5)) });
    expect(await prisma.toneVersion.count({ where: { toneId: id } })).toBe(MAX_VERSIONS);
  });
});
