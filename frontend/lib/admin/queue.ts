import type { AppealStatus, ReportReason, ReportTarget } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import type { Actor } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { restoreMedia } from "@/lib/media/service";
import { moderateComment, moderatePost } from "@/lib/moderation";
import { notify } from "@/lib/notify";
import { can } from "@/lib/permissions";
import { fail } from "@/lib/validation";

export type QueueItem = {
  targetType: ReportTarget;
  targetId: string;
  reports: number;
  reasons: Partial<Record<ReportReason, number>>;
  firstAt: Date;
  lastAt: Date;
  details: string[];
  preview: { title: string; href: string | null; status: string | null; author: string | null };
};

async function preview(type: ReportTarget, id: string): Promise<QueueItem["preview"]> {
  if (type === "POST") {
    const p = await prisma.post.findUnique({ where: { id }, select: { title: true, body: true, status: true, author: { select: { handle: true } } } });
    return p ? { title: p.title ?? p.body.slice(0, 140), href: `/p/${id}`, status: p.status, author: p.author.handle } : { title: "(deleted)", href: null, status: null, author: null };
  }
  if (type === "COMMENT") {
    const c = await prisma.comment.findUnique({ where: { id }, select: { body: true, status: true, postId: true, author: { select: { handle: true } } } });
    return c ? { title: c.body.slice(0, 140), href: `/p/${c.postId}#comments`, status: c.status, author: c.author.handle } : { title: "(deleted)", href: null, status: null, author: null };
  }
  if (type === "USER") {
    const u = await prisma.user.findUnique({ where: { id }, select: { handle: true, status: true } });
    return u ? { title: `@${u.handle}`, href: `/admin/users/${id}`, status: u.status, author: u.handle } : { title: "(deleted)", href: null, status: null, author: null };
  }
  if (type === "MEDIA") {
    const m = await prisma.media.findUnique({ where: { id }, select: { kind: true, status: true, postId: true, owner: { select: { handle: true } } } });
    return m ? { title: `${m.kind.toLowerCase()} upload`, href: m.postId ? `/p/${m.postId}` : null, status: m.status, author: m.owner.handle } : { title: "(deleted)", href: null, status: null, author: null };
  }
  if (type === "MESSAGE") {
    // Shown to moderators only because someone in the conversation reported it.
    const m = await prisma.message.findUnique({ where: { id }, select: { body: true, deletedAt: true, author: { select: { handle: true } } } });
    return m ? { title: m.deletedAt ? "(removed)" : m.body.slice(0, 280) || "(attachment only)", href: null, status: m.deletedAt ? "REMOVED" : "PRIVATE", author: m.author.handle } : { title: "(deleted)", href: null, status: null, author: null };
  }
  if (type === "TONE") {
    const t = await prisma.tone.findUnique({ where: { id }, select: { name: true, visibility: true, user: { select: { handle: true } } } });
    return t ? { title: t.name, href: `/t/${id}`, status: t.visibility, author: t.user.handle } : { title: "(deleted)", href: null, status: null, author: null };
  }
  const c = await prisma.community.findUnique({ where: { id }, select: { name: true, slug: true, archivedAt: true } });
  return c ? { title: c.name, href: `/c/${c.slug}`, status: c.archivedAt ? "ARCHIVED" : "ACTIVE", author: null } : { title: "(deleted)", href: null, status: null, author: null };
}

/** Open reports grouped by what they're about, most-reported first, copyright before the rest. */
export async function reportQueue(type?: ReportTarget, limit = 50): Promise<QueueItem[]> {
  const open = await prisma.report.findMany({ where: { status: "OPEN", ...(type && { targetType: type }) }, orderBy: { createdAt: "asc" }, take: 2000 });
  const groups = new Map<string, QueueItem>();
  for (const r of open) {
    const key = `${r.targetType}:${r.targetId}`;
    const g = groups.get(key) ?? { targetType: r.targetType, targetId: r.targetId, reports: 0, reasons: {}, firstAt: r.createdAt, lastAt: r.createdAt, details: [], preview: { title: "", href: null, status: null, author: null } };
    g.reports += 1;
    g.reasons[r.reason] = (g.reasons[r.reason] ?? 0) + 1;
    g.lastAt = r.createdAt;
    if (r.details && g.details.length < 5) g.details.push(r.details);
    groups.set(key, g);
  }
  const items = [...groups.values()].sort((a, b) => Number(!!b.reasons.COPYRIGHT) - Number(!!a.reasons.COPYRIGHT) || b.reports - a.reports || a.firstAt.getTime() - b.firstAt.getTime()).slice(0, limit);
  for (const i of items) i.preview = await preview(i.targetType, i.targetId);
  return items;
}

