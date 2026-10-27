import { NextResponse } from "next/server";
import { enforceRateLimit, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { getConversation, getMessages } from "@/lib/messaging";
import { RATE_LIMITS } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ id: string }> };
const date = (v: string | null) => (v && !Number.isNaN(Date.parse(v)) ? new Date(v) : undefined);

/** ?before=iso for older messages, ?after=iso for what's new since then. */
export const GET = route<Ctx>("conversations.get", async (req, { params }) => {
  const actor = await requireActor();
  await enforceRateLimit("message-read", actor.id, RATE_LIMITS.messageRead);
  const { id } = await params;
  const p = new URL(req.url).searchParams;
  const [conversation, page] = await Promise.all([getConversation(actor.id, id), getMessages(actor.id, id, { before: date(p.get("before")), after: date(p.get("after")) })]);
  return NextResponse.json({ conversation, ...page });
});
