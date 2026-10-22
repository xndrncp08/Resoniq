import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { fileReport, parseReport } from "@/lib/reports";
import { RATE_LIMITS } from "@/lib/rate-limit";

export const POST = route("reports.create", async (req) => {
  // Suspended users can still report: it's a safety tool, not participation.
  const actor = await requireActor();
  enforceRateLimit("report", actor.id, RATE_LIMITS.report);
  await fileReport(actor, parseReport(await readJson(req)));
  return NextResponse.json({ ok: true }, { status: 201 });
});
