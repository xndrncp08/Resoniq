import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { parseTakeStart, startTake } from "@/lib/riffs/service";

type Ctx = { params: Promise<{ id: string }> };

/** Body: { size, mime, durationSec?, peaks?, label? }. Returns where to PUT the bytes, then POST /api/riff-takes/[id]/complete. */
export const POST = route<Ctx>("riffs.takes.start", async (req, { params }) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("riff-write", actor.id, RATE_LIMITS.riffWrite);
  return NextResponse.json(await startTake(actor.id, (await params).id, parseTakeStart(await readJson(req, 32 * 1024))), { status: 201 });
});
