import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { parseVote } from "@/lib/comments";
import { votePost } from "@/lib/posts";
import { RATE_LIMITS } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

/** Body: { value: 1 | 0 | -1 }. 1 is an "Amp" (upvote), 0 clears. */
export const PUT = route<Ctx>("posts.vote", async (req, { params }) => {
  const actor = await requireActor({ write: true });
  enforceRateLimit("vote", actor.id, RATE_LIMITS.vote);
  const { value } = await readJson(req);
  return NextResponse.json(await votePost(actor.id, (await params).id, parseVote(value)));
});
