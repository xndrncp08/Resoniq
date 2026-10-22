import { NextResponse } from "next/server";
import { readJson, route } from "@/lib/api";
import { requirePermission } from "@/lib/authz";
import { addSlot, parseSlot } from "@/lib/admin/curation";

export const POST = route("admin.featured.add", async (req) => {
  const actor = await requirePermission("curation.manage");
  return NextResponse.json({ slot: await addSlot(actor, parseSlot(await readJson(req))) }, { status: 201 });
});
