import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { normalizeEmail } from "@/lib/credentials";
import { requestPasswordReset } from "@/lib/email-tokens";
import { clientIp, RATE_LIMITS } from "@/lib/rate-limit";

/** Body: { email }. Same answer whether or not the account exists. */
export const POST = route("auth.password.forgot", async (req) => {
  await enforceRateLimit("forgot-ip", clientIp(req), RATE_LIMITS.emailSend);
  const email = normalizeEmail((await readJson(req)).email);
  if (email) {
    await enforceRateLimit("forgot-email", email, RATE_LIMITS.emailSend);
    await requestPasswordReset(email).catch((err) => console.error("[auth] reset email failed", err));
  }
  return NextResponse.json({ ok: true });
});
