import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, enforceRateLimit, optionalActor, route } from "@/lib/api";
import { decodeCursor, parseLimit } from "@/lib/pagination";
import { listPosts, parseFeedQuery } from "@/lib/posts";
import { clientIp, RATE_LIMITS } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ slug: string }> };

export const GET = route<Ctx>("communities.posts", async (req, { params }) => {
  enforceRateLimit("social-read", clientIp(req), RATE_LIMITS.socialRead);
  const viewer = await optionalActor();
  const c = await prisma.community.findUnique({ where: { slug: (await params).slug.toLowerCase() }, select: { id: true } });
  if (!c) throw new ApiError(404, "Community not found.");
  const url = new URL(req.url);
  const result = await listPosts({ communityId: c.id }, viewer?.id ?? null, {
    ...parseFeedQuery(url),
    cursor: decodeCursor(url.searchParams.get("cursor")),
    limit: parseLimit(url.searchParams.get("limit")),
  });
  return NextResponse.json(result);
});
