import { describe, expect, it } from "vitest";
import { handleFromName, normalizeHandle } from "@/lib/handles";
import { ValidationError } from "@/lib/validation";

describe("handles", () => {
  it("normalizes case and a leading @", () => {
    expect(normalizeHandle("@Riff_Lord")).toBe("riff_lord");
  });

  it.each(["ab", "bad handle", "Admin", "x".repeat(31), 42])("rejects %s", (v) => {
    expect(() => normalizeHandle(v)).toThrow(ValidationError);
  });

  it("slugs display names", () => {
    expect(handleFromName("Jöhn Doe!")).toBe("john_doe");
    expect(handleFromName("🎸🎸")).toBeNull();
    expect(handleFromName("Settings")).toBeNull();
    expect(handleFromName("a".repeat(40))).toHaveLength(24);
    expect(handleFromName(null)).toBeNull();
  });
});
