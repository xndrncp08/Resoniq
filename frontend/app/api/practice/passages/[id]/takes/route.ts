import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { addTake, parseTake } from "@/lib/practice-ladder";
import { RATE_LIMITS } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>("practice.takes.create", async (req, { params }) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("practice-write", actor.id, RATE_LIMITS.practiceWrite);
  return NextResponse.json({ take: await addTake(actor.id, (await params).id, parseTake(await readJson(req))) }, { status: 201 });
});
