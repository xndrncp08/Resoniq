import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, readJson, route } from "@/lib/api";
import { requirePermission } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";

type Ctx = { params: Promise<{ id: string }> };

/** { action: "unpublish", reason }: takes a public tone out of discovery (it stays reachable by link to its owner's audience). */
export const POST = route<Ctx>("admin.tones.update", async (req, { params }) => {
  const actor = await requirePermission("content.moderate");
  const { id } = await params;
  const body = await readJson(req);
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  if (body.action !== "unpublish" || !reason) throw new ApiError(400, "Give a reason to unpublish.");
  await prisma.$transaction(async (tx) => {
    const tone = await tx.tone.findUnique({ where: { id }, select: { userId: true, visibility: true } });
    if (!tone) throw new ApiError(404, "Tone not found.");
    await tx.tone.update({ where: { id }, data: { visibility: "UNLISTED" } });
    await tx.report.updateMany({ where: { targetType: "TONE", targetId: id, status: "OPEN" }, data: { status: "ACTIONED", resolvedById: actor.id, resolution: `Unpublished: ${reason}`, resolvedAt: new Date() } });
    await recordAudit(tx, { actorId: actor.id, action: "tone.unpublish", targetType: "Tone", targetId: id, reason, meta: { from: tone.visibility } });
    await notify({ userId: tone.userId, type: "MODERATION", toneId: id, data: { action: "unpublish", target: "tone", reason } }, tx);
  });
  return NextResponse.json({ ok: true });
});
