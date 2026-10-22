import { getStorage } from "@/lib/storage";
import type { JobPayloads, JobType } from "@/lib/jobs/queue";

/** What each job type does. Handlers must be safe to run twice (a job can be retried after a crash). */
export const handlers: { [K in JobType]: (payload: JobPayloads[K]) => Promise<void> } = {
  "storage.delete": async ({ key }) => {
    await getStorage().remove(key);
  },
};
