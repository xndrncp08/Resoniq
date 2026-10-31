import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { respondToCredit } from "@/lib/credits";

type Ctx = { params: Promise<{ id: string }> };

/** The credited musician: { action: "confirm" | "dispute", note? } */
export const POST = route<Ctx>("posts.credit", async (req, { params }) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("post-write", actor.id, RATE_LIMITS.postWrite);
  return NextResponse.json({ status: await respondToCredit(actor.id, (await params).id, await readJson(req)) });
});
