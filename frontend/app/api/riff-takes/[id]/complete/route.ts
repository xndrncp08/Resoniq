import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { completeTake } from "@/lib/riffs/service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>("riff-takes.complete", async (_req, { params }) => {
  const actor = await requireActor({ write: true });
  const take = await completeTake(actor.id, (await params).id);
  return NextResponse.json({ id: take.id, status: take.status });
});
