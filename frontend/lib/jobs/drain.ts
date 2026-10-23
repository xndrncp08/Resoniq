import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { mediaWorkerAvailable } from "@/lib/hosting";
import { requeueStale } from "@/lib/jobs/queue";
import { runOnce } from "@/worker/run";

/**
 * For hosts without a worker (serverless): run due jobs inside a request's
 * spare time. Light jobs (storage deletes, purges, announcement batches) fit
 * comfortably; long media jobs never get queued there in the first place.
 */
export async function drainJobs(budgetMs: number, workerId = `inline:${process.pid}`): Promise<{ ran: number }> {
  const deadline = Date.now() + budgetMs;
  let ran = 0;
  await requeueStale();
  while (Date.now() < deadline) {
    if ((await runOnce(workerId)) === "idle") break;
    ran += 1;
  }
  return { ran };
}

/** After this response, work through queued jobs if no worker will. No-op where a worker runs. */
export function kickJobs(budgetMs = 20_000) {
  if (mediaWorkerAvailable()) return;
  after(() => drainJobs(budgetMs).catch((err) => console.error("[jobs] inline drain failed", err)));
}

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Without a configured secret, nothing gets in. */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}
