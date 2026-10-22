import type { Job, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * A Postgres-backed job queue. Producers insert rows (inside their own
 * transaction when the job must exist only if their change commits); the
 * worker service claims one at a time with FOR UPDATE SKIP LOCKED, so any
 * number of workers can run without handing the same job out twice.
 */

/** Every job type and its payload. Handlers live in lib/jobs/handlers.ts. */
export type JobPayloads = {
  "storage.delete": { key: string };
  /** Probe, validate and transcode an upload (worker/media.ts). */
  "media.process": { mediaId: string };
  /** Delete a removed upload's files and row. */
  "media.purge": { mediaId: string };
  /** Fan an announcement out to every active account as a notification. */
  "announcement.notify": { announcementId: string; afterId?: string };
};
export type JobType = keyof JobPayloads;

export async function enqueue<T extends JobType>(
  type: T,
  payload: JobPayloads[T],
  opts: { db?: Prisma.TransactionClient; runAt?: Date; maxAttempts?: number } = {},
): Promise<string> {
  const job = await (opts.db ?? prisma).job.create({
    data: { type, payload, runAt: opts.runAt, maxAttempts: opts.maxAttempts },
    select: { id: true },
  });
  return job.id;
}

export async function claimNext(workerId: string): Promise<Job | null> {
  // Prisma stores UTC in timestamp-without-time-zone columns, so compare against UTC, not the session's zone.
  const rows = await prisma.$queryRaw<Job[]>`
    UPDATE "Job" SET status = 'RUNNING', "lockedAt" = (now() AT TIME ZONE 'UTC'), "lockedBy" = ${workerId}, attempts = attempts + 1
    WHERE id = (
      SELECT id FROM "Job" WHERE status = 'QUEUED' AND "runAt" <= (now() AT TIME ZONE 'UTC')
      ORDER BY "runAt" FOR UPDATE SKIP LOCKED LIMIT 1
    )
    RETURNING *`;
  return rows[0] ?? null;
}

export async function completeJob(id: string): Promise<void> {
  await prisma.job.update({
    where: { id },
    data: { status: "SUCCEEDED", finishedAt: new Date(), lockedAt: null, lockedBy: null },
  });
}

/** 30s, 60s, 120s … capped at an hour. `attempts` counts the one that just failed. */
export function backoffMs(attempts: number): number {
  return Math.min(30_000 * 2 ** (attempts - 1), 3_600_000);
}

export async function failJob(job: Pick<Job, "id" | "attempts" | "maxAttempts">, err: unknown, now = new Date()) {
  const lastError = (err instanceof Error ? err.stack ?? err.message : String(err)).slice(0, 2000);
  const done = job.attempts >= job.maxAttempts;
  await prisma.job.update({
    where: { id: job.id },
    data: done
      ? { status: "FAILED", finishedAt: now, lastError, lockedAt: null, lockedBy: null }
      : { status: "QUEUED", runAt: new Date(now.getTime() + backoffMs(job.attempts)), lastError, lockedAt: null, lockedBy: null },
  });
}

/** Puts jobs whose worker died mid-run back on the queue. */
export async function requeueStale(staleMs = 15 * 60_000): Promise<number> {
  const { count } = await prisma.job.updateMany({
    where: { status: "RUNNING", lockedAt: { lt: new Date(Date.now() - staleMs) } },
    data: { status: "QUEUED", lockedAt: null, lockedBy: null },
  });
  return count;
}

/** Admin "retry": a failed job gets a fresh set of attempts. */
export async function retryJob(id: string): Promise<boolean> {
  const { count } = await prisma.job.updateMany({
    where: { id, status: "FAILED" },
    data: { status: "QUEUED", attempts: 0, runAt: new Date(), finishedAt: null },
  });
  return count === 1;
}
