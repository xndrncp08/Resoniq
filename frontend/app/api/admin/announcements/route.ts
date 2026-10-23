import { NextResponse } from "next/server";
import { readJson, route } from "@/lib/api";
import { requirePermission } from "@/lib/authz";
import { createAnnouncement, parseAnnouncement } from "@/lib/admin/announcements";
import { kickJobs } from "@/lib/jobs/drain";

export const POST = route("admin.announcements.create", async (req) => {
  const actor = await requirePermission("platform.config");
  const announcement = await createAnnouncement(actor, parseAnnouncement(await readJson(req)));
  kickJobs();
  return NextResponse.json({ announcement }, { status: 201 });
});
