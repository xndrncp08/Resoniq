import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, readJson, route } from "@/lib/api";
import { requirePermission } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";

type Ctx = { params: Promise<{ id: string }> };

/** { action: "remove", reason }: removes a reported private message (its text and attachments). */
export const POST = route<Ctx>("admin.messages.remove", async (req, { params }) => {
  const actor = await requirePermission("content.moderate");
  const { id } = await params;
  const body = await readJson(req);
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  if (body.action !== "remove" || !reason) throw new ApiError(400, "Give a reason to remove the message.");
  await prisma.$transaction(async (tx) => {
    const msg = await tx.message.findUnique({ where: { id }, select: { authorId: true, deletedAt: true } });
    if (!msg) throw new ApiError(404, "Message not found.");
    if (!msg.deletedAt) await tx.message.update({ where: { id }, data: { deletedAt: new Date(), body: "" } });
    await tx.report.updateMany({ where: { targetType: "MESSAGE", targetId: id, status: "OPEN" }, data: { status: "ACTIONED", resolvedById: actor.id, resolution: `Removed: ${reason}`, resolvedAt: new Date() } });
    await recordAudit(tx, { actorId: actor.id, action: "message.remove", targetType: "Message", targetId: id, reason });
    await notify({ userId: msg.authorId, type: "MODERATION", data: { action: "remove", target: "message", reason } }, tx);
  });
  return NextResponse.json({ ok: true });
});
