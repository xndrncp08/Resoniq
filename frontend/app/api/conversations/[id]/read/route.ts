import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { markRead } from "@/lib/messaging";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>("conversations.read", async (_req, { params }) => {
  const actor = await requireActor();
  await markRead(actor.id, (await params).id);
  return NextResponse.json({ ok: true });
});
