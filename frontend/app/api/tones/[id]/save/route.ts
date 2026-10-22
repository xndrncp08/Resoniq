import { NextResponse } from "next/server";
import { enforceRateLimit, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { setToneSaved } from "@/lib/tones";

type Ctx = { params: Promise<{ id: string }> };

const handler = (on: boolean) =>
  route<Ctx>(on ? "tones.save" : "tones.unsave", async (_req, { params }) => {
    const actor = await requireActor();
    enforceRateLimit("vote", actor.id, RATE_LIMITS.vote);
    return NextResponse.json(await setToneSaved(actor, (await params).id, on));
  });

export const PUT = handler(true);
export const DELETE = handler(false);
