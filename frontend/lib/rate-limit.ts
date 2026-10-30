/**
 * Fixed-window rate limiting with two stores:
 *
 *  - memory: counters live in this process. Fine for one long-running server
 *    (Docker, `next start`); with several instances each enforces its own
 *    budget and a restart resets them.
 *  - postgres: one atomic upsert per check in RateLimitBucket, shared by
 *    every instance. Used on serverless hosts, where instances come and go.
 *
 * RESONIQ_RATE_LIMIT_STORE picks one; unset, Vercel gets postgres and
 * everything else memory. See SECURITY.md.
 */

type Window = { count: number; resetAt: number };

export type RateLimitRule = { limit: number; windowMs: number };

export const RATE_LIMITS = {
  register: { limit: 5, windowMs: 15 * 60_000 },
  signIn: { limit: 10, windowMs: 15 * 60_000 },
  upload: { limit: 10, windowMs: 60 * 60_000 },
  analyze: { limit: 20, windowMs: 60 * 60_000 },
  toneRead: { limit: 120, windowMs: 60_000 },
  toneWrite: { limit: 60, windowMs: 60_000 },
  setlistWrite: { limit: 120, windowMs: 60_000 },
  profileWrite: { limit: 20, windowMs: 60 * 60_000 },
  follow: { limit: 120, windowMs: 60 * 60_000 },
  socialRead: { limit: 240, windowMs: 60_000 },
  postWrite: { limit: 30, windowMs: 60 * 60_000 },
  commentWrite: { limit: 120, windowMs: 60 * 60_000 },
  vote: { limit: 600, windowMs: 60 * 60_000 },
  report: { limit: 20, windowMs: 60 * 60_000 },
  clientError: { limit: 30, windowMs: 10 * 60_000 },
  // Messaging: replies flow freely, but opening new conversations and sending invites is slower (spam).
  messageWrite: { limit: 120, windowMs: 10 * 60_000 },
  conversationStart: { limit: 25, windowMs: 24 * 60 * 60_000 },
  invite: { limit: 15, windowMs: 24 * 60 * 60_000 },
  messageRead: { limit: 600, windowMs: 60_000 },
  communityCreate: { limit: 5, windowMs: 24 * 60 * 60_000 },
  moderation: { limit: 600, windowMs: 60 * 60_000 },
  mediaUpload: { limit: 60, windowMs: 60 * 60_000 },
  mediaRead: { limit: 1200, windowMs: 60_000 },
  emailSend: { limit: 5, windowMs: 60 * 60_000 },
  tokenUse: { limit: 20, windowMs: 15 * 60_000 },
  practiceWrite: { limit: 240, windowMs: 60 * 60_000 },
} satisfies Record<string, RateLimitRule>;

const MAX_KEYS = 10_000;
const windows = new Map<string, Window>();

function sweep(now: number) {
  for (const [key, w] of windows) if (w.resetAt <= now) windows.delete(key);
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterS: number };

export function rateLimit(bucket: string, key: string, rule: RateLimitRule, now = Date.now()): RateLimitResult {
  const id = `${bucket}:${key}`;
  let w = windows.get(id);
  if (!w || w.resetAt <= now) {
    if (windows.size >= MAX_KEYS) sweep(now);
    // Keep live budgets intact under a flood of distinct keys; never evict them to make room.
    if (!windows.has(id) && windows.size >= MAX_KEYS) return { ok: false, retryAfterS: 60 };
    w = { count: 0, resetAt: now + rule.windowMs };
    windows.set(id, w);
  }
  w.count += 1;
  if (w.count > rule.limit) {
    return { ok: false, retryAfterS: Math.max(1, Math.ceil((w.resetAt - now) / 1000)) };
  }
  return { ok: true };
}

export const rateLimitStore = (): "memory" | "postgres" =>
  (process.env.RESONIQ_RATE_LIMIT_STORE ?? (process.env.VERCEL ? "postgres" : "memory")) === "postgres" ? "postgres" : "memory";

/** Bucket ids contain client IPs; the daily cron guarantees expired ones go even when traffic is too low for the sampled cleanup. */
export async function purgeExpiredRateLimits(now = Date.now()) {
  const { prisma } = await import("@/lib/prisma");
  return (await prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: BigInt(now) } } })).count;
}

/** The shared-store version of rateLimit(): one round trip, atomic under concurrency. */
export async function rateLimitShared(bucket: string, key: string, rule: RateLimitRule, now = Date.now()): Promise<RateLimitResult> {
  const id = `${bucket}:${key}`.slice(0, 300);
  const resetAt = BigInt(now + rule.windowMs);
  const nowMs = BigInt(now);
  // Imported lazily so the in-memory store never loads the database client.
  const { prisma } = await import("@/lib/prisma");
  const [row] = await prisma.$queryRaw<{ count: number; resetAt: bigint }[]>`
    INSERT INTO "RateLimitBucket" (id, count, "resetAt") VALUES (${id}, 1, ${resetAt})
    ON CONFLICT (id) DO UPDATE SET
      count = CASE WHEN "RateLimitBucket"."resetAt" <= ${nowMs} THEN 1 ELSE "RateLimitBucket".count + 1 END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= ${nowMs} THEN EXCLUDED."resetAt" ELSE "RateLimitBucket"."resetAt" END
    RETURNING count, "resetAt"`;
  // Expired rows are garbage; sweep them now and then rather than on every call.
  if (Math.random() < 0.01) await prisma.$executeRaw`DELETE FROM "RateLimitBucket" WHERE "resetAt" < ${nowMs}`;
  if (row.count > rule.limit) return { ok: false, retryAfterS: Math.max(1, Math.ceil((Number(row.resetAt) - now) / 1000)) };
  return { ok: true };
}

/** Checks a budget in whichever store this deployment uses. */
export function checkRateLimit(bucket: string, key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  return rateLimitStore() === "postgres" ? rateLimitShared(bucket, key, rule) : Promise.resolve(rateLimit(bucket, key, rule));
}

/** For tests. */
export function resetRateLimits() {
  windows.clear();
}

/**
 * Best-effort client IP: the rightmost x-forwarded-for entry, i.e. the one
 * added by the nearest proxy (or by Next itself, which fills the header
 * from the socket when it is absent). Entries further left are whatever the
 * client sent. Served directly with no proxy, a client that sends its own
 * header can still pick its key, so production should sit behind a proxy
 * that sets x-forwarded-for. See SECURITY.md.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",").pop()?.trim();
  return forwarded || req.headers.get("x-real-ip")?.trim() || "unknown";
}
