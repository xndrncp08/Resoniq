import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, requireUserId, route } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/rate-limit";

/** The signed-in user's uploads, newest first (no analysis payloads; those load per song). */
export const GET = route("songs.list", async () => {
  const userId = await requireUserId();
  enforceRateLimit("songs-read", userId, RATE_LIMITS.toneRead);
  const songs = await prisma.song.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, title: true, artist: true, status: true, durationSec: true, createdAt: true },
  });
  return NextResponse.json({ songs });
});
