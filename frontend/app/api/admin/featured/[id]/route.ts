import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { requirePermission } from "@/lib/authz";
import { removeSlot } from "@/lib/admin/curation";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = route<Ctx>("admin.featured.remove", async (_req, { params }) => {
  const actor = await requirePermission("curation.manage");
  await removeSlot(actor, (await params).id);
  return NextResponse.json({ ok: true });
});
