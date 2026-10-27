import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { parseMessage, sendMessage } from "@/lib/messaging";
import { RATE_LIMITS } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

/** Body: { body, replyToId?, mediaIds? } */
export const POST = route<Ctx>("conversations.send", async (req, { params }) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("message-write", actor.id, RATE_LIMITS.messageWrite);
  const message = await sendMessage(actor, (await params).id, parseMessage(await readJson(req)));
  return NextResponse.json({ message }, { status: 201 });
});
