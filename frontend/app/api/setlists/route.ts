import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { createSetlist, listSetlists, parseSetlist } from "@/lib/setlists";

export const GET = route("setlists.list", async () => {
  const actor = await requireActor();
  return NextResponse.json({ setlists: await listSetlists(actor.id) });
});

export const POST = route("setlists.create", async (req) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("setlist-write", actor.id, RATE_LIMITS.setlistWrite);
  return NextResponse.json({ setlist: await createSetlist(actor.id, parseSetlist(await readJson(req, 128 * 1024))) }, { status: 201 });
});
