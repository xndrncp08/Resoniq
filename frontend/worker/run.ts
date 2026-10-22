import { handlers } from "@/lib/jobs/handlers";
import { claimNext, completeJob, failJob, type JobType } from "@/lib/jobs/queue";

export type RunResult = "idle" | "succeeded" | "failed";

/** Claims and runs at most one job. */
export async function runOnce(workerId: string): Promise<RunResult> {
  const job = await claimNext(workerId);
  if (!job) return "idle";
  const started = Date.now();
  try {
    const handler = handlers[job.type as JobType] as ((payload: unknown) => Promise<void>) | undefined;
    if (!handler) throw new Error(`Unknown job type: ${job.type}`);
    await handler(job.payload);
    await completeJob(job.id);
    console.log(`[worker] ${job.id} ${job.type} succeeded in ${Date.now() - started}ms`);
    return "succeeded";
  } catch (err) {
    await failJob(job, err);
    console.error(`[worker] ${job.id} ${job.type} failed (attempt ${job.attempts}/${job.maxAttempts})`, err);
    return "failed";
  }
}
