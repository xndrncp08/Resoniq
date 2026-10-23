import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, enforceRateLimit, readJson, requireUserId, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { createTone, parseToneInput } from "@/lib/tones";
import { recipeCoreFromAnalysis } from "@/lib/tone-recipe";
import { parseRecipeCore } from "@/lib/tone-validation";
import type { EngineAnalysis } from "@/types/engine";

const MAX_QUERY_LENGTH = 100;

export const GET = route("tones.list", async (req) => {
  const userId = await requireUserId();
  await enforceRateLimit("tones-read", userId, RATE_LIMITS.toneRead);

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
  const actor = await requireActor({ write: true });
  await enforceRateLimit("tones-write", actor.id, RATE_LIMITS.toneWrite);

  const body = await readJson(req, 64 * 1024);
  const input = parseToneInput(body, { partial: false });

  let songId: string | null = null;
  let recipeEdited = false;
  if (body.songId !== undefined && body.songId !== null) {
    if (typeof body.songId !== "string") throw new ApiError(400, "songId must be a string.");
    // Only link songs the user owns; otherwise a tone could surface someone
    // else's song title on the public /t/[id] page.
    const song = await prisma.song.findFirst({ where: { id: body.songId, userId: actor.id }, select: { id: true, analysisData: true } });
    if (!song) throw new ApiError(404, "Song not found.");
    songId = song.id;
    // Knobs turned before saving mean this is no longer the raw analysis; label it honestly.
    if (input.data && song.analysisData) {
      const analyzed = parseRecipeCore(recipeCoreFromAnalysis(song.analysisData as unknown as EngineAnalysis));
      recipeEdited = JSON.stringify(analyzed) !== JSON.stringify(input.data.recipe);
    }
  }

  const id = await createTone(actor, { ...input, songId, recipeEdited });
  return NextResponse.json({ tone: { id } }, { status: 201 });
});
