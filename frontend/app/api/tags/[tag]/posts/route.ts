import { NextResponse } from "next/server";
import { ApiError, enforceRateLimit, optionalActor, route } from "@/lib/api";
import { decodeCursor, parseLimit } from "@/lib/pagination";
import { listPosts, parseFeedQuery } from "@/lib/posts";
import { clientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { normalizeTag, TAG_PATTERN } from "@/lib/rich-text";

type Ctx = { params: Promise<{ tag: string }> };

export const GET = route<Ctx>("tags.posts", async (req, { params }) => {
  enforceRateLimit("social-read", clientIp(req), RATE_LIMITS.socialRead);
  const tag = normalizeTag(decodeURIComponent((await params).tag));
  if (!TAG_PATTERN.test(tag)) throw new ApiError(404, "Unknown tag.");
  const viewer = await optionalActor();
  const url = new URL(req.url);
  return NextResponse.json(
    await listPosts({ tags: { some: { tag } } }, viewer?.id ?? null, {
      ...parseFeedQuery(url),
      cursor: decodeCursor(url.searchParams.get("cursor")),
      limit: parseLimit(url.searchParams.get("limit")),
    }),
  );
});
