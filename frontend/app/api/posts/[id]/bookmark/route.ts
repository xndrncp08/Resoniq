import { NextResponse } from "next/server";
import { enforceRateLimit, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { setBookmark } from "@/lib/posts";
import { RATE_LIMITS } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

const handler = (on: boolean) =>
  route<Ctx>(on ? "posts.bookmark" : "posts.unbookmark", async (_req, { params }) => {
    const actor = await requireActor();
    await enforceRateLimit("vote", actor.id, RATE_LIMITS.vote);
    return NextResponse.json(await setBookmark(actor.id, (await params).id, on));
  });

export const PUT = handler(true);
export const DELETE = handler(false);
