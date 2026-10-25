import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { avatarPath, DEFAULT_AVATARS, isDefaultAvatarPath, isGooglePhoto, parseAvatarChoice } from "@/lib/avatars";
import { PHOTO_CREDITS } from "@/lib/photo-credits";

describe("default avatars", () => {
  it("ships 15–25 originals, each with a file and a label", () => {
    expect(DEFAULT_AVATARS.length).toBeGreaterThanOrEqual(15);
    expect(DEFAULT_AVATARS.length).toBeLessThanOrEqual(25);
    expect(new Set(DEFAULT_AVATARS.map((a) => a.id)).size).toBe(DEFAULT_AVATARS.length);
    for (const a of DEFAULT_AVATARS) {
      const file = path.join("public", avatarPath(a.id));
      expect(fs.existsSync(file), file).toBe(true);
      expect(fs.statSync(file).size).toBeLessThan(20 * 1024);
      expect(a.label.length).toBeGreaterThan(3);
    }
  });

  it("only accepts known choices", () => {
    expect(parseAvatarChoice("preset:basalt-tubes")).toBe("preset:basalt-tubes");
    expect(parseAvatarChoice("google")).toBe("google");
    for (const bad of ["preset:../../etc", "preset:", "https://evil.example/a.png", "/avatars/basalt-tubes.webp", 42, null]) expect(parseAvatarChoice(bad)).toBeNull();
    expect(isDefaultAvatarPath(avatarPath("pedal-ember"))).toBe(true);
    expect(isDefaultAvatarPath("/avatars/unknown.webp")).toBe(false);
  });

  it("recognises only Google's photo host", () => {
    expect(isGooglePhoto("https://lh3.googleusercontent.com/a/abc=s96-c")).toBe(true);
    for (const bad of ["http://lh3.googleusercontent.com/a", "https://lh3.googleusercontent.com.evil.example/a", "https://evil.example/lh3.googleusercontent.com/a"]) expect(isGooglePhoto(bad)).toBe(false);
  });
});

describe("landing photography", () => {
  it("credits every photo file that ships, and every credited file exists", () => {
    for (const c of PHOTO_CREDITS) {
      const dir = path.join("public/images", path.dirname(c.file));
      const base = path.basename(c.file);
      expect(fs.readdirSync(dir).some((f) => f.startsWith(`${base}-`)), c.file).toBe(true);
    }
    for (const f of fs.readdirSync("public/images/musicians")) expect(PHOTO_CREDITS.some((c) => f.startsWith(path.basename(c.file) + "-")), f).toBe(true);
  });
});
