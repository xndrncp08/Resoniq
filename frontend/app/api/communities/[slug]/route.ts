import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, enforceRateLimit, optionalActor, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { COMMUNITY_SELECT, isCommunityModerator, parseCommunityPatch } from "@/lib/communities";
import { can } from "@/lib/permissions";
import { AUTHOR_SELECT } from "@/lib/profiles";
import { clientIp, RATE_LIMITS } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ slug: string }> };

export const GET = route<Ctx>("communities.get", async (req, { params }) => {
  enforceRateLimit("social-read", clientIp(req), RATE_LIMITS.socialRead);
  const viewer = await optionalActor();
  const community = await prisma.community.findUnique({
    where: { slug: (await params).slug.toLowerCase() },
    select: { ...COMMUNITY_SELECT, members: { where: { role: "MODERATOR", user: { status: { not: "BANNED" } } }, select: { user: { select: AUTHOR_SELECT } }, take: 20 } },
  });
  if (!community) throw new ApiError(404, "Community not found.");
  const membership = viewer
    ? await prisma.communityMember.findUnique({ where: { userId_communityId: { userId: viewer.id, communityId: community.id } }, select: { role: true } })
    : null;
  const { members, ...rest } = community;
  return NextResponse.json({
    community: { ...rest, moderators: members.map((m) => m.user) },
    viewer: { joined: !!membership, role: membership?.role ?? null, canModerate: !!viewer && (membership?.role === "MODERATOR" || can(viewer.role, "content.moderate")) },
  });
});

export const PATCH = route<Ctx>("communities.update", async (req, { params }) => {
  const actor = await requireActor({ write: true });
  enforceRateLimit("moderation", actor.id, RATE_LIMITS.moderation);
  const community = await prisma.community.findUnique({ where: { slug: (await params).slug.toLowerCase() }, select: { id: true } });
  if (!community) throw new ApiError(404, "Community not found.");
  if (!can(actor.role, "communities.manage") && !(await isCommunityModerator(actor.id, community.id))) throw new ApiError(403, "Not allowed.");
  const patch = parseCommunityPatch(await readJson(req));
  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.community.update({ where: { id: community.id }, data: patch, select: COMMUNITY_SELECT });
    await recordAudit(tx, { actorId: actor.id, action: "community.update", targetType: "Community", targetId: c.id, meta: { fields: Object.keys(patch) } });
    return c;
  });
  return NextResponse.json({ community: updated });
});
