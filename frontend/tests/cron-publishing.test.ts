import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/jobs/drain", () => ({ cronAuthorized: vi.fn(), drainJobs: vi.fn(async () => ({ ran: 0 })) }));
vi.mock("@/lib/media/process", () => ({ sweepMedia: vi.fn(async () => 0) }));
vi.mock("@/lib/tone-drafts", () => ({ publishScheduledTones: vi.fn(async () => ({ published: 2, failures: 0 })) }));
import { cronAuthorized, drainJobs } from "@/lib/jobs/drain";
import { publishScheduledTones } from "@/lib/tone-drafts";
import { GET } from "@/app/api/cron/jobs/route";

beforeEach(() => vi.clearAllMocks());

it("does not publish or drain jobs for an unauthorized cron request", async () => {
  vi.mocked(cronAuthorized).mockReturnValue(false);
  expect((await GET(new Request("http://localhost/api/cron/jobs"), undefined)).status).toBe(404);
  expect(publishScheduledTones).not.toHaveBeenCalled();
  expect(drainJobs).not.toHaveBeenCalled();
});

it("runs scheduled publishing inside the existing authenticated daily cron", async () => {
  vi.mocked(cronAuthorized).mockReturnValue(true);
  const result = await GET(new Request("http://localhost/api/cron/jobs"), undefined);
  expect(result.status).toBe(200);
  expect(await result.json()).toMatchObject({ tones: { published: 2, failures: 0 }, ran: 0 });
  expect(publishScheduledTones).toHaveBeenCalledOnce();
  expect(drainJobs).toHaveBeenCalledWith(expect.any(Number), "cron");
});
