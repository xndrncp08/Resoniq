import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ApiError, enforceRateLimit, readJson, route } from "@/lib/api";
import { BCRYPT_ROUNDS, MAX_NAME_LENGTH, normalizeEmail, passwordProblem } from "@/lib/credentials";
import { clientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { assignHandle, handleFromName } from "@/lib/handles";
import { signupsOpen } from "@/lib/hosting";
import { isUniqueViolation } from "@/lib/validation";
import { sendVerificationEmail } from "@/lib/email-tokens";

/**
 * Creates an email/password account.
 *
 * The response is the same whether or not the email is already registered
 * (and the password is hashed either way, so timing matches), so this
 * endpoint alone doesn't confirm who has an account. Without email
 * verification that only goes so far: the sign-in that follows still fails
 * for an existing account. See SECURITY.md.
 */
export const POST = route("register", async (req) => {
  await enforceRateLimit("register", clientIp(req), RATE_LIMITS.register);
  const signups = await signupsOpen();
  if (!signups.open) throw new ApiError(503, signups.reason!);

  const { name, email: rawEmail, password } = await readJson(req);

  const email = normalizeEmail(rawEmail);
  if (!email) throw new ApiError(400, "Enter a valid email address.");
  const problem = passwordProblem(password);
  if (problem) throw new ApiError(400, problem);
  const displayName = typeof name === "string" ? name.trim().slice(0, MAX_NAME_LENGTH) || null : null;

  const passwordHash = await bcrypt.hash(password as string, BCRYPT_ROUNDS);

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (!existing) {
    try {
      const base = handleFromName(displayName);
      const handle = base ? await assignHandle(prisma, base) : undefined;
      let created: { id: string };
      try {
        created = await prisma.user.create({ data: { name: displayName, email, passwordHash, handle }, select: { id: true } });
      } catch (err) {
        // Lost a handle race: fall back to the database's random handle.
        if (!handle || !isUniqueViolation(err, "handle")) throw err;
        created = await prisma.user.create({ data: { name: displayName, email, passwordHash }, select: { id: true } });
      }
      // A failed email mustn't fail signup; they can resend from Settings.
      await sendVerificationEmail(created.id).catch((err) => console.error("[register] verification email failed", err));
    } catch (err) {
      // Lost a race with a concurrent signup for the same email: same answer as above.
      if (!isUniqueViolation(err)) throw err;
    }
  }

  return NextResponse.json({ ok: true }, { status: 201 });
});
