import { NextResponse } from "next/server";
import { enforceRateLimit, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { remixTone } from "@/lib/tones";

type Ctx = { params: Promise<{ id: string }> };

/** Copies the tone into the caller's library (unlisted), crediting the original. */
export const POST = route<Ctx>("tones.remix", async (_req, { params }) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("tones-write", actor.id, RATE_LIMITS.toneWrite);
  return NextResponse.json({ tone: { id: await remixTone(actor, (await params).id) } }, { status: 201 });
});
