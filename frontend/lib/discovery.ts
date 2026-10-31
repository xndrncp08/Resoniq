import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { memo } from "@/lib/memo";
import { AUTHOR_SELECT } from "@/lib/profiles";
import { COMMUNITY_SELECT } from "@/lib/communities";
import type { MusicianFilters } from "@/lib/musician-directory";

export const MUSICIAN_CARD_SELECT = { id: true, handle: true, name: true, image: true, bio: true, instruments: true, genres: true, openTo: true, location: true, availableUntil: true } as const;

// Guitars of any kind cover the same part of a band; every other instrument is its own role.
const GUITARS = ["electric-guitar", "acoustic-guitar", "extended-range"];

/**
 * Musicians to play with: they share a genre, play a part the viewer doesn't,
 * and have said they're open to playing with others (nobody is suggested who
 * hasn't). Ranked by shared genres, shared intentions and the same location.
 */
export async function playMates(viewerId: string, limit = 6) {
  const me = await prisma.user.findUniqueOrThrow({ where: { id: viewerId }, select: { instruments: true, genres: true, openTo: true, location: true } });
  if (!me.instruments.length || !me.genres.length) return { items: [], missing: !me.instruments.length ? "instruments" : "genres" } as const;
  const covered = me.instruments.some((i) => GUITARS.includes(i)) ? [...new Set([...me.instruments, ...GUITARS])] : me.instruments;
  const place = me.location?.trim().toLowerCase() ?? "";
  const rows = await prisma.$queryRaw<{ id: string; near: boolean }[]>`
    SELECT id, near FROM (
      SELECT u.id, u.handle, u."followerCount",
        (SELECT count(*) FROM unnest(u.genres) g WHERE g = ANY(${me.genres}::text[])) AS shared,
        (SELECT count(*) FROM unnest(u."openTo") o WHERE o = ANY(${me.openTo}::text[])) AS open_shared,
        (${place} <> '' AND lower(trim(coalesce(u.location, ''))) = ${place}) AS near,
        (u."availableUntil" IS NOT NULL AND u."availableUntil" >= now()) AS available
      FROM "User" u
      WHERE u.id <> ${viewerId} AND u.kind = 'PERSON' AND u.status = 'ACTIVE'
        AND NOT EXISTS (SELECT 1 FROM "ManagedCreator" m WHERE m."userId" = u.id)
        AND cardinality(u."openTo") > 0
        AND u.genres && ${me.genres}::text[]
        AND EXISTS (SELECT 1 FROM unnest(u.instruments) i WHERE NOT (i = ANY(${covered}::text[])))
        AND NOT EXISTS (SELECT 1 FROM "Follow" f WHERE f."followerId" = ${viewerId} AND f."followingId" = u.id)
    ) c
    ORDER BY 2 * shared + open_shared + CASE WHEN near THEN 3 ELSE 0 END + CASE WHEN available THEN 2 ELSE 0 END DESC, "followerCount" DESC, handle
    LIMIT ${limit}`;
  const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.id) } }, select: MUSICIAN_CARD_SELECT });
  const byId = new Map(users.map((u) => [u.id, u]));
  const mine = new Set(me.genres);
  return {
    items: rows.flatMap((r) => {
      const u = byId.get(r.id);
      if (!u) return [];
      // Why they're suggested, in the viewer's terms.
      const plays = u.instruments.filter((i) => !covered.includes(i));
      return [{ ...u, why: { plays, genres: u.genres.filter((g) => mine.has(g)), near: r.near } }];
    }),
    missing: null,
  } as const;
}

/** Public member profiles only. A unique handle gives stable, inexpensive paging. */
export async function discoverMusicians({ q, instrument, genre, open, available, after }: MusicianFilters) {
  const limit = 24;
  const needle = q.replace(/[\\%_]/g, "\\$&");
  const rows = await prisma.user.findMany({
    where: {
      kind: "PERSON", status: "ACTIVE", managedCreator: { is: null },
      ...(instrument && { instruments: { has: instrument } }),
      ...(genre && { genres: { has: genre } }),
      ...(open && { openTo: { has: open } }),
      ...(available && { availableUntil: { gte: new Date() } }),
      ...(after && { handle: { gt: after } }),
      ...(q && { OR: [
        { handle: { contains: needle, mode: "insensitive" } },
        { name: { contains: needle, mode: "insensitive" } },
        { bio: { contains: needle, mode: "insensitive" } },
      ] }),
    },
    select: MUSICIAN_CARD_SELECT,
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

/**
 * Candidate ids for "people you might like": everyone matching `base` who shares a genre
 * or instrument with you (GIN-indexed array overlap, so a match is found however few
 * followers they have), topped up with the most followed. Callers load and rank the pool;
 * it is bounded, so that ranking can stay in memory as the user table grows.
 */
export async function suggestionPool(base: Prisma.UserWhereInput, me: { genres: string[]; instruments: string[] }, size = 50): Promise<string[]> {
  const order = [{ followerCount: "desc" as const }, { id: "asc" as const }];
  const overlap = [...(me.genres.length ? [{ genres: { hasSome: me.genres } }] : []), ...(me.instruments.length ? [{ instruments: { hasSome: me.instruments } }] : [])];
  const [matching, popular] = await Promise.all([
    overlap.length ? prisma.user.findMany({ where: { AND: [base, { OR: overlap }] }, orderBy: order, take: size, select: { id: true } }) : [],
    prisma.user.findMany({ where: base, orderBy: order, take: 20, select: { id: true } }),
  ]);
  return [...new Set([...matching, ...popular].map((u) => u.id))];
}
