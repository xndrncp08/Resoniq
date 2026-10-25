import { beforeEach, describe, expect, it } from "vitest";
import { addTake, createPassage, deletePassage, deleteTake, listPassages, MAX_PASSAGES, updatePassage } from "@/lib/practice-ladder";
import { deleteAccount } from "@/lib/account";
import { makeUser, prisma, resetDb } from "./db";

beforeEach(resetDb);

describe("tempo ladder", () => {
  it("records takes oldest first and moves the passage to the top", async () => {
    const me = await makeUser();
    const a = await createPassage(me.id, { title: "Intro", targetBpm: 140 });
    const b = await createPassage(me.id, { title: "Solo", targetBpm: 160 });
    await addTake(me.id, a.id, { bpm: 98, clean: true });
    await addTake(me.id, a.id, { bpm: 102, clean: false });
    const list = await listPassages(me.id);
    expect(list.map((p) => p.id)).toEqual([a.id, b.id]);
    expect(list[0].takes.map((t) => [t.bpm, t.clean])).toEqual([[98, true], [102, false]]);
  });

  it("keeps every passage and take private to its owner", async () => {
    const me = await makeUser();
    const other = await makeUser();
    const mine = await createPassage(me.id, { title: "Intro", targetBpm: 140 });
    const t = await addTake(me.id, mine.id, { bpm: 100, clean: true });

    expect(await listPassages(other.id)).toEqual([]);
    await expect(addTake(other.id, mine.id, { bpm: 200, clean: true })).rejects.toMatchObject({ status: 404 });
    await expect(updatePassage(other.id, mine.id, { targetBpm: 60 })).rejects.toMatchObject({ status: 404 });
    await expect(deleteTake(other.id, t.id)).rejects.toMatchObject({ status: 404 });
    await expect(deletePassage(other.id, mine.id)).rejects.toMatchObject({ status: 404 });

    const [after] = await listPassages(me.id);
    expect(after).toMatchObject({ targetBpm: 140 });
    expect(after.takes).toHaveLength(1);
  });

  it("caps passages per musician and enforces tempo ranges in the database", async () => {
    const me = await makeUser();
    await prisma.practicePassage.createMany({ data: Array.from({ length: MAX_PASSAGES }, (_, i) => ({ userId: me.id, title: `P${i}`, targetBpm: 100 })) });
    await expect(createPassage(me.id, { title: "One more", targetBpm: 100 })).rejects.toThrow(/up to/);
    await expect(prisma.practicePassage.create({ data: { userId: me.id, title: "Too fast", targetBpm: 999 } })).rejects.toThrow();
  });

  it("removes a passage's takes with it, and everything with the account", async () => {
    const me = await makeUser();
    const p = await createPassage(me.id, { title: "Intro", targetBpm: 140 });
    await addTake(me.id, p.id, { bpm: 100, clean: true });
    await deletePassage(me.id, p.id);
    expect(await prisma.practiceTake.count()).toBe(0);

    const q = await createPassage(me.id, { title: "Outro", targetBpm: 120 });
    await addTake(me.id, q.id, { bpm: 90, clean: false });
    await deleteAccount(me.id);
    expect(await prisma.practicePassage.count()).toBe(0);
    expect(await prisma.practiceTake.count()).toBe(0);
  });
});
