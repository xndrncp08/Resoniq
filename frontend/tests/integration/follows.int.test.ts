import { beforeEach, describe, expect, it } from "vitest";
import { follow, listFollows, unfollow } from "@/lib/follows";
import { deleteAccount } from "@/lib/account";
import { makeUser, prisma, resetDb } from "./db";

beforeEach(resetDb);

const counts = async (id: string) =>
  prisma.user.findUniqueOrThrow({ where: { id }, select: { followerCount: true, followingCount: true } });

describe("follow graph", () => {
  it("keeps counters exact under concurrent follow/unfollow", async () => {
    const a = await makeUser();
    const b = await makeUser();
    await Promise.all(Array.from({ length: 5 }, () => follow(a.id, b.id)));
    expect(await prisma.follow.count()).toBe(1);
    expect((await counts(b.id)).followerCount).toBe(1);
    expect((await counts(a.id)).followingCount).toBe(1);

    await Promise.all(Array.from({ length: 5 }, () => unfollow(a.id, b.id)));
    expect(await counts(b.id)).toMatchObject({ followerCount: 0 });
    expect(await counts(a.id)).toMatchObject({ followingCount: 0 });
  });

  it("paginates followers newest first without gaps", async () => {
    const star = await makeUser({ handle: "star" });
    for (let i = 0; i < 25; i++) {
      const fan = await makeUser();
      await prisma.follow.create({ data: { followerId: fan.id, followingId: star.id, createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)) } });
    }
    const first = (await listFollows("star", "followers", null, 20))!;
    expect(first.items).toHaveLength(20);
    expect(first.nextCursor).toBeTruthy();
    const { decodeCursor } = await import("@/lib/pagination");
    const second = (await listFollows("star", "followers", decodeCursor(first.nextCursor), 20))!;
    expect(second.items).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
    const all = [...first.items, ...second.items].map((i) => i.followedAt);
    expect(new Set(all).size).toBe(25);
    expect([...all].sort().reverse()).toEqual(all);
  });

  it("hides banned users from follow lists", async () => {
    const star = await makeUser({ handle: "star" });
    const banned = await makeUser();
    await follow(banned.id, star.id);
    await prisma.user.update({ where: { id: banned.id }, data: { status: "BANNED" } });
    expect((await listFollows("star", "followers", null, 20))!.items).toHaveLength(0);
  });
});

describe("deleteAccount", () => {
  it("removes the user's data, queues audio purges and fixes other users' counters", async () => {
    const gone = await makeUser();
    const friend = await makeUser();
    const fan = await makeUser();
    await prisma.song.create({ data: { userId: gone.id, storageKey: `${gone.id}/a.mp3` } });
    await prisma.song.create({ data: { userId: gone.id } });
    await prisma.tone.create({ data: { userId: gone.id, name: "x", data: {} } });
    await follow(gone.id, friend.id);
    await follow(fan.id, gone.id);

    expect(await deleteAccount(gone.id)).toEqual({ queuedDeletes: 1 });
    expect(await prisma.user.findUnique({ where: { id: gone.id } })).toBeNull();
    expect(await prisma.song.count()).toBe(0);
    expect(await prisma.tone.count()).toBe(0);
    const jobs = await prisma.job.findMany();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ type: "storage.delete", payload: { key: `${gone.id}/a.mp3` }, status: "QUEUED" });
    expect((await counts(friend.id)).followerCount).toBe(0);
    expect((await counts(fan.id)).followingCount).toBe(0);
  });
});
