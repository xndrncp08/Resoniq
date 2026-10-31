import type { ReportTarget } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import type { Actor } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { isCommunityModerator } from "@/lib/communities";
import { notify } from "@/lib/notify";
import { announceRelease } from "@/lib/credits";
import { can } from "@/lib/permissions";
import { fail } from "@/lib/validation";

export type ModerationAction = "remove" | "restore";

export function parseModeration(body: Record<string, unknown>): { action: ModerationAction; reason: string } {
  const action = body.action;
  if (action !== "remove" && action !== "restore") fail("action must be remove or restore.");
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  if (action === "remove" && !reason) fail("Give a reason; the author sees it.");
  return { action, reason };
}

/** Platform moderators anywhere; community moderators only inside their community. */
async function assertCanModerate(actor: Actor, communityId: string | null) {
  if (can(actor.role, "content.moderate")) return;
  if (await isCommunityModerator(actor.id, communityId)) return;
  throw new ApiError(403, "Not allowed.");
}

async function closeReports(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], targetType: ReportTarget, targetId: string, actorId: string, resolution: string) {
  await tx.report.updateMany({
    where: { targetType, targetId, status: "OPEN" },
    data: { status: "ACTIONED", resolvedById: actorId, resolution, resolvedAt: new Date() },
  });
}

export async function moderatePost(actor: Actor, postId: string, { action, reason }: { action: ModerationAction; reason: string }) {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, authorId: true, communityId: true, status: true } });
  if (!post || post.status === "DELETED") throw new ApiError(404, "Post not found.");
  await assertCanModerate(actor, post.communityId);
  if (action === "restore" && post.status !== "REMOVED" && post.status !== "HELD") throw new ApiError(400, "Only removed or held posts can be restored.");
  if (action === "remove" && post.status === "REMOVED") throw new ApiError(400, "Already removed.");

  await prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id: postId },
      data: action === "remove" ? { status: "REMOVED", removedReason: reason } : { status: "PUBLISHED", removedReason: null, heldReasons: [] },
    });
    if (action === "remove") await closeReports(tx, "POST", postId, actor.id, `Removed: ${reason}`);
    await recordAudit(tx, { actorId: actor.id, action: `post.${action}`, targetType: "Post", targetId: postId, reason: reason || undefined, meta: { from: post.status } });
    await notify({ userId: post.authorId, type: "MODERATION", actorId: null, postId, data: { action, target: "post", reason } }, tx);
  });
  // A release held at publish was never announced; approving it is when credits and followers hear about it.
  if (action === "restore") await announceRelease(postId);
}

export async function moderateComment(actor: Actor, commentId: string, { action, reason }: { action: ModerationAction; reason: string }) {
  const c = await prisma.comment.findUnique({ where: { id: commentId }, select: { id: true, authorId: true, status: true, postId: true, parentId: true, post: { select: { communityId: true } } } });
  if (!c || c.status === "DELETED") throw new ApiError(404, "Comment not found.");
  await assertCanModerate(actor, c.post.communityId);
  if (action === "restore" && c.status !== "REMOVED" && c.status !== "HELD") throw new ApiError(400, "Only removed or held comments can be restored.");
  if (action === "remove" && c.status === "REMOVED") throw new ApiError(400, "Already removed.");

  await prisma.$transaction(async (tx) => {
    await tx.comment.update({ where: { id: commentId }, data: action === "remove" ? { status: "REMOVED", removedReason: reason } : { status: "PUBLISHED", removedReason: null } });
    // Counters track published comments only.
    const delta = action === "remove" && c.status === "PUBLISHED" ? -1 : action === "restore" ? 1 : 0;
    if (delta) {
      await tx.post.update({ where: { id: c.postId }, data: { commentCount: { increment: delta } } });
      if (c.parentId) await tx.comment.update({ where: { id: c.parentId }, data: { replyCount: { increment: delta } } });
    }
    if (action === "remove") await closeReports(tx, "COMMENT", commentId, actor.id, `Removed: ${reason}`);
    await recordAudit(tx, { actorId: actor.id, action: `comment.${action}`, targetType: "Comment", targetId: commentId, reason: reason || undefined, meta: { from: c.status } });
    await notify({ userId: c.authorId, type: "MODERATION", actorId: null, postId: c.postId, commentId, data: { action, target: "comment", reason } }, tx);
  });
}
