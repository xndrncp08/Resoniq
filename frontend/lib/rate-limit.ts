/**
 * Fixed-window rate limiting, in memory.
 *
 * Counters live in this process only: with several server instances each
 * one enforces its own budget (so the effective limit is N x the number of
 * instances), and a restart resets them. Good enough for a single instance;
 * a shared store (Redis, Upstash, the database) is needed beyond that.
 * See SECURITY.md.
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
  // Autosave is debounced client-side; this only stops a runaway client.
  workspaceWrite: { limit: 60, windowMs: 60_000 },
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
    w = { count: 0, resetAt: now + rule.windowMs };
    windows.set(id, w);
  }
  w.count += 1;
  if (w.count > rule.limit) {
    return { ok: false, retryAfterS: Math.max(1, Math.ceil((w.resetAt - now) / 1000)) };
  }
  return { ok: true };
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
