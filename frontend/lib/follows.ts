import { prisma } from "@/lib/prisma";
import { page, type Cursor } from "@/lib/pagination";
import { AUTHOR_SELECT } from "@/lib/profiles";

/**
 * Follow edges with exact counters: the counter only moves when the edge row
 * was actually created or deleted, so double-clicks and races can't drift it.
 */
export async function follow(followerId: string, followingId: string) {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.follow.createMany({ data: [{ followerId, followingId }], skipDuplicates: true });
    if (count === 1) {
      await tx.user.update({ where: { id: followerId }, data: { followingCount: { increment: 1 } } });
      await tx.user.update({ where: { id: followingId }, data: { followerCount: { increment: 1 } } });
    }
    const target = await tx.user.findUniqueOrThrow({ where: { id: followingId }, select: { followerCount: true } });
    return { following: true as const, followerCount: target.followerCount, created: count === 1 };
  });
}

export async function unfollow(followerId: string, followingId: string) {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.follow.deleteMany({ where: { followerId, followingId } });
    if (count === 1) {
      await tx.user.update({ where: { id: followerId }, data: { followingCount: { decrement: 1 } } });
      await tx.user.update({ where: { id: followingId }, data: { followerCount: { decrement: 1 } } });
    }
    const target = await tx.user.findUniqueOrThrow({ where: { id: followingId }, select: { followerCount: true } });
    return { following: false as const, followerCount: target.followerCount };
  });
}

/** Newest first. Null when the handle doesn't resolve to a visible user. */
export async function listFollows(handle: string, direction: "followers" | "following", cursor: Cursor | null, limit: number) {
  const user = await prisma.user.findFirst({ where: { handle, status: { not: "BANNED" } }, select: { id: true } });
  if (!user) return null;
  const mine = direction === "followers" ? "followingId" : "followerId";
  const other = direction === "followers" ? "follower" : "following";
  const otherId = direction === "followers" ? "followerId" : "followingId";
  const rows = await prisma.follow.findMany({
    where: {
      [mine]: user.id,
      [other]: { status: { not: "BANNED" } },
      ...(cursor && {
        OR: [{ createdAt: { lt: new Date(cursor.t) } }, { createdAt: new Date(cursor.t), [otherId]: { lt: cursor.id } }],
      }),
    },
    orderBy: [{ createdAt: "desc" }, { [otherId]: "desc" }],
    take: limit + 1,
    select: { createdAt: true, followerId: true, followingId: true, follower: { select: AUTHOR_SELECT }, following: { select: AUTHOR_SELECT } },
  });
  const { items, nextCursor } = page(rows, limit, (r) => ({ t: r.createdAt.toISOString(), id: r[otherId] }));
  return {
    items: items.map((r) => ({ ...r[other], followedAt: r.createdAt.toISOString() })),
    nextCursor,
  };
}
