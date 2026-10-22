import { describe, expect, it } from "vitest";
import { backoffMs } from "@/lib/jobs/queue";

describe("backoffMs", () => {
  it("doubles from 30s and caps at an hour", () => {
    expect(backoffMs(1)).toBe(30_000);
    expect(backoffMs(3)).toBe(120_000);
    expect(backoffMs(20)).toBe(3_600_000);
  });
});
