import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, enforceRateLimit, readJson, requireUserId, route } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { parseStoredToneData, parseToneName, ValidationError } from "@/lib/tone-validation";

const MAX_QUERY_LENGTH = 100;

export const GET = route("tones.list", async (req) => {
  const userId = await requireUserId();
  enforceRateLimit("tones-read", userId, RATE_LIMITS.toneRead);

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim().slice(0, MAX_QUERY_LENGTH);

  const tones = await prisma.tone.findMany({
    where: {
      userId,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: [{ favorite: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ tones });
});

export const POST = route("tones.create", async (req) => {
  const userId = await requireUserId();
  enforceRateLimit("tones-write", userId, RATE_LIMITS.toneWrite);

  const body = await readJson(req, 64 * 1024);
  let name, data;
  try {
    name = parseToneName(body.name);
    data = parseStoredToneData(body.data);
  } catch (err) {
    if (err instanceof ValidationError) throw new ApiError(400, err.message);
    throw err;
  }

  let songId: string | null = null;
  if (body.songId !== undefined && body.songId !== null) {
    if (typeof body.songId !== "string") throw new ApiError(400, "songId must be a string.");
    // Only link songs the user owns; otherwise a tone could surface someone
    // else's song title on the public /t/[id] page.
    const song = await prisma.song.findFirst({ where: { id: body.songId, userId }, select: { id: true } });
    if (!song) throw new ApiError(404, "Song not found.");
    songId = song.id;
  }

  const tone = await prisma.tone.create({
    // StoredToneData is plain JSON once validated; Prisma's input type can't see that.
    data: { userId, name, data: data as unknown as Prisma.InputJsonValue, songId },
  });

  return NextResponse.json({ tone }, { status: 201 });
});
