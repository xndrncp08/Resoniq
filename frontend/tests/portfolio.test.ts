import { describe, expect, it } from "vitest";
import { tokenize, withTimestamps } from "@/lib/rich-text";
import { sanitizeDrafts } from "@/lib/stores/drafts";
import { parseRig } from "@/lib/portfolio";
import { parseMusicianFilters, musicianDirectoryHref } from "@/lib/musician-directory";

const times = (text: string) => withTimestamps(tokenize(text)).flatMap((t) => (t.type === "time" ? [[t.value, t.seconds]] : []));

describe("time-coded feedback", () => {
  it("finds m:ss and h:mm:ss moments", () => {
    expect(times("The bend at 1:24 and the outro at 1:02:05, then 0:07.")).toEqual([["1:24", 84], ["1:02:05", 3725], ["0:07", 7]]);
  });

  it("leaves ratios, clock times, scores and links alone", () => {
    expect(times("Shot in 16:9, gig at 10:30am, won 3:2, ratio 4:3, see https://x.dev/a?t=1:24")).toEqual([]);
    expect(times("at 1:60 or 1:99:00")).toEqual([]);
  });

  it("keeps the rest of the text, mentions and tags intact", () => {
    const tokens = withTimestamps(tokenize("@mia check 2:10 #vibrato"));
    expect(tokens.map((t) => t.type)).toEqual(["mention", "text", "time", "text", "hashtag"]);
    expect(tokens.map((t) => t.value).join("")).toBe("@mia check 2:10 #vibrato");
  });
});

describe("drafts from localStorage", () => {
  it("keeps well-formed drafts and clips oversized fields", () => {
    const out = sanitizeDrafts({ cmuser0000001: { title: "t".repeat(500), body: "riff", category: "QUESTION", community: "metal", toneId: 5, savedAt: 1 } });
    expect(out.cmuser0000001).toEqual({ title: "t".repeat(200), body: "riff", category: "QUESTION", community: "metal", toneId: "", savedAt: 1 });
  });

  it("drops junk, empty drafts and odd keys", () => {
    expect(sanitizeDrafts({ "../x": { body: "a" }, cmuser0000002: { body: "  " }, cmuser0000003: "nope" })).toEqual({});
    expect(sanitizeDrafts(null)).toEqual({});
  });
});

describe("rig input", () => {
  it("trims notes, rejects duplicates and caps the length", () => {
    expect(parseRig({ items: [{ gearId: "g1", note: "  always on " }, { gearId: "g2", note: "" }] })).toEqual([{ gearId: "g1", note: "always on" }, { gearId: "g2", note: null }]);
    expect(() => parseRig({ items: [{ gearId: "g1" }, { gearId: "g1" }] })).toThrow();
    expect(() => parseRig({ items: Array.from({ length: 25 }, (_, i) => ({ gearId: `g${i}` })) })).toThrow();
    expect(() => parseRig({ items: [{ gearId: "g1", note: "x".repeat(81) }] })).toThrow();
    expect(() => parseRig({ items: "g1" })).toThrow();
  });
});

describe("open-to filter", () => {
  it("accepts known options only and keeps them when paging", () => {
    expect(parseMusicianFilters({ open: "band" }).open).toBe("band");
    expect(parseMusicianFilters({ open: "toString" }).open).toBeUndefined();
    expect(musicianDirectoryHref({ open: "band", genre: "metal" })).toBe("/musicians?genre=metal&open=band");
  });
});
