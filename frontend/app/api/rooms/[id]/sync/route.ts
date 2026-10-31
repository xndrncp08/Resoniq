import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { syncRoom } from "@/lib/rooms/service";

type Ctx = { params: Promise<{ id: string }> };

/** The listener's heartbeat and poll. Body: { since?: ISO time of the last comment seen, knownVersion?: the room version already held }. */
export const POST = route<Ctx>("rooms.sync", async (req, { params }) => {
  const actor = await requireActor();
  await enforceRateLimit("room-sync", actor.id, RATE_LIMITS.roomSync);
  const { since, knownVersion } = await readJson(req);
  const at = typeof since === "string" && !Number.isNaN(Date.parse(since)) ? new Date(since) : null;
  const known = typeof knownVersion === "number" && Number.isInteger(knownVersion) ? knownVersion : null;
  return NextResponse.json({ room: await syncRoom(actor.id, (await params).id, at, known) }, { headers: { "Cache-Control": "no-store" } });
});
