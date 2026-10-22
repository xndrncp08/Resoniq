import { getStorage } from "@/lib/storage";
import type { JobPayloads, JobType } from "@/lib/jobs/queue";
import { processMedia, purgeMedia } from "@/lib/media/process";

/** What each job type does. Handlers must be safe to run twice (a job can be retried after a crash). */
export const handlers: { [K in JobType]: (payload: JobPayloads[K]) => Promise<void> } = {
  "storage.delete": async ({ key }) => {
    await getStorage().remove(key);
  },
  "media.process": ({ mediaId }) => processMedia(mediaId),
  "media.purge": ({ mediaId }) => purgeMedia(mediaId),
};
