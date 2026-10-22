import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { claimNext, completeJob, enqueue, failJob, heartbeatJob, requeueStale, retryJob } from "@/lib/jobs/queue";
import { localStorageDriver } from "@/lib/storage";
import { prisma, resetDb } from "./db";

const root = await mkdtemp(path.join(tmpdir(), "resoniq-jobs-"));
const storage = localStorageDriver(root);
vi.mock("@/lib/storage", async (orig) => ({
  ...(await orig<typeof import("@/lib/storage")>()),
  getStorage: () => storage,
}));
const { runOnce } = await import("@/worker/run");

beforeEach(resetDb);
afterAll(() => rm(root, { recursive: true, force: true }));

describe("job queue", () => {
  it("never hands one job to two workers", async () => {
    await enqueue("storage.delete", { key: "a/b.mp3" });
    const claims = await Promise.all([claimNext("a"), claimNext("b"), claimNext("c")]);
    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  it("skips jobs scheduled in the future", async () => {
    await enqueue("storage.delete", { key: "a/b.mp3" }, { runAt: new Date(Date.now() + 60_000) });
    expect(await claimNext("a")).toBeNull();
  });

  it("retries with backoff, then gives up and keeps the error", async () => {
    const id = await enqueue("storage.delete", { key: "a/b.mp3" }, { maxAttempts: 2 });
    const first = (await claimNext("a"))!;
    await failJob(first, new Error("boom"));
    const queued = await prisma.job.findUniqueOrThrow({ where: { id } });
    expect(queued.status).toBe("QUEUED");
    expect(queued.runAt.getTime()).toBeGreaterThan(Date.now() + 25_000);

    await prisma.job.update({ where: { id }, data: { runAt: new Date() } });
    const second = (await claimNext("a"))!;
    await failJob(second, new Error("boom again"));
    const failed = await prisma.job.findUniqueOrThrow({ where: { id } });
    expect(failed.status).toBe("FAILED");
    expect(failed.lastError).toContain("boom again");

    expect(await retryJob(id)).toBe(true);
    expect((await prisma.job.findUniqueOrThrow({ where: { id } })).status).toBe("QUEUED");
  });

  it("requeues a job whose worker died", async () => {
    const id = await enqueue("storage.delete", { key: "a/b.mp3" });
    await claimNext("dead");
    await prisma.job.update({ where: { id }, data: { lockedAt: new Date(Date.now() - 20 * 60_000) } });
    expect(await requeueStale()).toBe(1);
    expect((await prisma.job.findUniqueOrThrow({ where: { id } })).status).toBe("QUEUED");
  });

  it("runs storage.delete through runOnce", async () => {
    await storage.put("user1/file1.mp3", Buffer.from("ID3"), "audio/mpeg");
    await enqueue("storage.delete", { key: "user1/file1.mp3" });
    expect(await runOnce("w")).toBe("succeeded");
    expect(await readdir(path.join(root, "user1"))).toEqual([]);
    expect(await runOnce("w")).toBe("idle");
  });

  it("renews long-running leases and ignores updates from an old worker", async () => {
    const id = await enqueue("storage.delete", { key: "a/b.mp3" });
    const old = (await claimNext("old"))!;
    await prisma.job.update({ where: { id }, data: { lockedAt: new Date(Date.now() - 20 * 60_000) } });
    await heartbeatJob(id, "old");
    expect(await requeueStale()).toBe(0);
    await prisma.job.update({ where: { id }, data: { lockedAt: new Date(0) } });
    expect(await requeueStale()).toBe(1);
    await claimNext("new");
    await completeJob(id, "old");
    await failJob(old, new Error("late error"));
    expect(await prisma.job.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "RUNNING", lockedBy: "new" });
  });

  it("fails unknown job types instead of crashing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await prisma.job.create({ data: { type: "nope", payload: {} } });
    expect(await runOnce("w")).toBe("failed");
  });
});
