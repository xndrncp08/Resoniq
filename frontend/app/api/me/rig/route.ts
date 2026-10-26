import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { getRig, parseRig, replaceRig } from "@/lib/portfolio";
import { RATE_LIMITS } from "@/lib/rate-limit";

export const GET = route("me.rig.get", async () => {
  const actor = await requireActor();
  return NextResponse.json({ items: await getRig(actor.id) });
});

/** Body: { items: [{ gearId, note? }] }, the whole rig in display order. */
export const PUT = route("me.rig.put", async (req) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("profile-write", actor.id, RATE_LIMITS.profileWrite);
  return NextResponse.json({ items: await replaceRig(actor.id, parseRig(await readJson(req))) });
});
