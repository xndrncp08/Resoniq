import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, enforceRateLimit, optionalActor, route } from "@/lib/api";
import { decodeCursor, parseLimit } from "@/lib/pagination";
import { clientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { listedToneWhere, listTones } from "@/lib/tones";

type Ctx = { params: Promise<{ handle: string }> };

/** A musician's public tones; their own profile also shows their unlisted and private ones. */
export const GET = route<Ctx>("users.tones", async (req, { params }) => {
  await enforceRateLimit("social-read", clientIp(req), RATE_LIMITS.socialRead);
  const user = await prisma.user.findFirst({ where: { handle: (await params).handle.toLowerCase(), status: { not: "BANNED" } }, select: { id: true } });
  if (!user) throw new ApiError(404, "Musician not found.");
  const viewer = await optionalActor();
  const p = new URL(req.url).searchParams;
  const own = viewer?.id === user.id;
  return NextResponse.json(
    await listTones(
      viewer?.id ?? null,
      { sort: p.get("sort") === "popular" ? "popular" : "new", authorId: user.id, cursor: decodeCursor(p.get("cursor")), limit: parseLimit(p.get("limit")) },
      own ? { userId: user.id } : listedToneWhere,
    ),
  );
});
