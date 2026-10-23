import { beforeEach, describe, expect, it } from "vitest";
import { purgeExpiredRateLimits, rateLimitShared } from "@/lib/rate-limit";
import { prisma, resetDb } from "./db";

beforeEach(resetDb);

describe("shared rate limit store", () => {
  it("counts exactly under concurrency across callers and resets after the window", async () => {
    const rule = { limit: 5, windowMs: 60_000 };
    const now = Date.now();
    const results = await Promise.all(Array.from({ length: 12 }, () => rateLimitShared("t", "k", rule, now)));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    const denied = results.find((r) => !r.ok);
    expect(denied && !denied.ok && denied.retryAfterS).toBe(60);
    expect((await prisma.rateLimitBucket.findUniqueOrThrow({ where: { id: "t:k" } })).count).toBe(12);
    // A new window starts fresh.
    expect((await rateLimitShared("t", "k", rule, now + 61_000)).ok).toBe(true);
    expect((await prisma.rateLimitBucket.findUniqueOrThrow({ where: { id: "t:k" } })).count).toBe(1);
    // Keys don't share budgets.
    expect((await rateLimitShared("t", "other", rule, now)).ok).toBe(true);
  });
  it("purges only expired buckets, so client IPs aren't kept past their window", async () => {
    const now = Date.now();
    await rateLimitShared("old", "203.0.113.9", { limit: 5, windowMs: 1_000 }, now - 10_000);
    await rateLimitShared("live", "203.0.113.9", { limit: 5, windowMs: 60_000 }, now);
    expect(await purgeExpiredRateLimits(now)).toBe(1);
    expect((await prisma.rateLimitBucket.findMany()).map((b) => b.id)).toEqual(["live:203.0.113.9"]);
  });
});
