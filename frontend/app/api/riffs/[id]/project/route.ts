import { NextResponse } from "next/server";
import { enforceRateLimit, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { riffProject } from "@/lib/riffs/service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>("riffs.project", async (_req, { params }) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("conversation-start", actor.id, RATE_LIMITS.conversationStart);
  return NextResponse.json(await riffProject(actor.id, (await params).id));
});
