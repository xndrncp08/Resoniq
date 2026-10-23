import { NextResponse } from "next/server";
import { ApiError, enforceRateLimit, readJson, route } from "@/lib/api";
import { normalizeEmail } from "@/lib/credentials";
import { requestPasswordReset } from "@/lib/email-tokens";
import { clientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { mailConfigured } from "@/lib/mailer";

/** Body: { email }. Same answer whether or not the account exists. */
export const POST = route("auth.password.forgot", async (req) => {
  await enforceRateLimit("forgot-ip", clientIp(req), RATE_LIMITS.emailSend);
  // Same answer for every address, so this doesn't reveal who has an account.
  if (!mailConfigured()) throw new ApiError(503, "Password reset by email isn't available.");
  const email = normalizeEmail((await readJson(req)).email);
  if (email) {
    await enforceRateLimit("forgot-email", email, RATE_LIMITS.emailSend);
    await requestPasswordReset(email).catch((err) => console.error("[auth] reset email failed", err));
  }
  return NextResponse.json({ ok: true });
});
