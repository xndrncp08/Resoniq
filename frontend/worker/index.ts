/**
 * The background worker: `npx tsx worker/index.ts` (the `worker` compose service).
 * Runs one job at a time; scale out by running more containers.
 */
import { hostname } from "node:os";
import { requeueStale } from "@/lib/jobs/queue";
import { runOnce } from "./run";

const workerId = `${hostname()}:${process.pid}`;
const IDLE_MS = 2_000;
const STALE_SWEEP_MS = 60_000;
let stopping = false;

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    console.log(`[worker] ${signal}: finishing the current job, then exiting`);
    stopping = true;
  });
}

async function main() {
  console.log(`[worker] ${workerId} started`);
  let lastSweep = 0;
  while (!stopping) {
    try {
      if (Date.now() - lastSweep > STALE_SWEEP_MS) {
        lastSweep = Date.now();
        const requeued = await requeueStale();
        if (requeued) console.log(`[worker] requeued ${requeued} stale job(s)`);
      }
      if ((await runOnce(workerId)) === "idle") await new Promise((r) => setTimeout(r, IDLE_MS));
    } catch (err) {
      // Database hiccup: back off and keep the process alive.
      console.error("[worker] loop error", err);
      await new Promise((r) => setTimeout(r, IDLE_MS * 5));
    }
  }
  process.exit(0);
}

void main();
