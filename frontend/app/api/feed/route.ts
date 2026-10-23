import { NextResponse } from "next/server";
import { ApiError, enforceRateLimit, optionalActor, route } from "@/lib/api";
import { decodeCursor, parseLimit } from "@/lib/pagination";
import { followingFeed, forYouFeed, parseFeedQuery } from "@/lib/posts";
import { clientIp, RATE_LIMITS } from "@/lib/rate-limit";

/** ?tab=for-you|following &sort=hot|new|top &t=day|week|month|year|all &cursor &limit */
export const GET = route("feed", async (req) => {
  await enforceRateLimit("social-read", clientIp(req), RATE_LIMITS.socialRead);
  const viewer = await optionalActor();
  const url = new URL(req.url);
  const q = { ...parseFeedQuery(url), cursor: decodeCursor(url.searchParams.get("cursor")), limit: parseLimit(url.searchParams.get("limit")) };
  if (url.searchParams.get("tab") === "following") {
    if (!viewer) throw new ApiError(401, "Sign in to see who you follow.");
    return NextResponse.json(await followingFeed(viewer.id, q));
  }
  return NextResponse.json(await forYouFeed(viewer?.id ?? null, q));
});
