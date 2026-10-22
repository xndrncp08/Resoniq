import type { AnnouncementLevel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { enqueue } from "@/lib/jobs/queue";
import { fail } from "@/lib/validation";

export function parseAnnouncement(body: Record<string, unknown>) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 140) fail("Titles are 1–140 characters.");
  const text = typeof body.body === "string" ? body.body.trim().slice(0, 2000) : "";
  const level = (body.level === "WARN" ? "WARN" : "INFO") as AnnouncementLevel;
  const days = body.days ? Number(body.days) : null;
  if (days !== null && (!Number.isInteger(days) || days < 1 || days > 90)) fail("Show for 1–90 days, or leave blank.");
  return { title, body: text, level, endsAt: days ? new Date(Date.now() + days * 86_400_000) : null, notify: body.notify === true };
}

export async function createAnnouncement(actor: Actor, input: ReturnType<typeof parseAnnouncement>) {
  return prisma.$transaction(async (tx) => {
    const a = await tx.announcement.create({ data: { title: input.title, body: input.body, level: input.level, endsAt: input.endsAt, createdById: actor.id } });
    await recordAudit(tx, { actorId: actor.id, action: "announcement.create", targetType: "Announcement", targetId: a.id, meta: { notify: input.notify } });
    if (input.notify) await enqueue("announcement.notify", { announcementId: a.id }, { db: tx });
    return a;
  });
}

export async function endAnnouncement(actor: Actor, id: string) {
  await prisma.$transaction(async (tx) => {
    await tx.announcement.update({ where: { id }, data: { endsAt: new Date() } });
    await recordAudit(tx, { actorId: actor.id, action: "announcement.end", targetType: "Announcement", targetId: id });
  });
}

export async function currentAnnouncement() {
  const now = new Date();
  return prisma.announcement.findFirst({ where: { startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] }, orderBy: { startsAt: "desc" } });
}

const BATCH = 1000;

/** Job handler: one batch of notifications per run, re-enqueueing itself until every active account has one. */
export async function fanOutAnnouncement({ announcementId, afterId }: { announcementId: string; afterId?: string }) {
  const a = await prisma.announcement.findUnique({ where: { id: announcementId } });
  if (!a) return;
  // Skips anyone already notified, so a retried batch doesn't double up.
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE", ...(afterId && { id: { gt: afterId } }), notifications: { none: { type: "ANNOUNCEMENT", data: { path: ["announcementId"], equals: announcementId } } } }, orderBy: { id: "asc" }, take: BATCH, select: { id: true } });
  if (!users.length) return;
  await prisma.notification.createMany({ data: users.map((u) => ({ userId: u.id, type: "ANNOUNCEMENT" as const, data: { title: a.title, announcementId: a.id } })) });
  if (users.length === BATCH) await enqueue("announcement.notify", { announcementId, afterId: users[users.length - 1].id });
}
