import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, enforceRateLimit, optionalActor, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { clientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { getTone, parseToneInput, updateTone } from "@/lib/tones";

type Ctx = { params: Promise<{ id: string }> };

const notFound = () => new ApiError(404, "Tone not found.");

export const GET = route<Ctx>("tones.get", async (req, { params }) => {
  await enforceRateLimit("social-read", clientIp(req), RATE_LIMITS.socialRead);
  const viewer = await optionalActor();
  const tone = await getTone((await params).id, viewer?.id ?? null);
  if (!tone) throw notFound();
  return NextResponse.json({ tone });
});

/** Owner edits: name, favorite, recipe (`data`), declared `rig`, description, visibility. */
export const PATCH = route<Ctx>("tones.update", async (req, { params }) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("tones-write", actor.id, RATE_LIMITS.toneWrite);
  const { id } = await params;
  const input = parseToneInput(await readJson(req, 64 * 1024), { partial: true });
  return NextResponse.json({ tone: await updateTone(actor, id, input) });
});

export const DELETE = route<Ctx>("tones.delete", async (_req, { params }) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("tones-write", actor.id, RATE_LIMITS.toneWrite);
  const { id } = await params;
  const { count } = await prisma.tone.deleteMany({ where: { id, userId: actor.id } });
  if (count === 0) throw notFound();
  return NextResponse.json({ ok: true });
});
