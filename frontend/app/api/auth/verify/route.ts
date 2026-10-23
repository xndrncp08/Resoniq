import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { verifyEmail } from "@/lib/email-tokens";
import { clientIp, RATE_LIMITS } from "@/lib/rate-limit";

/** Body: { token }. POST (not a GET link handler) so mail scanners prefetching the URL can't consume it. */
export const POST = route("auth.verify", async (req) => {
  await enforceRateLimit("token-use", clientIp(req), RATE_LIMITS.tokenUse);
  const { token } = await readJson(req);
  await verifyEmail(String(token ?? ""));
  return NextResponse.json({ ok: true });
});
