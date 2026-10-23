import { NextResponse } from "next/server";
import { ApiError, route } from "@/lib/api";
import { cronAuthorized, drainJobs } from "@/lib/jobs/drain";
import { sweepMedia } from "@/lib/media/process";

export const maxDuration = 60;

/** Scheduled catch-up for hosts without a worker (see vercel.json): due jobs plus abandoned-upload cleanup. */
export const GET = route("cron.jobs", async (req) => {
  if (!cronAuthorized(req)) throw new ApiError(404, "Not found.");
  const swept = await sweepMedia();
  const { ran } = await drainJobs(50_000, "cron");
  return NextResponse.json({ ran, swept });
});
