import { describe, expect, it } from "vitest";
import { evaluate } from "@/lib/automod";
import { parseCommunityInput, slugify } from "@/lib/communities";
import { parsePostInput } from "@/lib/posts";
import { hotRank } from "@/lib/ranking";
import { extractMentions, extractTags, tokenize } from "@/lib/rich-text";
import { parseReport } from "@/lib/reports";
import { ValidationError } from "@/lib/validation";

describe("rich text", () => {
  it("finds mentions, hashtags and urls without touching emails or anchors", () => {
    const tokens = tokenize("Hey @Mia_K, try #Fuzz at https://example.com/x. mail me@x.com or page#anchor");
    expect(tokens.filter((t) => t.type !== "text")).toEqual([
      { type: "mention", value: "@Mia_K", handle: "mia_k" },
      { type: "hashtag", value: "#Fuzz", tag: "fuzz" },
      { type: "url", value: "https://example.com/x", href: "https://example.com/x" },
    ]);
    expect(tokens.map((t) => t.value).join("")).toBe("Hey @Mia_K, try #Fuzz at https://example.com/x. mail me@x.com or page#anchor");
  });

  it("caps and dedupes tags and mentions", () => {
    expect(extractTags("#a1 #A1 #b2")).toEqual(["a1", "b2"]);
    expect(extractMentions(Array.from({ length: 15 }, (_, i) => `@user${i}x`).join(" "))).toHaveLength(10);
  });

  it("never yields markup tokens", () => {
    const tokens = tokenize('<script>alert(1)</script> "javascript:alert(1)"');
    expect(tokens.every((t) => t.type === "text")).toBe(true);
  });
});

describe("hotRank", () => {
  const t = new Date("2026-06-01T00:00:00Z");
  it("rises with score and with recency", () => {
    expect(hotRank(10, t)).toBeGreaterThan(hotRank(1, t));
    expect(hotRank(0, new Date(t.getTime() + 3_600_000))).toBeGreaterThan(hotRank(0, t));
    expect(hotRank(-10, t)).toBeLessThan(hotRank(0, t));
  });
  it("trades 10x score for 12.5 hours", () => {
    expect(hotRank(100, t)).toBeCloseTo(hotRank(10, new Date(t.getTime() + 45_000_000)), 5);
  });
});

describe("automod", () => {
  const old = { createdAt: new Date("2020-01-01") };
  const fresh = { createdAt: new Date() };
  const rules = [
    { kind: "BLOCKED_TERM" as const, label: "Blocked term", config: { terms: ["scam"] } },
    { kind: "LINK_HOLD_NEW_ACCOUNTS" as const, label: "New link", config: { hours: 24 } },
    { kind: "MAX_MENTIONS" as const, label: "Mentions", config: { max: 2 } },
  ];
  it("holds on whole-word blocked terms only", () => {
    expect(evaluate(rules, "This is a SCAM.", old).hold).toBe(true);
    expect(evaluate(rules, "scampi recipe", old).hold).toBe(false);
  });
  it("holds links from new accounts and mention floods", () => {
    expect(evaluate(rules, "see https://x.dev", fresh).reasons).toEqual(["New link"]);
    expect(evaluate(rules, "see https://x.dev", old).hold).toBe(false);
    expect(evaluate(rules, "@aaa @bbb @ccc", old).reasons).toEqual(["Mentions"]);
  });
});

describe("input parsing", () => {
  it("parses posts", () => {
    expect(parsePostInput({ title: "  Hi ", body: " text ", category: "COVER", community: "Blues" })).toEqual({
      title: "Hi",
      body: "text",
      category: "COVER",
      communitySlug: "blues",
      toneId: null,
    });
    expect(() => parsePostInput({ category: "MEME" })).toThrow(ValidationError);
    expect(() => parsePostInput({ body: "x".repeat(10_001) })).toThrow(ValidationError);
  });

  it("parses communities", () => {
    expect(slugify("Doom & Sludge!")).toBe("doom-sludge");
    expect(parseCommunityInput({ name: "Doom & Sludge" }).slug).toBe("doom-sludge");
    expect(() => parseCommunityInput({ name: "ab" })).toThrow(ValidationError);
    expect(() => parseCommunityInput({ name: "Admin stuff", slug: "admin" })).toThrow(ValidationError);
    expect(() => parseCommunityInput({ name: "Fine name", kind: "WHATEVER" })).toThrow(ValidationError);
  });

  it("asks copyright reports for details", () => {
    expect(() => parseReport({ targetType: "POST", targetId: "p", reason: "COPYRIGHT" })).toThrow(ValidationError);
    expect(parseReport({ targetType: "POST", targetId: "p", reason: "SPAM" })).toMatchObject({ reason: "SPAM", details: null });
  });
});
