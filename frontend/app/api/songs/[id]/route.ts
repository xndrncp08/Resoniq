import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, requireUserId, route } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** Analysis status for the owner, polled by the analysis page while a job runs. */
export const GET = route<Ctx>("songs.status", async (_req, { params }) => {
  const userId = await requireUserId();
  const { id } = await params;

  const song = await prisma.song.findFirst({
    where: { id, userId },
    select: { id: true, status: true, analysisData: true, analysisError: true },
  });
  if (!song) throw new ApiError(404, "Song not found.");
  return NextResponse.json({ song });
});
