import { beforeEach, describe, expect, it } from "vitest";
import { createTone } from "@/lib/tones";
import { similarTones } from "@/lib/similar-tones";
import { dnaFromPatch } from "@/lib/tone-dna";
import { FACTORY_PRESETS } from "@/lib/studio/patch";
import { makeActor, prisma, resetDb } from "./db";

beforeEach(resetDb);

const preset = (id: string) => FACTORY_PRESETS.find((f) => f.id === id)!.patch;

describe("similar tones", () => {
  it("ranks public tones by DNA and never shows private, unlisted or banned owners' tones", async () => {
    const me = await makeActor();
    const other = await makeActor();
    const banned = await makeActor();
    const heavy = await createTone(other, { name: "Heavy", data: { version: 2, studio: preset("foundry-djent") }, visibility: "PUBLIC" });
    const clean = await createTone(other, { name: "Clean", data: { version: 2, studio: preset("lumen-glass") }, visibility: "PUBLIC" });
    await createTone(other, { name: "Hidden", data: { version: 2, studio: preset("basalt-rhythm") }, visibility: "PRIVATE" });
    await createTone(other, { name: "Link only", data: { version: 2, studio: preset("basalt-rhythm") }, visibility: "UNLISTED" });
    await createTone(banned, { name: "Banned", data: { version: 2, studio: preset("basalt-rhythm") }, visibility: "PUBLIC" });
    await prisma.user.update({ where: { id: banned.id }, data: { status: "BANNED" } });
    const mine = await createTone(me, { name: "Mine", data: { version: 2, studio: preset("basalt-rhythm") }, visibility: "PUBLIC" });

    const result = await similarTones(dnaFromPatch(preset("basalt-rhythm")), { exclude: mine });
    expect(result.map((t) => t.id)).toEqual([heavy, clean]);
    expect(result[0].match).toBeGreaterThan(result[1].match);
  });
});
