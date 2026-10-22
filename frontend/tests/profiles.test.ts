import { describe, expect, it } from "vitest";
import { parseProfilePatch } from "@/lib/profile-validation";
import { decodeCursor, encodeCursor, parseLimit } from "@/lib/pagination";
import { ValidationError } from "@/lib/validation";

describe("parseProfilePatch", () => {
  it("accepts and normalizes a full profile", () => {
    expect(
      parseProfilePatch({
        name: "  Mia ",
        handle: "@NewName",
        bio: " Plays loud. ",
        instruments: ["bass", "bass", "electric-guitar"],
        genres: ["Doom", "post-rock"],
        links: [{ label: "Site", url: "https://mia.example/" }],
        role: "ADMIN",
      }),
    ).toEqual({
      name: "Mia",
      handle: "newname",
      bio: "Plays loud.",
      instruments: ["bass", "electric-guitar"],
      genres: ["doom", "post-rock"],
      links: [{ label: "Site", url: "https://mia.example/" }],
    });
  });

  it.each([
    { links: [{ label: "x", url: "javascript:alert(1)" }] },
    { links: [{ label: "x", url: "not a url" }] },
    { instruments: ["kazoo"] },
    { bio: "x".repeat(501) },
    { genres: Array.from({ length: 9 }, (_, i) => `g${i}`) },
    { handle: "admin" },
  ])("rejects %j", (body) => {
    expect(() => parseProfilePatch(body)).toThrow(ValidationError);
  });

  it("clears optional text with null or blank", () => {
    expect(parseProfilePatch({ bio: "   ", name: null })).toEqual({ bio: null, name: null });
  });
});

describe("pagination", () => {
  it("round-trips cursors and rejects garbage", () => {
    const c = { t: "2026-10-22T00:00:00.000Z", id: "abc" };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
    expect(decodeCursor(null)).toBeNull();
    expect(() => decodeCursor("%%%")).toThrow();
  });

  it("caps limits", () => {
    expect(parseLimit("500")).toBe(50);
    expect(parseLimit(null)).toBe(20);
    expect(parseLimit("-3")).toBe(20);
  });
});
