import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { listConversations, messageMusician, parseMessage } from "@/lib/messaging";
import { userIdForHandle } from "@/lib/handle-lookup";
import { RATE_LIMITS } from "@/lib/rate-limit";

/** ?kind=DIRECT|PROJECT */
export const GET = route("conversations.list", async (req) => {
  const actor = await requireActor();
  await enforceRateLimit("message-read", actor.id, RATE_LIMITS.messageRead);
  const kind = new URL(req.url).searchParams.get("kind");
  return NextResponse.json({ items: await listConversations(actor.id, { kind: kind === "DIRECT" || kind === "PROJECT" ? kind : undefined }) });
});

/** Body: { to: handle, body?, mediaIds? }: opens (or reuses) a direct conversation with a first message. */
export const POST = route("conversations.start", async (req) => {
  const actor = await requireActor({ write: true });
  const body = await readJson(req);
  await enforceRateLimit("conversation-start", actor.id, RATE_LIMITS.conversationStart);
  const result = await messageMusician(actor, await userIdForHandle(body.to), parseMessage(body));
  return NextResponse.json(result, { status: 201 });
});
