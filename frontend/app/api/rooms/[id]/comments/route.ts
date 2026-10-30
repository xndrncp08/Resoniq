import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { commentInRoom } from "@/lib/rooms/service";

type Ctx = { params: Promise<{ id: string }> };

/** Body: { atSec, body? | emoji? } */
export const POST = route<Ctx>("rooms.comment", async (req, { params }) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("room-write", actor.id, RATE_LIMITS.roomWrite);
  await commentInRoom(actor.id, (await params).id, await readJson(req));
  return NextResponse.json({ ok: true }, { status: 201 });
});
