import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, enforceRateLimit, readJson, requireUserId, route } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { parseToneName, ValidationError } from "@/lib/tone-validation";

type Ctx = { params: Promise<{ id: string }> };

const notFound = () => new ApiError(404, "Tone not found.");

export const PATCH = route<Ctx>("tones.update", async (req, { params }) => {
  const userId = await requireUserId();
  enforceRateLimit("tones-write", userId, RATE_LIMITS.toneWrite);
  const { id } = await params;

  const { name, favorite } = await readJson(req);
  const data: { name?: string; favorite?: boolean } = {};
  try {
    if (name !== undefined) data.name = parseToneName(name);
  } catch (err) {
    if (err instanceof ValidationError) throw new ApiError(400, err.message);
    throw err;
  }
  if (favorite !== undefined) {
    if (typeof favorite !== "boolean") throw new ApiError(400, "favorite must be a boolean.");
    data.favorite = favorite;
  }

  // Scoping the write itself to the owner leaves no gap between check and update.
  const { count } = await prisma.tone.updateMany({ where: { id, userId }, data });
  if (count === 0) throw notFound();

  const tone = await prisma.tone.findFirst({ where: { id, userId } });
  if (!tone) throw notFound();
  return NextResponse.json({ tone });
});

export const DELETE = route<Ctx>("tones.delete", async (_req, { params }) => {
  const userId = await requireUserId();
  enforceRateLimit("tones-write", userId, RATE_LIMITS.toneWrite);
  const { id } = await params;

  const { count } = await prisma.tone.deleteMany({ where: { id, userId } });
  if (count === 0) throw notFound();
  return NextResponse.json({ ok: true });
});
