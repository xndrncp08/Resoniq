import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { requirePermission } from "@/lib/authz";
import { endAnnouncement } from "@/lib/admin/announcements";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = route<Ctx>("admin.announcements.end", async (_req, { params }) => {
  const actor = await requirePermission("platform.config");
  await endAnnouncement(actor, (await params).id);
  return NextResponse.json({ ok: true });
});
