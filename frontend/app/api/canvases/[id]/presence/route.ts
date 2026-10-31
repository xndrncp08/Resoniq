import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { canvasPresence } from "@/lib/canvas/service";

type Ctx = { params: Promise<{ id: string }> };

/** Body: { sectionId?: string | null }. Returns { version, present }: cheap enough to poll every couple of seconds. */
export const POST = route<Ctx>("canvases.presence", async (req, { params }) => {
  const actor = await requireActor();
  await enforceRateLimit("room-sync", actor.id, RATE_LIMITS.roomSync);
  const { sectionId } = await readJson(req);
  const section = typeof sectionId === "string" && /^[\w-]{1,40}$/.test(sectionId) ? sectionId : null;
  return NextResponse.json(await canvasPresence(actor.id, (await params).id, section), { headers: { "Cache-Control": "no-store" } });
});
