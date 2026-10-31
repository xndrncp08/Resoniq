import type { CreditStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { fail } from "@/lib/validation";
import { notify } from "@/lib/notify";

/**
 * Credits on releases need the credited musician's consent. The author's own
 * credit stands; anyone else is notified and the release appears on their
 * profile only once they confirm. Disputing removes the credit from the post
 * (the author sees the reason) so no one is attributed against their will.
 */

export type CreditView = { userId: string; handle: string; name: string | null; role: string; status: CreditStatus; note: string | null };

/** Inside the publish transaction: one row per person (roles merged), the author's confirmed. Returns who to notify. */
export async function recordCredits(tx: Prisma.TransactionClient, postId: string, authorId: string, credits: { userId: string; role: string }[]) {
  const byUser = new Map<string, string[]>();
  for (const c of credits) byUser.set(c.userId, [...new Set([...(byUser.get(c.userId) ?? []), c.role])]);
  const now = new Date();
  for (const [userId, roles] of byUser) {
    const mine = userId === authorId;
    await tx.releaseCredit.create({ data: { postId, userId, role: roles.join(", ").slice(0, 120), status: mine ? "CONFIRMED" : "PENDING", respondedAt: mine ? now : null } });
  }
  await syncCreditIds(tx, postId);
  return [...byUser.keys()].filter((id) => id !== authorId);
}

/** Profiles list a release for confirmed credits only. */
async function syncCreditIds(tx: Prisma.TransactionClient, postId: string) {
  const confirmed = await tx.releaseCredit.findMany({ where: { postId, status: "CONFIRMED" }, select: { userId: true } });
  await tx.post.update({ where: { id: postId }, data: { creditUserIds: confirmed.map((c) => c.userId) } });
}

export async function notifyCredited(postId: string, authorId: string, userIds: string[]) {
  if (userIds.length) await notify(userIds.map((userId) => ({ userId, type: "CREDIT_ADDED" as const, actorId: authorId, postId })));
}

/** The credited musician confirms, or disputes with an optional reason; they can change their answer later. */
export async function respondToCredit(userId: string, postId: string, body: Record<string, unknown>) {
  const action = body.action;
  if (action !== "confirm" && action !== "dispute") fail("action must be confirm or dispute.");
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) || null : null;
  const credit = await prisma.releaseCredit.findUnique({ where: { postId_userId: { postId, userId } }, select: { role: true, post: { select: { authorId: true, status: true } } } });
  if (!credit || credit.post.status === "DELETED") throw new ApiError(404, "Credit not found.");
  if (credit.post.authorId === userId) fail("Your own credit on your release doesn't need confirming.");
  const status: CreditStatus = action === "confirm" ? "CONFIRMED" : "DISPUTED";
  await prisma.$transaction(async (tx) => {
    await tx.releaseCredit.update({ where: { postId_userId: { postId, userId } }, data: { status, note: status === "DISPUTED" ? note : null, respondedAt: new Date() } });
    await syncCreditIds(tx, postId);
  });
  await notify({ userId: credit.post.authorId, type: "CREDIT_RESPONSE", actorId: userId, postId, data: { status, role: credit.role, ...(status === "DISPUTED" && note && { note }) } });
  return status;
}

/** Credits as a viewer may see them: disputed ones only to the author (with the reason). */
export function creditViews(rows: { userId: string; role: string; status: CreditStatus; note: string | null; user: { handle: string; name: string | null } }[], authorId: string, viewerId: string | null): CreditView[] {
  const isAuthor = viewerId === authorId;
  return rows
    .filter((c) => c.status !== "DISPUTED" || isAuthor)
    .map((c) => ({ userId: c.userId, handle: c.user.handle, name: c.user.name, role: c.role, status: c.status, note: isAuthor ? c.note : null }));
}

/**
 * Tell people about a release once it is actually public: credited musicians get
 * CREDIT_ADDED (so they can confirm or dispute) and followers get NEW_RELEASE.
 *
 * A post can become public in three places: at creation, when a moderator approves
 * a held post, and when its media finishes processing. All three call this, and it
 * sends at most once per post (a post that was already announced, then held after an
 * edit and approved again, stays quiet).
 */
export async function announceRelease(postId: string) {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, authorId: true, category: true, communityId: true, status: true } });
  if (!post || post.status !== "PUBLISHED" || post.category !== "ORIGINAL") return;
  if (await prisma.notification.count({ where: { postId, type: { in: ["CREDIT_ADDED", "NEW_RELEASE"] } } })) return;
  const credited = (await prisma.releaseCredit.findMany({ where: { postId, userId: { not: post.authorId } }, select: { userId: true } })).map((c) => c.userId);
  await notifyCredited(postId, post.authorId, credited);
  // Posts inside a community stay inside it; credited people already have their own notice.
  if (post.communityId) return;
  // shortcut: newest 2000 followers in one insert; queue it through the jobs table if an artist outgrows that.
  const followers = await prisma.follow.findMany({ where: { followingId: post.authorId, followerId: { notIn: credited } }, orderBy: { createdAt: "desc" }, take: 2000, select: { followerId: true } });
  await notify(followers.map((f) => ({ userId: f.followerId, type: "NEW_RELEASE" as const, actorId: post.authorId, postId })));
}
