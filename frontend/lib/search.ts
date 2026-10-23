import { prisma } from "@/lib/prisma";
import { COMMUNITY_SELECT } from "@/lib/communities";
import { GEAR_SELECT } from "@/lib/gear";
import { POST_VIEW_SELECT, withViewerState } from "@/lib/posts";
import { AUTHOR_SELECT } from "@/lib/profiles";
import { getToneRows, toToneView } from "@/lib/tones";

/**
 * Site search over Postgres: full-text (websearch syntax: quotes, OR, -word)
 * for posts, tones and communities; trigram similarity for musicians and gear,
 * which people tend to half-remember. The expressions must match the indexes
 * in the `search` migration exactly.
 */
export const SEARCH_TYPES = ["posts", "tones", "musicians", "communities", "gear"] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];
// shortcut: offset pagination (fine for a few pages of results); switch to keyset on rank if deep paging matters.
export const SEARCH_PAGE = 20;

const keepOrder = <T extends { id: string }>(ids: string[], rows: T[]) => {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
};

export async function searchPosts(q: string, viewerId: string | null, offset = 0, limit = SEARCH_PAGE) {
  const ids = (
    await prisma.$queryRaw<{ id: string }[]>`
      SELECT p.id FROM "Post" p JOIN "User" u ON u.id = p."authorId" AND u.status <> 'BANNED'
      WHERE p.status = 'PUBLISHED'
        AND to_tsvector('english', coalesce(p."title", '') || ' ' || p."body") @@ websearch_to_tsquery('english', ${q})
      ORDER BY ts_rank(to_tsvector('english', coalesce(p."title", '') || ' ' || p."body"), websearch_to_tsquery('english', ${q})) DESC, p."createdAt" DESC
      LIMIT ${limit} OFFSET ${offset}`
  ).map((r) => r.id);
  const rows = await prisma.post.findMany({ where: { id: { in: ids } }, select: POST_VIEW_SELECT });
  return withViewerState(keepOrder(ids, rows), viewerId);
}

/** `source`: "members" hides Resoniq-generated presets, "generated" shows only them. */
export async function searchTones(q: string, viewerId: string | null, offset = 0, limit = SEARCH_PAGE, source?: "members" | "generated") {
  const origin = source === "generated" ? "GENERATED" : source === "members" ? "MEMBER" : null;
  const ids = (
    await prisma.$queryRaw<{ id: string }[]>`
      SELECT t.id FROM "Tone" t JOIN "User" u ON u.id = t."userId" AND u.status <> 'BANNED'
      WHERE t.visibility = 'PUBLIC' AND (${origin}::text IS NULL OR t.origin::text = ${origin})
        AND to_tsvector('english', t."name" || ' ' || coalesce(t."description", '')) @@ websearch_to_tsquery('english', ${q})
      ORDER BY ts_rank(to_tsvector('english', t."name" || ' ' || coalesce(t."description", '')), websearch_to_tsquery('english', ${q})) DESC, t."saveCount" DESC
      LIMIT ${limit} OFFSET ${offset}`
  ).map((r) => r.id);
  return keepOrder(ids, await getToneRows(ids)).map((t) => toToneView(t, viewerId));
}

export async function searchCommunities(q: string, offset = 0, limit = SEARCH_PAGE) {
  const ids = (
    await prisma.$queryRaw<{ id: string }[]>`
      SELECT c.id FROM "Community" c
      WHERE c."archivedAt" IS NULL
        AND (to_tsvector('english', c."name" || ' ' || c."description") @@ websearch_to_tsquery('english', ${q}) OR c.slug LIKE lower(${q}) || '%')
      ORDER BY c."memberCount" DESC LIMIT ${limit} OFFSET ${offset}`
  ).map((r) => r.id);
  return keepOrder(ids, await prisma.community.findMany({ where: { id: { in: ids } }, select: COMMUNITY_SELECT }));
}

export async function searchMusicians(q: string, offset = 0, limit = SEARCH_PAGE) {
  const needle = q.toLowerCase().replace(/^@/, "");
  const ids = (
    await prisma.$queryRaw<{ id: string }[]>`
      SELECT u.id FROM "User" u
      WHERE u.status <> 'BANNED' AND u.kind = 'PERSON'
        AND (lower(u."handle") % ${needle} OR lower(coalesce(u."name", '')) % ${needle} OR lower(u."handle") LIKE ${needle} || '%')
      ORDER BY greatest(similarity(lower(u."handle"), ${needle}), similarity(lower(coalesce(u."name", '')), ${needle})) DESC, u."followerCount" DESC
      LIMIT ${limit} OFFSET ${offset}`
  ).map((r) => r.id);
  return keepOrder(ids, await prisma.user.findMany({ where: { id: { in: ids } }, select: { ...AUTHOR_SELECT, bio: true, followerCount: true, instruments: true } }));
}

export async function searchGearItems(q: string, offset = 0, limit = SEARCH_PAGE) {
  const needle = q.toLowerCase();
  const ids = (
    await prisma.$queryRaw<{ id: string }[]>`
      SELECT g.id FROM "GearItem" g
      WHERE g.status = 'APPROVED' AND (lower(g."brand" || ' ' || g."model") % ${needle} OR lower(g."brand" || ' ' || g."model") LIKE '%' || ${needle} || '%')
      ORDER BY similarity(lower(g."brand" || ' ' || g."model"), ${needle}) DESC LIMIT ${limit} OFFSET ${offset}`
  ).map((r) => r.id);
  return keepOrder(ids, await prisma.gearItem.findMany({ where: { id: { in: ids } }, select: GEAR_SELECT }));
}

/** A few of each, for the "All" results view. */
export async function searchAll(q: string, viewerId: string | null) {
  const [posts, tones, musicians, communities, gear] = await Promise.all([
    searchPosts(q, viewerId, 0, 6),
    searchTones(q, viewerId, 0, 6),
    searchMusicians(q, 0, 6),
    searchCommunities(q, 0, 6),
    searchGearItems(q, 0, 8),
  ]);
  return { posts, tones, musicians, communities, gear };
}
