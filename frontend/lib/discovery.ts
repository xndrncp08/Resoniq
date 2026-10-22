import { prisma } from "@/lib/prisma";
import { AUTHOR_SELECT } from "@/lib/profiles";
import { COMMUNITY_SELECT } from "@/lib/communities";

/** Real activity only: everything here is computed from published content. */

export async function trendingTags(days = 7, limit = 12) {
  const rows = await prisma.$queryRaw<{ tag: string; uses: bigint }[]>`
    SELECT pt.tag, COUNT(*) AS uses FROM "PostTag" pt
    JOIN "Post" p ON p.id = pt."postId" AND p.status = 'PUBLISHED'
    WHERE pt."createdAt" > (now() AT TIME ZONE 'UTC') - make_interval(days => ${days}::int)
    GROUP BY pt.tag ORDER BY uses DESC, pt.tag LIMIT ${limit}`;
  return rows.map((r) => ({ tag: r.tag, uses: Number(r.uses) }));
}

/** Communities the viewer hasn't joined, biggest first (matching their genres/instruments first). */
export async function suggestedCommunities(viewerId: string | null, limit = 5) {
  const me = viewerId ? await prisma.user.findUnique({ where: { id: viewerId }, select: { genres: true, instruments: true } }) : null;
  const interests = me ? [...me.genres, ...me.instruments].map((s) => s.replace(/\s+/g, "-")) : [];
  const where = { archivedAt: null, ...(viewerId && { members: { none: { userId: viewerId } } }) };
  const matched = interests.length
    ? await prisma.community.findMany({ where: { ...where, slug: { in: interests } }, orderBy: { memberCount: "desc" }, take: limit, select: COMMUNITY_SELECT })
    : [];
  const rest = await prisma.community.findMany({ where: { ...where, id: { notIn: matched.map((c) => c.id) } }, orderBy: [{ memberCount: "desc" }, { postCount: "desc" }], take: limit - matched.length, select: COMMUNITY_SELECT });
  return [...matched, ...rest];
}

/** Musicians whose posts earned the most amps recently. */
export async function risingMusicians(viewerId: string | null, limit = 5) {
  const rows = await prisma.$queryRaw<{ id: string; amps: bigint }[]>`
    SELECT p."authorId" AS id, SUM(p."upCount") AS amps FROM "Post" p
    JOIN "User" u ON u.id = p."authorId" AND u.status = 'ACTIVE'
    WHERE p.status = 'PUBLISHED' AND p."createdAt" > (now() AT TIME ZONE 'UTC') - interval '30 days'
      AND (${viewerId}::text IS NULL OR p."authorId" <> ${viewerId})
    GROUP BY p."authorId" HAVING SUM(p."upCount") > 0 ORDER BY amps DESC LIMIT ${limit}`;
  const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.id) } }, select: { ...AUTHOR_SELECT, instruments: true, followerCount: true } });
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.flatMap((r) => (byId.has(r.id) ? [{ ...byId.get(r.id)!, amps: Number(r.amps) }] : []));
}

export async function platformCounts() {
  const [musicians, posts, tones, communities] = await Promise.all([
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.post.count({ where: { status: "PUBLISHED" } }),
    prisma.tone.count({ where: { visibility: "PUBLIC" } }),
    prisma.community.count({ where: { archivedAt: null } }),
  ]);
  return { musicians, posts, tones, communities };
}