export async function dismissReports(actor: Actor, targetType: ReportTarget, targetId: string, note: string) {
  if (!can(actor.role, "content.moderate")) throw new ApiError(403, "Not allowed.");
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.report.updateMany({ where: { targetType, targetId, status: "OPEN" }, data: { status: "DISMISSED", resolvedById: actor.id, resolution: note || "Dismissed", resolvedAt: new Date() } });
    if (!count) throw new ApiError(404, "No open reports for that.");
    await recordAudit(tx, { actorId: actor.id, action: "reports.dismiss", targetType, targetId, reason: note || undefined, meta: { count } });
    // A hold placed only because of reports lifts when those reports are dismissed.
    if (targetType === "POST") await tx.post.updateMany({ where: { id: targetId, status: "HELD", heldReasons: { equals: ["Multiple reports"] } }, data: { status: "PUBLISHED", heldReasons: [] } });
    if (targetType === "COMMENT") await tx.comment.updateMany({ where: { id: targetId, status: "HELD" }, data: { status: "PUBLISHED" } });
  });
}

export function parseDecision(body: Record<string, unknown>): { decision: Exclude<AppealStatus, "OPEN">; note: string } {
  const decision = body.decision as AppealStatus;
  if (decision !== "UPHELD" && decision !== "REVERSED") fail("decision must be UPHELD or REVERSED.");
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";
  if (!note) fail("Explain the decision; the member sees it.");
  return { decision, note };
}

/**
 * Decide an appeal. Reversing undoes the original action: content is
 * restored, a suspension is lifted. The moderator who acted can't decide it.
 */
export async function decideAppeal(actor: Actor, id: string, { decision, note }: ReturnType<typeof parseDecision>) {
  if (!can(actor.role, "content.moderate")) throw new ApiError(403, "Not allowed.");
  const appeal = await prisma.appeal.findUnique({ where: { id } });
  if (!appeal || appeal.status !== "OPEN") throw new ApiError(404, "Appeal not found or already decided.");
  const original = await prisma.auditLog.findFirst({ where: { targetId: appeal.targetId, action: { in: ["post.remove", "comment.remove", "media.remove", "user.suspended"] } }, orderBy: { createdAt: "desc" } });
  if (original?.actorId === actor.id) throw new ApiError(403, "Another moderator needs to review an appeal of your own action.");

  if (decision === "REVERSED") {
    if (appeal.targetType === "POST") await moderatePost(actor, appeal.targetId, { action: "restore", reason: note });
    else if (appeal.targetType === "COMMENT") await moderateComment(actor, appeal.targetId, { action: "restore", reason: note });
    else if (appeal.targetType === "MEDIA") await restoreMedia(actor, appeal.targetId);
    else {
      if (!can(actor.role, "users.suspend")) throw new ApiError(403, "Not allowed.");
      await prisma.user.updateMany({ where: { id: appeal.targetId, status: "SUSPENDED" }, data: { status: "ACTIVE", suspendedUntil: null, statusReason: null } });
    }
  }
  await prisma.$transaction(async (tx) => {
    await tx.appeal.update({ where: { id }, data: { status: decision, decidedById: actor.id, decisionNote: note, decidedAt: new Date() } });
    await recordAudit(tx, { actorId: actor.id, action: `appeal.${decision.toLowerCase()}`, targetType: "Appeal", targetId: id, reason: note, meta: { target: `${appeal.targetType}:${appeal.targetId}` } });
    await notify({ userId: appeal.userId, type: "MODERATION", data: { action: decision === "REVERSED" ? "restore" : "appeal_upheld", target: appeal.targetType.toLowerCase(), reason: note } }, tx);
  });
}
