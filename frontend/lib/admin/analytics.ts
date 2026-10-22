import { prisma } from "@/lib/prisma";

export type Series = { day: string; value: number }[];

/**
 * Daily counts for the last `days` days (UTC), zero-filled. `table` and
 * `column` come from the fixed whitelist below, never from input.
 */
const SOURCES = {
  signups: `SELECT date_trunc('day', "createdAt") d, COUNT(*)::int n FROM "User" WHERE "createdAt" >= $1 GROUP BY 1`,
  posts: `SELECT date_trunc('day', "createdAt") d, COUNT(*)::int n FROM "Post" WHERE "createdAt" >= $1 AND status <> 'DELETED' GROUP BY 1`,
  comments: `SELECT date_trunc('day', "createdAt") d, COUNT(*)::int n FROM "Comment" WHERE "createdAt" >= $1 AND status <> 'DELETED' GROUP BY 1`,
  uploads: `SELECT date_trunc('day', "createdAt") d, COUNT(*)::int n FROM "Media" WHERE "createdAt" >= $1 GROUP BY 1`,
  uploadMB: `SELECT date_trunc('day', "createdAt") d, (SUM("sizeBytes") / 1048576)::int n FROM "Media" WHERE "createdAt" >= $1 GROUP BY 1`,
  tones: `SELECT date_trunc('day', "createdAt") d, COUNT(*)::int n FROM "Tone" WHERE "createdAt" >= $1 GROUP BY 1`,
  joins: `SELECT date_trunc('day', "joinedAt") d, COUNT(*)::int n FROM "CommunityMember" WHERE "joinedAt" >= $1 GROUP BY 1`,
  active: `SELECT d, COUNT(DISTINCT a)::int n FROM (
             SELECT date_trunc('day', "createdAt") d, "authorId" a FROM "Post" WHERE "createdAt" >= $1
             UNION ALL SELECT date_trunc('day', "createdAt"), "authorId" FROM "Comment" WHERE "createdAt" >= $1
             UNION ALL SELECT date_trunc('day', "createdAt"), "userId" FROM "PostVote" WHERE "createdAt" >= $1
           ) x GROUP BY 1`,
  reports: `SELECT date_trunc('day', "createdAt") d, COUNT(*)::int n FROM "Report" WHERE "createdAt" >= $1 GROUP BY 1`,
} as const;
export type Metric = keyof typeof SOURCES;

export async function dailySeries(metric: Metric, days = 30, now = new Date()): Promise<Series> {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)));
  const rows = await prisma.$queryRawUnsafe<{ d: Date; n: number }[]>(SOURCES[metric], start);
  const byDay = new Map(rows.map((r) => [r.d.toISOString().slice(0, 10), Number(r.n)]));
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    return { day, value: byDay.get(day) ?? 0 };
  });
}

export async function overview() {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [users, newUsers, suspended, banned, posts, held, tones, publicTones, communities, openReports, openAppeals, mediaBytes, failedJobs, processing] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.user.count({ where: { status: "SUSPENDED" } }),
    prisma.user.count({ where: { status: "BANNED" } }),
    prisma.post.count({ where: { status: "PUBLISHED" } }),
    prisma.post.count({ where: { status: "HELD" } }),
    prisma.tone.count(),
    prisma.tone.count({ where: { visibility: "PUBLIC" } }),
    prisma.community.count({ where: { archivedAt: null } }),
    prisma.report.count({ where: { status: "OPEN" } }),
    prisma.appeal.count({ where: { status: "OPEN" } }),
    prisma.media.aggregate({ where: { status: { in: ["READY", "PROCESSING"] } }, _sum: { sizeBytes: true } }),
    prisma.job.count({ where: { status: "FAILED" } }),
    prisma.media.count({ where: { status: "PROCESSING" } }),
  ]);
  return { users, newUsers, suspended, banned, posts, held, tones, publicTones, communities, openReports, openAppeals, mediaBytes: mediaBytes._sum.sizeBytes ?? 0, failedJobs, processing };
}

export async function systemHealth() {
  const t0 = Date.now();
  let db: { ok: boolean; ms: number } = { ok: false, ms: 0 };
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = { ok: true, ms: Date.now() - t0 };
  } catch {
    db = { ok: false, ms: Date.now() - t0 };
  }
  let engine: { ok: boolean; ms: number; configured: boolean } = { ok: false, ms: 0, configured: !!process.env.PYTHON_ENGINE_URL };
  if (engine.configured) {
    const t1 = Date.now();
    try {
      const res = await fetch(`${process.env.PYTHON_ENGINE_URL}/health`, { signal: AbortSignal.timeout(3000) });
      engine = { ok: res.ok, ms: Date.now() - t1, configured: true };
    } catch {
      engine = { ok: false, ms: Date.now() - t1, configured: true };
    }
  }
  const [byStatus, byType, lastFinished, running, failed] = await Promise.all([
    prisma.job.groupBy({ by: ["status"], _count: true }),
    prisma.job.groupBy({ by: ["type", "status"], _count: true }),
    prisma.job.findFirst({ where: { finishedAt: { not: null } }, orderBy: { finishedAt: "desc" }, select: { finishedAt: true, lockedBy: true } }),
    prisma.job.findMany({ where: { status: "RUNNING" }, orderBy: { lockedAt: "asc" }, take: 20 }),
    prisma.job.findMany({ where: { status: "FAILED" }, orderBy: { finishedAt: "desc" }, take: 50 }),
  ]);
  const queued = await prisma.job.findFirst({ where: { status: "QUEUED", runAt: { lte: new Date() } }, orderBy: { runAt: "asc" }, select: { runAt: true } });
  return {
    db,
    engine,
    storage: process.env.RESONIQ_STORAGE ?? (process.env.SUPABASE_URL ? "supabase" : "local"),
    jobs: { byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])), byType, running, failed, lastFinishedAt: lastFinished?.finishedAt ?? null, oldestDueAt: queued?.runAt ?? null },
  };
}
