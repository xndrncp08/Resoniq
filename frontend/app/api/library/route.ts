import { NextResponse } from "next/server";
import { enforceRateLimit, requireUserId, route } from "@/lib/api";
import { loadLibrary } from "@/lib/library";
import { RATE_LIMITS } from "@/lib/rate-limit";

/** The signed-in user's saved tones as ToneRecipes (what /library renders), for Studio windows. */
export const GET = route("library", async () => {
  const userId = await requireUserId();
  enforceRateLimit("tones-read", userId, RATE_LIMITS.toneRead);
  return NextResponse.json({ tones: await loadLibrary(userId) });
});
