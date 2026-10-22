import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, route } from "@/lib/api";
import { requirePermission } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { retryJob } from "@/lib/jobs/queue";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>("admin.jobs.retry", async (_req, { params }) => {
  const actor = await requirePermission("system.view");
  const { id } = await params;
  if (!(await retryJob(id))) throw new ApiError(404, "Only failed jobs can be retried.");
  // A media job retried after its file failed processing needs the media back in PROCESSING.
  const job = await prisma.job.findUnique({ where: { id } });
  if (job?.type === "media.process") {
    await prisma.media.updateMany({ where: { id: (job.payload as { mediaId: string }).mediaId, status: "FAILED" }, data: { status: "PROCESSING", error: null } });
  }
  await recordAudit(prisma, { actorId: actor.id, action: "job.retry", targetType: "Job", targetId: id });
  return NextResponse.json({ ok: true });
});
