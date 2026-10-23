import { NextResponse } from "next/server";
import { ApiError, enforceRateLimit, route } from "@/lib/api";
import { listFollows } from "@/lib/follows";
import { decodeCursor, parseLimit } from "@/lib/pagination";
import { clientIp, RATE_LIMITS } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ handle: string }> };

export const GET = route<Ctx>("users.followers", async (req, { params }) => {
  await enforceRateLimit("social-read", clientIp(req), RATE_LIMITS.socialRead);
  const url = new URL(req.url);
  const result = await listFollows(
    (await params).handle.toLowerCase(),
    "followers",
    decodeCursor(url.searchParams.get("cursor")),
    parseLimit(url.searchParams.get("limit")),
  );
  if (!result) throw new ApiError(404, "Musician not found.");
  return NextResponse.json(result);
});
