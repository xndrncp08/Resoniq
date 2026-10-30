import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { listVersions } from "@/lib/tone-versions";

type Ctx = { params: Promise<{ id: string }> };

/** The owner's version history for a tone, newest first. */
export const GET = route<Ctx>("tones.versions", async (_req, { params }) => {
  const actor = await requireActor();
  return NextResponse.json({ versions: await listVersions(actor.id, (await params).id) });
});
