import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { resetPassword } from "@/lib/email-tokens";
import { clientIp, RATE_LIMITS } from "@/lib/rate-limit";

/** Body: { token, password }. Signs out every existing session on success. */
export const POST = route("auth.password.reset", async (req) => {
  enforceRateLimit("token-use", clientIp(req), RATE_LIMITS.tokenUse);
  const { token, password } = await readJson(req);
  await resetPassword(String(token ?? ""), password);
  return NextResponse.json({ ok: true });
});
