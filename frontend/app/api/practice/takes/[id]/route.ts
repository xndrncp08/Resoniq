import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { deleteTake } from "@/lib/practice-ladder";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = route<Ctx>("practice.takes.delete", async (_req, { params }) => {
  const actor = await requireActor();
  await deleteTake(actor.id, (await params).id);
  return NextResponse.json({ ok: true });
});
