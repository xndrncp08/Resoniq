import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { react } from "@/lib/messaging";
import { RATE_LIMITS } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

async function handle(req: Request, { params }: Ctx, on: boolean) {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("vote", actor.id, RATE_LIMITS.vote);
  const { emoji } = await readJson(req);
  await react(actor, (await params).id, typeof emoji === "string" ? emoji : "", on);
  return NextResponse.json({ ok: true });
}

/** Body: { emoji } */
export const PUT = route<Ctx>("messages.react", (req, ctx) => handle(req, ctx, true));
export const DELETE = route<Ctx>("messages.unreact", (req, ctx) => handle(req, ctx, false));
