import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { createPassage, listPassages, parsePassage } from "@/lib/practice-ladder";
import { RATE_LIMITS } from "@/lib/rate-limit";

export const GET = route("practice.passages.list", async () => {
  const actor = await requireActor();
  return NextResponse.json({ items: await listPassages(actor.id) });
});

export const POST = route("practice.passages.create", async (req) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("practice-write", actor.id, RATE_LIMITS.practiceWrite);
  return NextResponse.json({ passage: await createPassage(actor.id, parsePassage(await readJson(req))) }, { status: 201 });
});
