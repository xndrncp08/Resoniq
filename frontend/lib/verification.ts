import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { isEnabled } from "@/lib/flags";

/**
 * When `auth.requireEmailVerification` is on, email/password accounts must
 * confirm their address before posting or creating communities. OAuth accounts
 * (no password) are verified by their provider.
 */
export async function assertCanPublish(userId: string) {
  if (!(await isEnabled("auth.requireEmailVerification"))) return;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { emailVerified: true, passwordHash: true } });
  if (u?.passwordHash && !u.emailVerified) throw new ApiError(403, "Confirm your email to post. We sent a link when you signed up; you can resend it from Settings.");
}
