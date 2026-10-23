import { describe, expect, it, vi } from "vitest";
vi.mock("@/auth", () => ({ auth: vi.fn() }));
import { isSuspended } from "@/lib/authz";
import { can } from "@/lib/permissions";

describe("permissions", () => {
  it("keeps platform powers with admins", () => {
    expect(can("MODERATOR", "users.ban")).toBe(false);
    expect(can("MODERATOR", "content.moderate")).toBe(true);
    expect(can("ADMIN", "users.roles")).toBe(true);
    expect(can("USER", "content.moderate")).toBe(false);
  });
});

describe("isSuspended", () => {
  const now = new Date("2026-10-22T00:00:00Z");
  it("honors open-ended and dated suspensions, and lets expired ones lapse", () => {
    expect(isSuspended({ status: "SUSPENDED", suspendedUntil: null }, now)).toBe(true);
    expect(isSuspended({ status: "SUSPENDED", suspendedUntil: new Date("2026-10-23T00:00:00Z") }, now)).toBe(true);
    expect(isSuspended({ status: "SUSPENDED", suspendedUntil: new Date("2026-10-21T00:00:00Z") }, now)).toBe(false);
    expect(isSuspended({ status: "ACTIVE", suspendedUntil: null }, now)).toBe(false);
  });
});

describe("session version", () => {
  it("rejects a forged session for a managed system identity", async () => {
    const { auth } = await import("@/auth");
    const { getActor } = await import("@/lib/authz");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(auth).mockResolvedValue({ user: { id: "system", sv: 0 }, expires: "" } as never);
    vi.spyOn(prisma.user, "findUnique").mockResolvedValue({ id: "system", kind: "SYSTEM", role: "ADMIN", status: "ACTIVE", sessionVersion: 0 } as never);
    expect(await getActor()).toBeNull();
  });
  it("treats sessions issued before a password reset as signed out", async () => {
    const { auth } = await import("@/auth");
    const { getActor } = await import("@/lib/authz");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1", sv: 0 }, expires: "" } as never);
    vi.spyOn(prisma.user, "findUnique").mockResolvedValue({ id: "u1", handle: "a", role: "USER", status: "ACTIVE", suspendedUntil: null, sessionVersion: 1 } as never);
    expect(await getActor()).toBeNull();
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1", sv: 1 }, expires: "" } as never);
    expect(await getActor()).toMatchObject({ id: "u1" });
  });
});
