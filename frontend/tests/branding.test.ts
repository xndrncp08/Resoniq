import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("production brand assets", () => {
  it("ships original app identity and photographic landing assets", () => {
    for (const file of ["brand/mark.svg", "brand/wordmark.svg", "brand/wordmark-dark.svg", "brand/og-studio.jpg", "brand/app-icon-180.png", "brand/app-icon-192.png", "brand/app-icon-512.png", "images/studio-guitar-1920.webp", "images/studio-bassist-1440.webp", "images/studio-pedals-768.webp"]) {
      expect(existsSync(`public/${file}`), file).toBe(true);
    }
  });
});
