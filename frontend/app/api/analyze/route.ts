import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, enforceRateLimit, readJson, requireUserId, route } from "@/lib/api";
import { analyzeAudio, EngineError } from "@/lib/engine";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { getStorage } from "@/lib/storage";

// Analysis of a long track can take a while; don't let a platform default cut it off.
export const maxDuration = 300;

// A job still ANALYZING after this long was abandoned (e.g. the server restarted mid-run).
const STALE_ANALYSIS_MS = 10 * 60_000;

export const POST = route("analyze", async (req) => {
  const userId = await requireUserId();
  enforceRateLimit("analyze", userId, RATE_LIMITS.analyze);

  const { songId } = await readJson(req);
  if (typeof songId !== "string" || !songId) throw new ApiError(400, "songId is required.");

  const song = await prisma.song.findFirst({ where: { id: songId, userId } });
  if (!song) throw new ApiError(404, "Song not found.");
  if (!song.storageKey) throw new ApiError(409, "This upload predates private storage. Upload it again to analyze it.");

  // Claim the job atomically, so a double click or a second tab can't start
  // a second analysis of the same song. FAILED and abandoned jobs can be retried.
  const { count } = await prisma.song.updateMany({
    where: {
      id: song.id,
      userId,
      OR: [
        { status: { in: ["UPLOADED", "FAILED"] } },
        { status: "ANALYZING", analysisStartedAt: { lt: new Date(Date.now() - STALE_ANALYSIS_MS) } },
        { status: "ANALYZING", analysisStartedAt: null },
      ],
    },
    data: { status: "ANALYZING", analysisError: null, analysisStartedAt: new Date() },
  });
  if (count === 0) throw new ApiError(409, "This song is already being analyzed or is done.");

  const fail = async (detail: unknown, publicMessage: string) => {
    console.error(`[api] analyze ${song.id} failed`, detail);
    await prisma.song.update({ where: { id: song.id }, data: { status: "FAILED", analysisError: publicMessage } });
    return NextResponse.json({ error: publicMessage }, { status: 502 });
  };

  try {
    const stored = await getStorage().get(song.storageKey);
    if (!stored) return await fail(`storage object ${song.storageKey} missing`, "The uploaded file is missing. Upload it again.");

    const analysis = await analyzeAudio(stored.bytes, song.storageKey.split("/").pop()!, stored.contentType);
    const updated = await prisma.song.update({
      where: { id: song.id },
      // EngineAnalysis is plain JSON from the engine; Prisma's input type can't see that.
      data: { status: "ANALYZED", analysisData: analysis as unknown as Prisma.InputJsonValue, analysisError: null },
      select: { id: true, status: true, analysisData: true },
    });
    return NextResponse.json({ song: updated });
  } catch (err) {
    return await fail(err, err instanceof EngineError ? err.publicMessage : "Analysis failed. Try again.");
  }
});
