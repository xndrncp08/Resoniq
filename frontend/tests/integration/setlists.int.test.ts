import { beforeEach, describe, expect, it } from "vitest";
import { createSetlist, deleteSetlist, getSetlist, listSetlists, parseSetlist, updateSetlist } from "@/lib/setlists";
import { createTone } from "@/lib/tones";
import { defaultPatch } from "@/lib/studio/patch";
import { makeActor, prisma, resetDb } from "./db";

beforeEach(resetDb);

describe("setlists", () => {
  it("are private to their owner and resolve only tones the owner can see", async () => {
    const me = await makeActor();
    const other = await makeActor();
    const mine = await createTone(me, { name: "Mine", data: { version: 2, studio: defaultPatch() }, visibility: "PRIVATE" });
    const theirsPrivate = await createTone(other, { name: "Theirs", data: { version: 2, studio: defaultPatch() }, visibility: "PRIVATE" });
    const s = await createSetlist(me.id, parseSetlist({ name: "Friday", date: "2026-11-06", items: [{ id: "a", title: "Opener", bpm: 128, toneId: mine, minutes: 4 }, { id: "b", title: "Ballad", toneId: theirsPrivate, minutes: 5.5 }] }));
    expect(s.items.map((i) => i.tone?.name ?? null)).toEqual(["Mine", null]);
    expect((await listSetlists(me.id))[0]).toMatchObject({ name: "Friday", songs: 2, minutes: 10, date: "2026-11-06" });

    expect(await getSetlist(other.id, s.id)).toBeNull();
    await expect(updateSetlist(other.id, s.id, { name: "Hijacked" })).rejects.toMatchObject({ status: 404 });
    await expect(deleteSetlist(other.id, s.id)).rejects.toMatchObject({ status: 404 });

    const reordered = await updateSetlist(me.id, s.id, { items: [s.items[1], s.items[0]].map(({ tone: _t, ...song }) => song) });
    expect(reordered.items.map((i) => i.title)).toEqual(["Ballad", "Opener"]);
    await deleteSetlist(me.id, s.id);
    expect(await prisma.setlist.count()).toBe(0);
  });

  it("reads a corrupted stored song list without failing", async () => {
    const me = await makeActor();
    const row = await prisma.setlist.create({ data: { userId: me.id, name: "Old", items: [{ id: "ok", title: "Fine" }, { title: 42 }, "junk"] } });
    expect((await getSetlist(me.id, row.id))?.items.map((i) => i.title)).toEqual(["Fine"]);
  });
});
