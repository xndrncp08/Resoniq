import { NextResponse } from "next/server";
import type { CommunityKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, enforceRateLimit, optionalActor, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { hasBlockedTerm } from "@/lib/automod";
import { canCreateCommunity, COMMUNITY_KINDS, COMMUNITY_SELECT, parseCommunityInput } from "@/lib/communities";
import { decodeCursor, page, parseLimit } from "@/lib/pagination";
import { clientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { isUniqueViolation } from "@/lib/validation";

/** Directory: biggest first, optionally filtered by kind or a name search. */
export const GET = route("communities.list", async (req) => {
  await enforceRateLimit("social-read", clientIp(req), RATE_LIMITS.socialRead);
  const viewer = await optionalActor();
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim().slice(0, 60);
  const kind = url.searchParams.get("kind") as CommunityKind | null;
  const limit = parseLimit(url.searchParams.get("limit"), 24);
  const cursor = decodeCursor(url.searchParams.get("cursor"));
  const where: Prisma.CommunityWhereInput = {
    archivedAt: null,
    ...(kind && COMMUNITY_KINDS.includes(kind) && { kind }),
    ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q.toLowerCase() } }, { description: { contains: q, mode: "insensitive" } }] }),
    ...(url.searchParams.get("joined") === "1" && viewer && { members: { some: { userId: viewer.id } } }),
    ...(cursor && { OR: [{ memberCount: { lt: Number(cursor.t) } }, { memberCount: Number(cursor.t), id: { lt: cursor.id } }] }),
  };
  const rows = await prisma.community.findMany({ where, orderBy: [{ memberCount: "desc" }, { id: "desc" }], take: limit + 1, select: COMMUNITY_SELECT });
  const { items, nextCursor } = page(rows, limit, (r) => ({ t: String(r.memberCount), id: r.id }));
  const joined = viewer
    ? new Set((await prisma.communityMember.findMany({ where: { userId: viewer.id, communityId: { in: items.map((c) => c.id) } }, select: { communityId: true } })).map((m) => m.communityId))
    : new Set<string>();
  return NextResponse.json({ items: items.map((c) => ({ ...c, viewerJoined: joined.has(c.id) })), nextCursor });
});

export const POST = route("communities.create", async (req) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("community-create", actor.id, RATE_LIMITS.communityCreate);
  const input = parseCommunityInput(await readJson(req));
  const eligible = await canCreateCommunity(actor);
  if (!eligible.ok) throw new ApiError(403, eligible.reason);
  if (await hasBlockedTerm(`${input.name} ${input.slug} ${input.description}`)) throw new ApiError(400, "That name or description isn't allowed.");
  try {
    const community = await prisma.$transaction(async (tx) => {
      const c = await tx.community.create({
        data: { ...input, rules: input.rules, createdById: actor.id, memberCount: 1, members: { create: { userId: actor.id, role: "MODERATOR" } } },
        select: COMMUNITY_SELECT,
      });
      // Every user-created community is visible to admins in the audit log and console.
      await recordAudit(tx, { actorId: actor.id, action: "community.create", targetType: "Community", targetId: c.id, meta: { slug: c.slug } });
      return c;
    });
    return NextResponse.json({ community }, { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err, "slug")) throw new ApiError(409, "That address is taken.");
    throw err;
  }
});
