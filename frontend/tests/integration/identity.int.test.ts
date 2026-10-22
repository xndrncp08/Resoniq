import { beforeEach, describe, expect, it } from "vitest";
import { assignHandle } from "@/lib/handles";
import { makeUser, prisma, resetDb } from "./db";

beforeEach(resetDb);

describe("identity schema", () => {
  it("gives new users a default handle", async () => {
    const user = await prisma.user.create({ data: { email: "x@test.dev" } });
    expect(user.handle).toMatch(/^u_[0-9a-f]{10}$/);
    expect(user.role).toBe("USER");
    expect(user.status).toBe("ACTIVE");
  });

  it("rejects handles that break the pattern at the database", async () => {
    const user = await makeUser();
    await expect(prisma.$executeRaw`UPDATE "User" SET handle = 'Bad Handle' WHERE id = ${user.id}`).rejects.toThrow();
  });

  it("assigns a suffixed handle when the base is taken", async () => {
    await makeUser({ handle: "riff" });
    expect(await assignHandle(prisma, "riff")).toBe("riff_2");
    await makeUser({ handle: "riff_2" });
    expect(await assignHandle(prisma, "riff")).toBe("riff_3");
  });
});
