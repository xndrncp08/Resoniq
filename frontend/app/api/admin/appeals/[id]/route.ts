import { NextResponse } from "next/server";
import { readJson, route } from "@/lib/api";
import { requirePermission } from "@/lib/authz";
import { decideAppeal, parseDecision } from "@/lib/admin/queue";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>("admin.appeals.decide", async (req, { params }) => {
  const actor = await requirePermission("content.moderate");
  await decideAppeal(actor, (await params).id, parseDecision(await readJson(req)));
  return NextResponse.json({ ok: true });
});
