import { beforeEach, describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { popularGear, searchGear, submitGear } from "@/lib/gear";
import { createPost, getPost } from "@/lib/posts";
import { parseRecipeCore } from "@/lib/tone-validation";
import { createTone, getTone, listTones, remixTone, savedTones, setToneSaved, updateTone } from "@/lib/tones";
import { seedGear } from "@/prisma/seed-gear";
import { validRecipe } from "../fixtures";
import { makeActor, prisma, resetDb } from "./db";

const data = () => ({ version: 2 as const, recipe: parseRecipeCore(validRecipe()) });
const q = { sort: "new" as const, cursor: null, limit: 20 };

beforeEach(resetDb);

describe("tone visibility", () => {
  it("keeps tones created the old way unlisted, viewable by link but not listed", async () => {
    const owner = await makeActor();
    const other = await makeActor();
    // A row written exactly as before this phase: no visibility given.
    const legacy = await prisma.tone.create({ data: { userId: owner.id, name: "old", data: data() as unknown as Prisma.InputJsonValue } });
    expect(legacy.visibility).toBe("UNLISTED");
    expect(await getTone(legacy.id, other.id)).not.toBeNull();
    expect((await listTones(other.id, q)).items).toHaveLength(0);
    await updateTone(owner, legacy.id, { visibility: "PUBLIC" });
    const listed = (await listTones(other.id, q)).items;
    expect(listed.map((t) => t.id)).toEqual([legacy.id]);
    expect(listed[0].publishedAt).not.toBeNull();
  });

  it("hides private tones and banned owners' tones from everyone else", async () => {
    const owner = await makeActor();
    const other = await makeActor();
    const id = await createTone(owner, { name: "secret", data: data(), visibility: "PRIVATE" });
    expect(await getTone(id, other.id)).toBeNull();
    expect(await getTone(id, null)).toBeNull();
    expect((await getTone(id, owner.id))?.viewer.isOwner).toBe(true);
    await expect(setToneSaved(other, id, true)).rejects.toThrow("Tone not found.");
    await expect(remixTone(other, id)).rejects.toThrow("Tone not found.");

    const pub = await createTone(owner, { name: "public", data: data(), visibility: "PUBLIC" });
    await prisma.user.update({ where: { id: owner.id }, data: { status: "BANNED" } });
    expect(await getTone(pub, other.id)).toBeNull();
  });

  it("shows a tone on a post only while it isn't private, and attaching unlists a private tone", async () => {
    const owner = await makeActor();
    const viewer = await makeActor();
    const id = await createTone(owner, { name: "on post", rig: { chain: [{ id: "b1", category: "fuzz", enabled: true, placement: "pre", params: {} }] }, visibility: "PRIVATE" });
    const post = await createPost(owner, { title: null, body: "listen", category: "PERFORMANCE", communitySlug: null, toneId: null }, {
      attach: async (tx, postId) => {
        await tx.tone.update({ where: { id }, data: { visibility: "UNLISTED" } });
        await tx.post.update({ where: { id: postId }, data: { toneId: id } });
      },
    });
    expect((await getPost(post.id, viewer.id))?.tone).toMatchObject({ id, declared: { blocks: 1 }, inferred: null });
    await updateTone(owner, id, { visibility: "PRIVATE" });
    expect((await getPost(post.id, viewer.id))?.tone).toBeNull();
  });
});

describe("save, remix and credit", () => {
  it("credits the original through remixes and counts saves exactly", async () => {
    const a = await makeActor();
    const b = await makeActor();
    const c = await makeActor();
    const original = await createTone(a, { name: "Original", data: data(), visibility: "PUBLIC" });
    await Promise.all([setToneSaved(b, original, true), setToneSaved(b, original, true), setToneSaved(c, original, true)]);
    expect((await prisma.tone.findUniqueOrThrow({ where: { id: original } })).saveCount).toBe(2);
    expect((await savedTones(b.id, null, 20)).items.map((t) => t.id)).toEqual([original]);

    const remix = await remixTone(b, original);
    const view = (await getTone(remix, c.id))!;
    expect(view.name).toBe("Original (remix)");
    expect(view.visibility).toBe("UNLISTED");
    expect(view.remixOf).toMatchObject({ id: original, author: { id: a.id } });
    expect(view.inferred).toEqual(data().recipe);
    expect((await prisma.tone.findUniqueOrThrow({ where: { id: original } })).remixCount).toBe(1);
    expect(await prisma.notification.count({ where: { userId: a.id, type: { in: ["TONE_SAVE", "TONE_REMIX"] } } })).toBe(3);

    // The credit disappears (without breaking) if the original goes private.
    await updateTone(a, original, { visibility: "PRIVATE" });
    expect((await getTone(remix, c.id))!.remixOf).toBeNull();
  });

  it("labels retuned analysis recipes", async () => {
    const a = await makeActor();
    const id = await createTone(a, { name: "t", data: data() });
    expect((await getTone(id, a.id))!.recipeEdited).toBe(false);
    const changed = data();
    changed.recipe.amp.gain = 10;
    expect((await updateTone(a, id, { data: changed })).recipeEdited).toBe(true);
  });
});

describe("gear catalog", () => {
  it("indexes rig gear, ranks popular gear by public tones, and keeps pending gear private to its submitter", async () => {
    await seedGear(prisma);
    const a = await makeActor();
    const b = await makeActor();
    const [ts9] = await searchGear("tube screamer ts9", "PEDAL", 5, null);
    expect(ts9.model).toBe("TS9 Tube Screamer");
    const rig = { chain: [{ id: "b1", category: "drive" as const, enabled: true, placement: "pre" as const, params: { Drive: 3 }, ref: { gearId: ts9.id, model: ts9.model } }] };
    await createTone(a, { name: "pub", rig, visibility: "PUBLIC" });
    await createTone(a, { name: "unlisted", rig, visibility: "UNLISTED" });
    expect(await popularGear("PEDAL", 5)).toMatchObject([{ id: ts9.id, uses: 1 }]);
    expect((await listTones(null, { ...q, gearId: ts9.id })).items).toHaveLength(1);

    await expect(createTone(a, { name: "bad", rig: { chain: [{ ...rig.chain[0], ref: { gearId: "nope", model: "x" } }] } })).rejects.toThrow("isn't in the catalog");
    const pending = await submitGear(b, { kind: "PEDAL", brand: "Garage", model: "Fuzz One", controls: [] });
    expect((await searchGear("garage", null, 5, a.id))).toHaveLength(0);
    expect((await searchGear("garage", null, 5, b.id))).toHaveLength(1);
    await expect(createTone(a, { name: "x", rig: { chain: [{ ...rig.chain[0], ref: { gearId: pending.id, model: "Fuzz One" } }] } })).rejects.toThrow();
    await expect(createTone(b, { name: "x", rig: { chain: [{ ...rig.chain[0], ref: { gearId: pending.id, model: "Fuzz One" } }] } })).resolves.toBeTruthy();
  });
});
