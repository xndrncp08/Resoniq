import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { updateRoom } from "@/lib/rooms/service";

type Ctx = { params: Promise<{ id: string }> };

/** Host: { anyoneControls?, end? } */
export const PATCH = route<Ctx>("rooms.update", async (req, { params }) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("room-write", actor.id, RATE_LIMITS.roomWrite);
  await updateRoom(actor.id, (await params).id, await readJson(req));
  return NextResponse.json({ ok: true });
});
