import { NextResponse } from "next/server";
import { enforceRateLimit, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { restoreRelease } from "@/lib/publishing";

type Ctx = { params: Promise<{ id: string; rid: string }> };

/** Author: bring back an earlier version (the current one becomes a revision too). */
export const POST = route<Ctx>("posts.release.restore", async (_req, { params }) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("post-write", actor.id, RATE_LIMITS.postWrite);
  const { id, rid } = await params;
  await restoreRelease(actor.id, id, rid);
  return NextResponse.json({ ok: true });
});
