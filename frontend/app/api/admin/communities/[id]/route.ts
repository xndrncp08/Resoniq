import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, readJson, route } from "@/lib/api";
import { requirePermission } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

/** { action: "archive" | "unarchive" } | { action: "moderator", handle, role: "MODERATOR" | "MEMBER" } */
export const POST = route<Ctx>("admin.communities.update", async (req, { params }) => {
  const actor = await requirePermission("communities.manage");
  const { id } = await params;
  const body = await readJson(req);
  const community = await prisma.community.findUnique({ where: { id }, select: { id: true } });
  if (!community) throw new ApiError(404, "Community not found.");
  await prisma.$transaction(async (tx) => {
    if (body.action === "archive" || body.action === "unarchive") {
      await tx.community.update({ where: { id }, data: { archivedAt: body.action === "archive" ? new Date() : null } });
      await recordAudit(tx, { actorId: actor.id, action: `community.${body.action}`, targetType: "Community", targetId: id, reason: typeof body.reason === "string" ? body.reason.slice(0, 500) : undefined });
    } else if (body.action === "moderator") {
      const role = body.role === "MEMBER" ? "MEMBER" : "MODERATOR";
      const user = typeof body.handle === "string" ? await tx.user.findFirst({ where: { handle: body.handle.replace(/^@/, "").toLowerCase(), status: "ACTIVE" }, select: { id: true } }) : null;
      if (!user) throw new ApiError(404, "No active member with that handle.");
      const existing = await tx.communityMember.findUnique({ where: { userId_communityId: { userId: user.id, communityId: id } } });
      if (existing) await tx.communityMember.update({ where: { userId_communityId: { userId: user.id, communityId: id } }, data: { role } });
      else {
        await tx.communityMember.create({ data: { userId: user.id, communityId: id, role } });
        await tx.community.update({ where: { id }, data: { memberCount: { increment: 1 } } });
      }
      await recordAudit(tx, { actorId: actor.id, action: "community.moderator.set", targetType: "Community", targetId: id, meta: { userId: user.id, role } });
    } else throw new ApiError(400, "Unknown action.");
  });
  return NextResponse.json({ ok: true });
});
