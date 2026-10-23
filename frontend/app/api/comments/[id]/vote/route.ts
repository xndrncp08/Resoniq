import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { parseVote, voteComment } from "@/lib/comments";
import { RATE_LIMITS } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = route<Ctx>("comments.vote", async (req, { params }) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("vote", actor.id, RATE_LIMITS.vote);
  const { value } = await readJson(req);
  return NextResponse.json(await voteComment(actor.id, (await params).id, parseVote(value)));
});
