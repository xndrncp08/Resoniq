import { beforeEach, describe, expect, it } from "vitest";
import { createTone, updateTone } from "@/lib/tones";
import { similarTones } from "@/lib/similar-tones";
import { DNA_VERSION, dnaFromPatch } from "@/lib/tone-dna";
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

describe("stored Tone DNA", () => {
  it("is written on create and on every settings change", async () => {
    const me = await makeActor();
    const id = await createTone(me, { name: "Stored", data: { version: 2, studio: preset("lumen-glass") }, visibility: "PUBLIC" });
    const read = () => prisma.tone.findUniqueOrThrow({ where: { id }, select: { dnaVersion: true, dnaDrive: true } });
    expect(await read()).toMatchObject({ dnaVersion: DNA_VERSION, dnaDrive: dnaFromPatch(preset("lumen-glass")).drive });
    await updateTone(me, id, { data: { version: 2, studio: preset("foundry-djent") } });
    expect((await read()).dnaDrive).toBe(dnaFromPatch(preset("foundry-djent")).drive);
  });

  it("heals fingerprints that are missing or from an older formula", async () => {
    const me = await makeActor();
    const id = await createTone(me, { name: "Old row", data: { version: 2, studio: preset("basalt-rhythm") }, visibility: "PUBLIC" });
    await prisma.tone.update({ where: { id }, data: { dnaVersion: null, dnaDrive: null } });
    const result = await similarTones(dnaFromPatch(preset("basalt-rhythm")));
    expect(result.map((t) => [t.id, t.match])).toEqual([[id, 100]]);
  });

  it("answers from thousands of public tones quickly, nearest first", async () => {
    const me = await makeActor();
    const rand = (i: number, k: number) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;
    const rows = Array.from({ length: 5000 }, (_, i) => ({
      userId: me.id, name: `T${i}`, visibility: "PUBLIC" as const, dnaVersion: DNA_VERSION,
      dnaDrive: rand(i, 1), dnaLow: rand(i, 2), dnaMid: rand(i, 3), dnaBright: rand(i, 4), dnaSpace: rand(i, 5), dnaMotion: rand(i, 6), dnaSqueeze: rand(i, 7),
    }));
    await prisma.tone.createMany({ data: rows });
    const target = dnaFromPatch(preset("halcyon-crunch"));
    const started = performance.now();
    const result = await similarTones(target, { limit: 8 });
    const ms = performance.now() - started;
    expect(result).toHaveLength(8);
    for (let i = 1; i < result.length; i++) expect(result[i - 1].match).toBeGreaterThanOrEqual(result[i].match);
    // Brute force in JS agrees with the database's answer.
    const best = rows.map((r) => ({ name: r.name, d: (r.dnaDrive - target.drive) ** 2 + (r.dnaLow - target.low) ** 2 + (r.dnaMid - target.mid) ** 2 + (r.dnaBright - target.bright) ** 2 + (r.dnaSpace - target.space) ** 2 + (r.dnaMotion - target.motion) ** 2 + (r.dnaSqueeze - target.squeeze) ** 2 })).sort((a, b) => a.d - b.d)[0];
    expect(result[0].name).toBe(best.name);
    expect(ms).toBeLessThan(500);
  });
});
