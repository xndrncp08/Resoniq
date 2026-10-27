import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { deleteMessage } from "@/lib/messaging";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = route<Ctx>("messages.delete", async (_req, { params }) => {
  const actor = await requireActor({ write: true });
  await deleteMessage(actor, (await params).id);
  return NextResponse.json({ ok: true });
});
