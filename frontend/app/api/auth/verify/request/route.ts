import { NextResponse } from "next/server";
import { ApiError, enforceRateLimit, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { sendVerificationEmail } from "@/lib/email-tokens";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { mailConfigured } from "@/lib/mailer";

export const POST = route("auth.verify.request", async () => {
  const actor = await requireActor();
  if (!mailConfigured()) throw new ApiError(503, "Email verification isn't available yet.");
  await enforceRateLimit("email-send", actor.id, RATE_LIMITS.emailSend);
  await sendVerificationEmail(actor.id);
  return NextResponse.json({ ok: true });
});
