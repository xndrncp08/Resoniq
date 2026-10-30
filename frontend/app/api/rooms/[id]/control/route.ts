import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { controlRoom, parseControl } from "@/lib/rooms/service";

type Ctx = { params: Promise<{ id: string }> };

/** Body: { action: play|pause|seek|load, positionSec?, takeId? } */
export const POST = route<Ctx>("rooms.control", async (req, { params }) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("room-write", actor.id, RATE_LIMITS.roomWrite);
  await controlRoom(actor.id, (await params).id, parseControl(await readJson(req)));
  return NextResponse.json({ ok: true });
});
