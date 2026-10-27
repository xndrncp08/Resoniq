import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { parseInvite, sendInvite } from "@/lib/messaging";
import { userIdForHandle } from "@/lib/handle-lookup";
import { RATE_LIMITS } from "@/lib/rate-limit";

/** Body: { to: handle, title, role?, when?, where?, note? }: a collaboration invite in a direct conversation. */
export const POST = route("invites.send", async (req) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("invite", actor.id, RATE_LIMITS.invite);
  const body = await readJson(req);
  return NextResponse.json(await sendInvite(actor, await userIdForHandle(body.to), parseInvite(body)), { status: 201 });
});
