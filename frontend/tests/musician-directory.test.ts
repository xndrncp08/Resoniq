import { describe, expect, it } from "vitest";
import { musicianDirectoryHref, parseMusicianFilters } from "@/lib/musician-directory";
import { INSTRUMENTS } from "@/lib/instruments";
import { parseProfilePatch } from "@/lib/profile-validation";

describe("musician discovery filters", () => {
  it("normalizes profile interests and handles, and caps input", () => {
    expect(parseMusicianFilters({ q: " @Mia ", instrument: "woodwinds", genre: " JAZZ ", after: "mia_01" })).toEqual({ q: "Mia", instrument: "woodwinds", genre: "jazz", after: "mia_01" });
    expect(parseMusicianFilters({ q: "x".repeat(300), genre: "x".repeat(300) })).toMatchObject({ q: "x".repeat(100), genre: "x".repeat(24) });
  });

  it("ignores repeated, invalid and unrelated query fields", () => {
    expect(parseMusicianFilters({ q: ["one", "two"], instrument: "toString", genre: ["jazz"], after: "../../settings", email: "private" })).toEqual({ q: "", instrument: undefined, genre: "", after: "" });
    expect(parseMusicianFilters({ instrument: ["bass", "drums"], after: ["mia_01"] }).instrument).toBeUndefined();
  });

  it("preserves filters when paging and safely encodes literal search text", () => {
    const filters = parseMusicianFilters({ q: "Mia & Jo", instrument: "bass", genre: "post rock", after: "mia_01" });
    const url = new URL(musicianDirectoryHref(filters), "https://resoniq.test");
    expect(Object.fromEntries(url.searchParams)).toEqual(filters);
    expect(musicianDirectoryHref()).toBe("/musicians");
    expect(musicianDirectoryHref({ ...filters, after: "" })).not.toContain("after=");
  });

  it.each(INSTRUMENTS)("accepts the %s profile option without changing stored values", (instrument) => {
    expect(parseProfilePatch({ instruments: [instrument] })).toEqual({ instruments: [instrument] });
  });

  it("still enforces the four-instrument limit", () => {
    expect(() => parseProfilePatch({ instruments: ["bass", "drums", "strings", "brass", "woodwinds"] })).toThrow("up to 4");
  });
});
