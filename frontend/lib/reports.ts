import type { AppealTarget, ReportReason, ReportTarget } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { isSuspended, type Actor } from "@/lib/authz";
import { reportHoldThreshold } from "@/lib/automod";
import { fail, isUniqueViolation } from "@/lib/validation";

export const REPORT_TARGETS: ReportTarget[] = ["POST", "COMMENT", "USER", "MEDIA", "COMMUNITY", "TONE", "MESSAGE"];
export const REPORT_REASONS: ReportReason[] = ["SPAM", "HARASSMENT", "HATE", "NSFW", "VIOLENCE", "COPYRIGHT", "IMPERSONATION", "MISINFORMATION", "OTHER"];

export function parseReport(body: Record<string, unknown>) {
  const targetType = body.targetType as ReportTarget;
  const reason = body.reason as ReportReason;
  if (!REPORT_TARGETS.includes(targetType)) fail("Unknown report target.");
  if (!REPORT_REASONS.includes(reason)) fail("Pick a reason.");
  if (typeof body.targetId !== "string" || !body.targetId) fail("targetId is required.");
  const details = typeof body.details === "string" ? body.details.trim().slice(0, 2000) : "";
  if ((reason === "COPYRIGHT" || reason === "OTHER") && details.length < 10) {
    fail(reason === "COPYRIGHT" ? "Describe the work you own and where the original is." : "Tell us what's wrong.");
  }
  return { targetType, targetId: body.targetId, reason, details: details || null };
}

/** Confirms the reported thing exists (and is something the reporter could see). */
async function targetExists(type: ReportTarget, id: string, reporterId: string): Promise<boolean> {
  const found = await {
    POST: () => prisma.post.findFirst({ where: { id, status: { in: ["PUBLISHED", "HELD", "PROCESSING"] } }, select: { id: true } }),
    COMMENT: () => prisma.comment.findFirst({ where: { id, status: { in: ["PUBLISHED", "HELD"] } }, select: { id: true } }),
    USER: () => prisma.user.findFirst({ where: { id, status: { not: "BANNED" } }, select: { id: true } }),
    COMMUNITY: () => prisma.community.findFirst({ where: { id }, select: { id: true } }),
    TONE: () => prisma.tone.findFirst({ where: { id }, select: { id: true } }),
    MEDIA: () => prisma.media.findFirst({ where: { id, status: "READY" }, select: { id: true } }),
    // Private: only someone in the conversation can report a message (moderators then see it).
    MESSAGE: () => prisma.message.findFirst({ where: { id, deletedAt: null, authorId: { not: reporterId }, conversation: { members: { some: { userId: reporterId } } } }, select: { id: true } }),
  }[type]();
  return !!found;
}

export async function fileReport(actor: Actor, input: ReturnType<typeof parseReport>) {
  if (!(await targetExists(input.targetType, input.targetId, actor.id))) throw new ApiError(404, "That content no longer exists.");
  try {
    await prisma.report.create({ data: { reporterId: actor.id, ...input } });
  } catch (err) {
    // Already reported by this person and still open: same answer, no duplicate.
    if (!isUniqueViolation(err)) throw err;
  }
  await maybeHold(input.targetType, input.targetId);
}

/** Enough distinct open reports put published content on hold until a moderator looks. */
async function maybeHold(type: ReportTarget, id: string) {
  if (type !== "POST" && type !== "COMMENT") return;
  const threshold = await reportHoldThreshold();
  if (!Number.isFinite(threshold)) return;
  const reporters = await prisma.report.groupBy({ by: ["reporterId"], where: { targetType: type, targetId: id, status: "OPEN" } });
  if (reporters.length < threshold) return;
  if (type === "POST") {
    await prisma.post.updateMany({ where: { id, status: "PUBLISHED" }, data: { status: "HELD", heldReasons: { push: "Multiple reports" } } });
  } else {
    await prisma.comment.updateMany({ where: { id, status: "PUBLISHED" }, data: { status: "HELD" } });
  }
}

export const APPEAL_TARGETS: AppealTarget[] = ["POST", "COMMENT", "ACCOUNT", "MEDIA"];

export function parseAppeal(body: Record<string, unknown>) {
  const targetType = body.targetType as AppealTarget;
  if (!APPEAL_TARGETS.includes(targetType)) fail("Unknown appeal target.");
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (text.length < 20 || text.length > 4000) fail("Explain in 20–4000 characters why this should be reversed.");
  return { targetType, targetId: typeof body.targetId === "string" ? body.targetId : "", body: text };
}

/** Appeals are for your own removed content, or your own suspension. */
export async function fileAppeal(actor: Actor, input: ReturnType<typeof parseAppeal>) {
  const ok = await {
    POST: () => prisma.post.findFirst({ where: { id: input.targetId, authorId: actor.id, status: { in: ["REMOVED", "HELD"] } } }),
    COMMENT: () => prisma.comment.findFirst({ where: { id: input.targetId, authorId: actor.id, status: { in: ["REMOVED", "HELD"] } } }),
    ACCOUNT: async () => (input.targetId === actor.id && isSuspended(actor) ? actor : null),
    MEDIA: () => prisma.media.findFirst({ where: { id: input.targetId, ownerId: actor.id, status: "REMOVED" } }),
  }[input.targetType]();
  if (!ok) throw new ApiError(404, "Nothing to appeal there.");
  try {
    return await prisma.appeal.create({ data: { userId: actor.id, ...input }, select: { id: true, status: true, createdAt: true } });
  } catch (err) {
    if (isUniqueViolation(err)) throw new ApiError(409, "You already have an open appeal for this.");
    throw err;
  }
}
