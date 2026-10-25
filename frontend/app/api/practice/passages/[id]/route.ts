import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { deletePassage, parsePassagePatch, updatePassage } from "@/lib/practice-ladder";
import { RATE_LIMITS } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>("practice.passages.update", async (req, { params }) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("practice-write", actor.id, RATE_LIMITS.practiceWrite);
  return NextResponse.json({ passage: await updatePassage(actor.id, (await params).id, parsePassagePatch(await readJson(req))) });
});

export const DELETE = route<Ctx>("practice.passages.delete", async (_req, { params }) => {
  const actor = await requireActor();
  await deletePassage(actor.id, (await params).id);
  return NextResponse.json({ ok: true });
});
