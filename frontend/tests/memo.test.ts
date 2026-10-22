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
  it("does not discard a newer cache entry when an older request fails", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1000);
    let reject!: (error: Error) => void;
    const old = memo("race", 0, () => new Promise<number>((_resolve, fail) => { reject = fail; }));
    now.mockReturnValue(3000);
    expect(await memo("race", 1000, async () => 2)).toBe(2);
    reject(new Error("old load failed"));
    await expect(old).rejects.toThrow("old load failed");
    const load = vi.fn().mockResolvedValue(3);
    expect(await memo("race", 1000, load)).toBe(2);
    expect(load).not.toHaveBeenCalled();
    now.mockRestore();
  });
});
