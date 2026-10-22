import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeActor, prisma, resetDb } from "./db";

const sent: { to: string; text: string }[] = [];
vi.mock("@/lib/mailer", () => ({ appOrigin: () => "https://resoniq.test", sendMail: async (m: { to: string; text: string }) => void sent.push(m), mailConfigured: () => true }));
const { requestPasswordReset, resetPassword, sendVerificationEmail, verifyEmail } = await import("@/lib/email-tokens");
const { assertCanPublish } = await import("@/lib/verification");
const { clearFlagCache } = await import("@/lib/flags");

const tokenFrom = (text: string) => text.match(/token=([A-Za-z0-9_-]+)/)![1];

beforeEach(async () => {
  await resetDb();
  sent.length = 0;
  clearFlagCache();
});

describe("email verification", () => {
  it("verifies once, stores only a hash, and gates publishing behind the flag", async () => {
    const u = await makeActor({ email: "v@test.dev" });
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: "x" } });
    await sendVerificationEmail(u.id);
    const token = tokenFrom(sent[0].text);
    expect(await prisma.verificationToken.count({ where: { token } })).toBe(0);

    await prisma.featureFlag.create({ data: { key: "auth.requireEmailVerification", enabled: true } });
    clearFlagCache();
    await expect(assertCanPublish(u.id)).rejects.toThrow("Confirm your email");
    await verifyEmail(token);
    await expect(verifyEmail(token)).rejects.toThrow("invalid or has expired");
    await expect(assertCanPublish(u.id)).resolves.toBeUndefined();
  });

  it("rejects expired tokens", async () => {
    const u = await makeActor({ email: "e@test.dev" });
    await sendVerificationEmail(u.id);
    await prisma.verificationToken.updateMany({ data: { expires: new Date(Date.now() - 1000) } });
    await expect(verifyEmail(tokenFrom(sent[0].text))).rejects.toThrow();
  });
});

describe("password reset", () => {
  it("is silent for unknown emails, works once, and bumps the session version", async () => {
    await requestPasswordReset("nobody@test.dev");
    expect(sent).toHaveLength(0);
    const u = await makeActor({ email: "r@test.dev" });
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: "old" } });
    await requestPasswordReset("R@test.dev");
    await requestPasswordReset("r@test.dev");
    // A second request invalidates the first link.
    await expect(resetPassword(tokenFrom(sent[0].text), "new-password-1")).rejects.toThrow();
    await expect(resetPassword(tokenFrom(sent[1].text), "short")).rejects.toThrow("at least 8");
    await resetPassword(tokenFrom(sent[1].text), "new-password-1");
    const after = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.sessionVersion).toBe(1);
    expect(after.passwordHash).not.toBe("old");
    expect(after.emailVerified).not.toBeNull();
  });
});
