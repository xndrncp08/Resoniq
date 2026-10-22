import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { moderateComment, parseModeration } from "@/lib/moderation";
import { RATE_LIMITS } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

/** Body: { action: "remove" | "restore", reason }. Platform moderators, or moderators of the community. */
export const POST = route<Ctx>("comments.moderate", async (req, { params }) => {
  const actor = await requireActor({ write: true });
  enforceRateLimit("moderation", actor.id, RATE_LIMITS.moderation);
  await moderateComment(actor, (await params).id, parseModeration(await readJson(req)));
  return NextResponse.json({ ok: true });
});
