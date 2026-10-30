import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { listRevisions } from "@/lib/canvas/service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>("canvases.revisions", async (_req, { params }) => {
  const actor = await requireActor();
  return NextResponse.json({ revisions: await listRevisions(actor.id, (await params).id) });
});
