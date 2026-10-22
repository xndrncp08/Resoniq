import { describe, expect, it, vi } from "vitest";
import type { NextAuthConfig } from "next-auth";
const capture = vi.hoisted(() => vi.fn());
vi.mock("next-auth", async (original) => ({ ...(await original<typeof import("next-auth")>()), default: (config: NextAuthConfig) => { capture(config); return {}; } }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
await import("@/auth");
import { prisma } from "@/lib/prisma";
const config = capture.mock.calls[0][0] as NextAuthConfig;

describe("credential session revocation", () => {
  it("retains the password snapshot version if a reset races with login", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ sessionVersion: 2 } as never);
    const token = await config.callbacks!.jwt!({ token: {}, user: { id: "u", sv: 1 } } as never);
    expect(token).toMatchObject({ id: "u", sv: 1 });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
