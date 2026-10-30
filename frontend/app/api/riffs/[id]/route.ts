import { NextResponse } from "next/server";
import { ApiError, enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { deleteRiff, getRiff, parseRiffPatch, updateRiff } from "@/lib/riffs/service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>("riffs.get", async (_req, { params }) => {
  const actor = await requireActor();
  const riff = await getRiff(actor.id, (await params).id);
  if (!riff) throw new ApiError(404, "Riff not found.");
  return NextResponse.json({ riff });
});

export const PATCH = route<Ctx>("riffs.update", async (req, { params }) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("riff-write", actor.id, RATE_LIMITS.riffWrite);
  return NextResponse.json({ riff: await updateRiff(actor.id, (await params).id, parseRiffPatch(await readJson(req))) });
});

export const DELETE = route<Ctx>("riffs.delete", async (_req, { params }) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("riff-write", actor.id, RATE_LIMITS.riffWrite);
  await deleteRiff(actor.id, (await params).id);
  return NextResponse.json({ ok: true });
});
