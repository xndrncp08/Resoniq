import { NextResponse } from "next/server";
import type { ReportTarget } from "@prisma/client";
import { ApiError, readJson, route } from "@/lib/api";
import { requirePermission } from "@/lib/authz";
import { dismissReports } from "@/lib/admin/queue";
import { REPORT_TARGETS } from "@/lib/reports";

/** { action: "dismiss", targetType, targetId, note } — actioning happens through the moderation endpoints, which close reports too. */
export const POST = route("admin.reports", async (req) => {
  const actor = await requirePermission("content.moderate");
  const body = await readJson(req);
  if (body.action !== "dismiss" || !REPORT_TARGETS.includes(body.targetType as ReportTarget) || typeof body.targetId !== "string") throw new ApiError(400, "Invalid request.");
  await dismissReports(actor, body.targetType as ReportTarget, body.targetId, typeof body.note === "string" ? body.note.slice(0, 500) : "");
  return NextResponse.json({ ok: true });
});
