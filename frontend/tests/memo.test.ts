import { describe, expect, it, vi } from "vitest";
import { memo } from "@/lib/memo";

describe("memo", () => {
  it("serves cached values within the TTL and retries after a failure", async () => {
    const load = vi.fn().mockResolvedValue(1);
    expect(await memo("k", 1000, load)).toBe(1);
    expect(await memo("k", 1000, load)).toBe(1);
    expect(load).toHaveBeenCalledTimes(1);
    const bad = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue(2);
    await expect(memo("b", 1000, bad)).rejects.toThrow("down");
    expect(await memo("b", 1000, bad)).toBe(2);
  });
});
