import { prisma } from "@/lib/prisma";
import { memo } from "@/lib/memo";
import { AUTHOR_SELECT } from "@/lib/profiles";
import { COMMUNITY_SELECT } from "@/lib/communities";
import type { MusicianFilters } from "@/lib/musician-directory";

/** Public member profiles only. A unique handle gives stable, inexpensive paging. */
export async function discoverMusicians({ q, instrument, genre, after }: MusicianFilters) {
  const limit = 24;
  const needle = q.replace(/[\\%_]/g, "\\$&");
  const rows = await prisma.user.findMany({
    where: {
      kind: "PERSON", status: "ACTIVE", managedCreator: { is: null },
      ...(instrument && { instruments: { has: instrument } }),
      ...(genre && { genres: { has: genre } }),
      ...(after && { handle: { gt: after } }),
      ...(q && { OR: [
        { handle: { contains: needle, mode: "insensitive" } },
        { name: { contains: needle, mode: "insensitive" } },
        { bio: { contains: needle, mode: "insensitive" } },
      ] }),
    },
    select: { id: true, handle: true, name: true, image: true, bio: true, instruments: true, genres: true },
    orderBy: { handle: "asc" },
    take: limit + 1,
  });
  return { items: rows.slice(0, limit), nextCursor: rows.length > limit ? rows[limit - 1].handle : null };
}

/** Real activity only: everything here is computed from published content. */

export async function trendingTags(days = 7, limit = 12) {
  return memo(`trending:${days}:${limit}`, 60_000, () => loadTrendingTags(days, limit));
}

async function loadTrendingTags(days: number, limit: number) {
  const rows = await prisma.$queryRaw<{ tag: string; uses: bigint }[]>`
    SELECT pt.tag, COUNT(*) AS uses FROM "PostTag" pt
    JOIN "Post" p ON p.id = pt."postId" AND p.status = 'PUBLISHED'
    JOIN "User" u ON u.id = p."authorId" AND u.status <> 'BANNED'
    WHERE pt."createdAt" > (now() AT TIME ZONE 'UTC') - make_interval(days => ${days}::int)
    GROUP BY pt.tag ORDER BY uses DESC, pt.tag LIMIT ${limit}`;
  return rows.map((r) => ({ tag: r.tag, uses: Number(r.uses) }));
}

/** Communities the viewer hasn't joined, biggest first (matching their genres/instruments first). */
export async function suggestedCommunities(viewerId: string | null, limit = 5) {
  // Signed-out visitors all see the same list.
  if (!viewerId) return memo(`communities:anon:${limit}`, 300_000, () => loadSuggestedCommunities(null, limit));
  return loadSuggestedCommunities(viewerId, limit);
}

async function loadSuggestedCommunities(viewerId: string | null, limit: number) {
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
  // One shared ranking per minute; the viewer is filtered out afterwards instead of in SQL.
  const all = await memo(`rising:${limit + 1}`, 60_000, () => loadRisingMusicians(limit + 1));
  return all.filter((u) => u.id !== viewerId).slice(0, limit);
}

async function loadRisingMusicians(limit: number) {
  const rows = await prisma.$queryRaw<{ id: string; amps: bigint }[]>`
    SELECT p."authorId" AS id, SUM(p."upCount") AS amps FROM "Post" p
    JOIN "User" u ON u.id = p."authorId" AND u.status = 'ACTIVE' AND u.kind = 'PERSON'
    WHERE p.status = 'PUBLISHED' AND p."createdAt" > (now() AT TIME ZONE 'UTC') - interval '30 days'
      AND NOT EXISTS (SELECT 1 FROM "ManagedCreator" m WHERE m."userId" = u.id)
    GROUP BY p."authorId" HAVING SUM(p."upCount") > 0 ORDER BY amps DESC LIMIT ${limit}`;
  const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.id) } }, select: { ...AUTHOR_SELECT, instruments: true, followerCount: true } });
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.flatMap((r) => (byId.has(r.id) ? [{ ...byId.get(r.id)!, amps: Number(r.amps) }] : []));
}

export function platformCounts() {
  return memo("platform-counts", 60_000, loadPlatformCounts);
}

async function loadPlatformCounts() {
  const [musicians, posts, tones, communities] = await Promise.all([
    prisma.user.count({ where: { status: "ACTIVE", kind: "PERSON" } }),
    prisma.post.count({ where: { status: "PUBLISHED", author: { status: { not: "BANNED" } } } }),
    // Members' tones only: Resoniq-generated presets aren't community activity.
    prisma.tone.count({ where: { visibility: "PUBLIC", origin: "MEMBER", user: { status: { not: "BANNED" } } } }),
    prisma.community.count({ where: { archivedAt: null } }),
  ]);
  return { musicians, posts, tones, communities };
}
