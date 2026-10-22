import { beforeEach, describe, expect, it } from "vitest";
import { grantRole } from "@/scripts/grant-role";
import { makeUser, prisma, resetDb } from "./db";

beforeEach(resetDb);

describe("grantRole", () => {
  it("changes the role and writes one audit row in the same transaction", async () => {
    const user = await makeUser({ email: "Boss@Test.dev" });
    const result = await grantRole(prisma, { email: "boss@test.dev", role: "ADMIN" });
    expect(result.previous).toBe("USER");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).role).toBe("ADMIN");
    const logs = await prisma.auditLog.findMany();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ action: "user.role.grant", targetType: "User", targetId: user.id, actorId: null });
  });

  it("rejects an unknown email without writing anything", async () => {
    await expect(grantRole(prisma, { email: "nobody@test.dev", role: "ADMIN" })).rejects.toThrow("No user with that email.");
    expect(await prisma.auditLog.count()).toBe(0);
  });
});
