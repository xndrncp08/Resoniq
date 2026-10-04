import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { normalizeEmail, passwordProblem } from "@/lib/credentials";
import { parseRange } from "@/lib/http-range";
import { clientIp, rateLimit, resetRateLimits } from "@/lib/rate-limit";
import { safeCallbackPath } from "@/lib/safe-redirect";
import { localStorageDriver, sniffAudio } from "@/lib/storage";
import { parseStoredToneData, ValidationError } from "@/lib/tone-validation";
import { recipeFromStoredTone, songAudioUrl } from "@/lib/tone-recipe";
import { validRecipe } from "./fixtures";

describe("tone validation", () => {
  it("clamps knobs, trims text and renumbers slots", () => {
    const { recipe } = parseStoredToneData({ version: 2, recipe: validRecipe() });
    expect(recipe.confidenceScore).toBe(100);
    expect(recipe.amp.gain).toBe(71);
    expect(recipe.amp.bass).toBe(0);
    expect(recipe.recipeDescription).toBe("Plexi crunch.");
    expect(recipe.pedalboard.map((p) => p.slot)).toEqual([1, 2]);
    expect(recipe.pedalboard[1]).not.toHaveProperty("drive");
  });

  it.each([
    ["wrong version", { version: 1, recipe: validRecipe() }],
    ["unknown pickup", { version: 2, recipe: { ...validRecipe(), pickup: "Bridge<script>" } }],
    ["unknown pedal type", { version: 2, recipe: { ...validRecipe(), pedalboard: [{ name: "x", type: "laser", enabled: true }] } }],
    ["too many pedals", { version: 2, recipe: { ...validRecipe(), pedalboard: Array(13).fill(validRecipe().pedalboard[0]) } }],
    ["non-numeric knob", { version: 2, recipe: { ...validRecipe(), amp: { ...validRecipe().amp, gain: "11" } } }],
    ["oversized text", { version: 2, recipe: { ...validRecipe(), similarArtists: ["x".repeat(201)] } }],
    ["not an object", "hello"],
  ])("rejects %s", (_label, input) => {
    expect(() => parseStoredToneData(input)).toThrow(ValidationError);
  });
});

describe("rate limit", () => {
  beforeEach(() => resetRateLimits());

  it("allows up to the limit per key and window, then reports retry-after", () => {
    const rule = { limit: 2, windowMs: 1000 };
    expect(rateLimit("b", "k", rule, 0).ok).toBe(true);
    expect(rateLimit("b", "k", rule, 10).ok).toBe(true);
    expect(rateLimit("b", "k", rule, 20)).toEqual({ ok: false, retryAfterS: 1 });
    expect(rateLimit("b", "other", rule, 20).ok).toBe(true);
    expect(rateLimit("b", "k", rule, 1001).ok).toBe(true);
  });

  it("keys on the proxy-added (rightmost) x-forwarded-for entry", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "6.6.6.6, 203.0.113.7" } });
    expect(clientIp(req)).toBe("203.0.113.7");
  });
});

describe("credentials", () => {
  it("normalizes email and rejects junk", () => {
    expect(normalizeEmail("  Me@Example.COM ")).toBe("me@example.com");
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(normalizeEmail(42)).toBeNull();
  });

  it("enforces bcrypt's 72-byte limit instead of silently truncating", () => {
    expect(passwordProblem("short")).toMatch(/at least/);
    expect(passwordProblem("a".repeat(72))).toBeNull();
    expect(passwordProblem("é".repeat(40))).toMatch(/at most/); // 80 bytes
  });
});

describe("safeCallbackPath", () => {
  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", undefined])("rejects %s", (v) => {
    expect(safeCallbackPath(v, "/fallback")).toBe("/fallback");
  });
  it("keeps same-origin paths", () => expect(safeCallbackPath("/analyze/abc?x=1")).toBe("/analyze/abc?x=1"));
});

describe("sniffAudio", () => {
  const bytes = (s: string, extra: number[] = []) => new Uint8Array([...Buffer.from(s, "latin1"), ...extra]);
  it("identifies containers from magic bytes", () => {
    expect(sniffAudio(bytes("RIFF\0\0\0\0WAVEfmt "))).toBe("wav");
    expect(sniffAudio(bytes("fLaC\0\0"))).toBe("flac");
    expect(sniffAudio(bytes("ID3\x04"))).toBe("mp3");
    expect(sniffAudio(new Uint8Array([0xff, 0xfb, 0x90, 0x00]))).toBe("mp3");
  });
  it("rejects everything else", () => {
    expect(sniffAudio(bytes("<html>"))).toBeNull();
    expect(sniffAudio(bytes("RIFF\0\0\0\0AVI "))).toBeNull();
    expect(sniffAudio(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
  });
});

describe("local storage driver", () => {
  it("round-trips files and refuses keys outside the expected shape", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "resoniq-storage-"));
    const storage = localStorageDriver(root);
    await storage.put("user1/abc.wav", Buffer.from("data"), "audio/wav");
    expect((await storage.get("user1/abc.wav"))?.bytes.toString()).toBe("data");
    expect(await readFile(path.join(root, "user1/abc.wav"), "utf8")).toBe("data");
    expect(await storage.get("user1/missing.wav")).toBeNull();
    await expect(storage.get("../etc/passwd")).rejects.toThrow(/Invalid storage key/);
    await expect(storage.put("user1/../../x.wav", Buffer.from(""), "audio/wav")).rejects.toThrow(/Invalid storage key/);
    await storage.remove("user1/abc.wav");
    expect(await storage.get("user1/abc.wav")).toBeNull();
  });
});

describe("parseRange", () => {
  it.each([
    ["bytes=0-99", 1000, { start: 0, end: 99 }],
    ["bytes=900-", 1000, { start: 900, end: 999 }],
    ["bytes=-100", 1000, { start: 900, end: 999 }],
    ["bytes=0-5000", 1000, { start: 0, end: 999 }],
    ["bytes=2000-", 1000, "invalid"],
    ["bytes=0-1,5-9", 1000, null],
    [null, 1000, null],
  ] as const)("%s of %d", (header, size, expected) => {
    expect(parseRange(header, size)).toEqual(expected);
  });
});

describe("recipeFromStoredTone", () => {
  it("routes audio through the owner-checked endpoint and ignores unknown data", () => {
    const tone = { id: "t1", name: "Mine", favorite: true, createdAt: "2026-01-01T00:00:00.000Z" };
    const song = { id: "s/1", title: "Song", artist: "Artist", createdAt: "2026-01-01T00:00:00.000Z" };
    const data = parseStoredToneData({ version: 2, recipe: validRecipe() });
    expect(recipeFromStoredTone({ ...tone, data }, song)?.audioUrl).toBe(songAudioUrl("s/1"));
    expect(songAudioUrl("s/1")).toBe("/api/songs/s%2F1/audio");
    expect(recipeFromStoredTone({ ...tone, data: { junk: true } }, null)).toBeNull();
  });
});
