import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MUSICIAN_CARD_SELECT } from "@/lib/discovery";

/**
 * Discovering original music: releases by genre (the artist's genres or the
 * release's tags), a "for you" mix (people you follow, and artists who share
 * your genres), and artists worth following. Built only from real activity.
 */

export const MUSIC_WHERE: Prisma.PostWhereInput = { category: "ORIGINAL" };
const clean = (g: string) => g.trim().toLowerCase().slice(0, 24);

export function genreWhere(genre: string): Prisma.PostWhereInput {
  const g = clean(genre);
  return { OR: [{ author: { genres: { has: g } } }, { tags: { some: { tag: g } } }] };
}

export async function forYouWhere(viewerId: string): Promise<Prisma.PostWhereInput> {
  const [me, follows] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: viewerId }, select: { genres: true } }),
    prisma.follow.findMany({ where: { followerId: viewerId }, select: { followingId: true }, take: 2000 }),
  ]);
  return { authorId: { not: viewerId }, OR: [{ authorId: { in: follows.map((f) => f.followingId) } }, ...(me.genres.length ? [{ author: { genres: { hasSome: me.genres.map(clean) } } }] : [])] };
}

/** The genres people releasing music actually list, most common first. */
export async function musicGenres(limit = 14): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ g: string }[]>`
    SELECT lower(g) AS g FROM (
      SELECT unnest(u.genres) AS g FROM "User" u WHERE EXISTS (SELECT 1 FROM "Post" p WHERE p."authorId" = u.id AND p.category = 'ORIGINAL' AND p.status = 'PUBLISHED')
      UNION ALL
      SELECT t.tag FROM "PostTag" t JOIN "Post" p ON p.id = t."postId" WHERE p.category = 'ORIGINAL' AND p.status = 'PUBLISHED'
    ) x GROUP BY lower(g) ORDER BY count(*) DESC, lower(g) LIMIT ${limit}`;
  return rows.map((r) => r.g);
}

/** Artists who have released music, not you and not already followed; sharing your genres first. */
export async function artistsToDiscover(viewerId: string | null, limit = 6) {
  const me = viewerId ? await prisma.user.findUnique({ where: { id: viewerId }, select: { genres: true } }) : null;
  const mine = me?.genres.map(clean) ?? [];
  const rows = await prisma.user.findMany({
    where: {
      kind: "PERSON", status: "ACTIVE",
      posts: { some: { category: "ORIGINAL", status: "PUBLISHED" } },
      ...(viewerId && { id: { not: viewerId }, followers: { none: { followerId: viewerId } } }),
    },
    orderBy: [{ followerCount: "desc" }, { handle: "asc" }],
    take: 40,
    select: { ...MUSICIAN_CARD_SELECT, _count: { select: { posts: { where: { category: "ORIGINAL", status: "PUBLISHED" } } } } },
  });
  const shared = (g: string[]) => g.filter((x) => mine.includes(clean(x)));
  return rows
    .map((u) => ({ ...u, releases: u._count.posts, sharedGenres: shared(u.genres) }))
    .sort((a, b) => b.sharedGenres.length - a.sharedGenres.length)
    .slice(0, limit);
}
