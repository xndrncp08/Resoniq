import { beforeEach, expect, it, vi } from "vitest";
import { getActor } from "@/lib/authz";
import { requireStaffPage } from "@/lib/admin/page";
vi.mock("@/lib/authz", async (original) => ({ ...(await original<typeof import("@/lib/authz")>()), getActor: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("404"); } }));
beforeEach(() => vi.clearAllMocks());
it("allows staff back after a dated suspension expires and rejects live suspensions and bans", async () => {
  const actor = { id: "a", handle: "admin", role: "ADMIN" as const, status: "SUSPENDED" as const, suspendedUntil: new Date(0) };
  vi.mocked(getActor).mockResolvedValue(actor);
  await expect(requireStaffPage()).resolves.toEqual(actor);
  vi.mocked(getActor).mockResolvedValue({ ...actor, suspendedUntil: null });
  await expect(requireStaffPage()).rejects.toThrow("404");
  vi.mocked(getActor).mockResolvedValue({ ...actor, status: "BANNED" });
  await expect(requireStaffPage()).rejects.toThrow("404");
});
