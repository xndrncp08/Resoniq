import { NextResponse } from "next/server";
import { ApiError, route } from "@/lib/api";
import { cronAuthorized, drainJobs } from "@/lib/jobs/drain";
import { sweepMedia } from "@/lib/media/process";
import { publishScheduledTones } from "@/lib/tone-drafts";

export const maxDuration = 60;

/** Scheduled catch-up for hosts without a worker (see vercel.json): due jobs plus abandoned-upload cleanup. */
export const GET = route("cron.jobs", async (req) => {
  if (!cronAuthorized(req)) throw new ApiError(404, "Not found.");
  const start = Date.now();
  const tones = await publishScheduledTones();
  const swept = await sweepMedia();
  const { ran } = await drainJobs(Math.max(0, 50_000 - (Date.now() - start)), "cron");
  return NextResponse.json({ ran, swept, tones });
});
