import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { BCRYPT_ROUNDS, passwordProblem } from "@/lib/credentials";
import { appOrigin, sendMail } from "@/lib/mailer";

/**
 * Single-use tokens for email verification and password reset, stored in the
 * existing VerificationToken table. Only a SHA-256 of the token is stored, so
 * a database leak can't be replayed; the plain token exists only in the email.
 * `identifier` namespaces the purpose: "verify:<userId>" or "reset:<userId>".
 */
export const VERIFY_TTL_MS = 24 * 3_600_000;
export const RESET_TTL_MS = 3_600_000;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

async function issue(purpose: "verify" | "reset", userId: string, ttlMs: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const identifier = `${purpose}:${userId}`;
  await prisma.$transaction([
    // One live token per purpose: issuing a new link invalidates older ones.
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.verificationToken.create({ data: { identifier, token: hash(token), expires: new Date(Date.now() + ttlMs) } }),
  ]);
  return token;
}

/** Consumes a token. Returns the user id, or null if it's unknown, used or expired. */
async function consume(purpose: "verify" | "reset", token: string): Promise<string | null> {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) return null;
  const row = await prisma.verificationToken.findUnique({ where: { token: hash(token) } });
  if (!row || !row.identifier.startsWith(`${purpose}:`)) return null;
  // Delete first: a token works once even if two requests race.
  const { count } = await prisma.verificationToken.deleteMany({ where: { token: row.token } });
  if (count !== 1 || row.expires < new Date()) return null;
  return row.identifier.slice(purpose.length + 1);
}

export async function sendVerificationEmail(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, emailVerified: true } });
  if (!user?.email || user.emailVerified) return;
  const token = await issue("verify", userId, VERIFY_TTL_MS);
  await sendMail({
    to: user.email,
    subject: "Confirm your email for Resoniq",
    text: `Confirm your email to post and start communities on Resoniq:\n\n${appOrigin()}/verify?token=${token}\n\nThe link works once and expires in 24 hours. If you didn't sign up, ignore this email.`,
  });
}

export async function verifyEmail(token: string) {
  const userId = await consume("verify", token);
  if (!userId) throw new ApiError(400, "That link is invalid or has expired. Request a new one from Settings.");
  await prisma.user.update({ where: { id: userId }, data: { emailVerified: new Date() } });
}

/** Always resolves the same way, so this can't be used to discover accounts. */
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" }, status: { not: "BANNED" } }, select: { id: true, email: true, passwordHash: true } });
  if (!user?.email || !user.passwordHash) return;
  const token = await issue("reset", user.id, RESET_TTL_MS);
  await sendMail({
    to: user.email,
    subject: "Reset your Resoniq password",
    text: `Someone (hopefully you) asked to reset your Resoniq password:\n\n${appOrigin()}/reset?token=${token}\n\nThe link works once and expires in an hour. If it wasn't you, ignore this email; your password hasn't changed.`,
  });
}

/** Sets a new password and signs out every existing session. */
export async function resetPassword(token: string, password: unknown) {
  const problem = passwordProblem(password);
  if (problem) throw new ApiError(400, problem);
  const userId = await consume("reset", token);
  if (!userId) throw new ApiError(400, "That reset link is invalid or has expired. Request a new one.");
  const passwordHash = await bcrypt.hash(password as string, BCRYPT_ROUNDS);
  await prisma.user.update({
    where: { id: userId },
    // Clicking the emailed link also proves the address.
    data: { passwordHash, sessionVersion: { increment: 1 }, emailVerified: new Date() },
  });
}
