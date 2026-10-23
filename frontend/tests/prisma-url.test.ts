import { describe, expect, it } from "vitest";
import { poolerSafeUrl } from "@/lib/prisma";

describe("poolerSafeUrl", () => {
  const pooler = "postgresql://postgres.ref:p%40ss@aws-0-us-east-1.pooler.supabase.com:6543/postgres";

  it("adds PgBouncer mode for Supabase's transaction pooler, keeping the encoded password", () => {
    const url = new URL(poolerSafeUrl(pooler)!);
    expect(url.password).toBe("p%40ss");
    expect(url.searchParams.get("pgbouncer")).toBe("true");
    expect(url.searchParams.get("connection_limit")).toBe("1");
  });

  it("keeps settings the URL already has", () => {
    const url = new URL(poolerSafeUrl(`${pooler}?pgbouncer=true&connection_limit=3`)!);
    expect(url.searchParams.get("connection_limit")).toBe("3");
  });

  it("leaves other databases, the session pooler and bad input alone", () => {
    for (const u of ["postgresql://u:p@localhost:5432/db", pooler.replace(":6543", ":5432"), "not a url", undefined]) {
      expect(poolerSafeUrl(u)).toBe(u);
    }
  });
});
