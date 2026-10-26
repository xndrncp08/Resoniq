import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, enforceRateLimit, optionalActor, route } from "@/lib/api";
import { decodeCursor, parseLimit } from "@/lib/pagination";
import { listPosts, parseFeedQuery, PERFORMANCE_WHERE } from "@/lib/posts";
import { clientIp, RATE_LIMITS } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ handle: string }> };

export const GET = route<Ctx>("users.posts", async (req, { params }) => {
  await enforceRateLimit("social-read", clientIp(req), RATE_LIMITS.socialRead);
  const user = await prisma.user.findFirst({ where: { handle: (await params).handle.toLowerCase(), status: { not: "BANNED" } }, select: { id: true } });
  if (!user) throw new ApiError(404, "Musician not found.");
  const viewer = await optionalActor();
  const url = new URL(req.url);
  const q = parseFeedQuery(url);
  return NextResponse.json(
    await listPosts({ authorId: user.id, ...(url.searchParams.get("kind") === "performances" && PERFORMANCE_WHERE), ...(url.searchParams.get("exclude") && { id: { not: url.searchParams.get("exclude")! } }) }, viewer?.id ?? null, {
      ...q,
      sort: q.sort ?? "new",
      cursor: decodeCursor(url.searchParams.get("cursor")),
      limit: parseLimit(url.searchParams.get("limit")),
    }),
  );
});
