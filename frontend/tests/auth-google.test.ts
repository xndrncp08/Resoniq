import { describe, expect, it, vi } from "vitest";
import type { NextAuthConfig } from "next-auth";
const capture = vi.hoisted(() => {
  process.env.AUTH_GOOGLE_ID = "test-id.apps.googleusercontent.com";
  process.env.AUTH_GOOGLE_SECRET = "test-secret";
  return vi.fn();
});
vi.mock("next-auth", async (original) => ({ ...(await original<typeof import("next-auth")>()), default: (config: NextAuthConfig) => { capture(config); return {}; } }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() }, account: { findUnique: vi.fn() } } }));
vi.mock("@/lib/flags", () => ({ isEnabled: vi.fn(async () => true) }));
await import("@/auth");
import { prisma } from "@/lib/prisma";
import { isEnabled } from "@/lib/flags";
const config = capture.mock.calls[0][0] as NextAuthConfig;

type ProviderLike = { id: string; options?: Record<string, unknown> };
const google = (config.providers as unknown as ProviderLike[]).find((p) => p.id === "google")!;
const signIn = (args: { user: { id?: string }; profile?: Record<string, unknown>; providerAccountId?: string }) =>
  config.callbacks!.signIn!({
    user: args.user,
    account: { provider: "google", type: "oidc", providerAccountId: args.providerAccountId ?? "sub-1" },
    profile: args.profile ?? { email_verified: true },
  } as never);

describe("Google sign-in", () => {
  it("is configured from AUTH_GOOGLE_* without email-based account linking", () => {
    expect(google.options).toMatchObject({ clientId: "test-id.apps.googleusercontent.com", checks: ["pkce", "state"] });
    expect(google.options?.allowDangerousEmailAccountLinking).toBeUndefined();
    expect(config.pages).toMatchObject({ signIn: "/login", error: "/login" });
  });

  it("records Google's verification on new accounts", () => {
    const profile = google.options!.profile as (p: Record<string, unknown>) => Record<string, unknown>;
    const base = { sub: "s", name: "N", email: "n@example.com", picture: "https://x/p.png" };
    expect(profile({ ...base, email_verified: true })).toMatchObject({ id: "s", email: "n@example.com", emailVerified: expect.any(Date) });
    expect(profile({ ...base, email_verified: false }).emailVerified).toBeNull();
  });

  it("refuses addresses Google hasn't verified", async () => {
    expect(await signIn({ user: { id: "sub-1" }, profile: { email_verified: false } })).toBe("/login?error=email_unverified");
  });

  it("lets new accounts in only while sign-ups are open", async () => {
    vi.mocked(prisma.account.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(isEnabled).mockResolvedValueOnce(false);
    expect(await signIn({ user: { id: "sub-1" } })).toBe("/login?error=signups_closed");
    expect(await signIn({ user: { id: "sub-1" } })).toBe(true);
  });

  it("keeps existing members in when sign-ups are paused, unless banned", async () => {
    vi.mocked(prisma.account.findUnique).mockResolvedValue({ userId: "u1" } as never);
    vi.mocked(isEnabled).mockResolvedValue(false);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ status: "ACTIVE" } as never);
    expect(await signIn({ user: { id: "u1" } })).toBe(true);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ status: "BANNED" } as never);
    expect(await signIn({ user: { id: "u1" } })).toBe("/login?error=account_disabled");
    vi.mocked(isEnabled).mockResolvedValue(true);
  });
});
