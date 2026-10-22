import { NextResponse } from "next/server";
import { readJson, route } from "@/lib/api";
import { requirePermission } from "@/lib/authz";
import { createAnnouncement, parseAnnouncement } from "@/lib/admin/announcements";

export const POST = route("admin.announcements.create", async (req) => {
  const actor = await requirePermission("platform.config");
  return NextResponse.json({ announcement: await createAnnouncement(actor, parseAnnouncement(await readJson(req))) }, { status: 201 });
});
