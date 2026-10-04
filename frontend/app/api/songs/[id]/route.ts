import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, requireUserId, route } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** One song for its owner: metadata and analysis status (polled while a job runs, loaded by Studio windows). */
export const GET = route<Ctx>("songs.status", async (_req, { params }) => {
  const userId = await requireUserId();
  const { id } = await params;

  const song = await prisma.song.findFirst({
    where: { id, userId },
    select: { id: true, title: true, artist: true, createdAt: true, status: true, analysisData: true, analysisError: true },
  });
  if (!song) throw new ApiError(404, "Song not found.");
  return NextResponse.json({ song });
});
