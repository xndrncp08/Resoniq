import { NextResponse } from "next/server";
import { ApiError, enforceRateLimit, optionalActor, route } from "@/lib/api";
import { decodeCursor, parseLimit } from "@/lib/pagination";
import { listPosts, parseFeedQuery } from "@/lib/posts";
import { forYouWhere, genreWhere, MUSIC_WHERE } from "@/lib/music";
import { clientIp, RATE_LIMITS } from "@/lib/rate-limit";

/** Original music. ?genre= &scope=for-you &sort=new|top|hot &t= &cursor &limit */
export const GET = route("music", async (req) => {
  await enforceRateLimit("social-read", clientIp(req), RATE_LIMITS.socialRead);
  const viewer = await optionalActor();
  const url = new URL(req.url);
  const genre = url.searchParams.get("genre");
  const forYou = url.searchParams.get("scope") === "for-you";
  if (forYou && !viewer) throw new ApiError(401, "Sign in to see music picked for you.");
  const where = { AND: [MUSIC_WHERE, ...(genre ? [genreWhere(genre)] : []), ...(forYou && viewer ? [await forYouWhere(viewer.id)] : [])] };
  const q = parseFeedQuery(url);
  return NextResponse.json(await listPosts(where, viewer?.id ?? null, { ...q, category: undefined, sort: q.sort ?? "new", cursor: decodeCursor(url.searchParams.get("cursor")), limit: parseLimit(url.searchParams.get("limit")) }));
});
