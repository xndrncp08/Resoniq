import { prisma } from "@/lib/prisma";

/**
 * Lightweight presence: "this person is looking at <scope>, at <detail>".
 * Writes are throttled (a heartbeat that changes nothing within `minWriteMs`
 * is skipped), so frequent polls don't mean frequent writes.
 */
export async function heartbeat(scope: string, userId: string, detail: string | null, { minWriteMs = 8000, now = new Date() } = {}) {
  const row = await prisma.presence.findUnique({ where: { scope_userId: { scope, userId } }, select: { detail: true, lastSeenAt: true } });
  if (row && row.detail === detail && now.getTime() - row.lastSeenAt.getTime() < minWriteMs) return false;
  await prisma.presence.upsert({ where: { scope_userId: { scope, userId } }, create: { scope, userId, detail, lastSeenAt: now }, update: { detail, lastSeenAt: now } });
  return true;
}

export async function present(scope: string, { withinMs = 20_000, now = Date.now() } = {}) {
  return prisma.presence.findMany({ where: { scope, lastSeenAt: { gt: new Date(now - withinMs) } }, select: { userId: true, detail: true } });
}
