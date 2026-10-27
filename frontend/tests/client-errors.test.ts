import { describe, expect, it } from "vitest";
import { isNoise, parseClientError } from "@/lib/client-errors";

describe("browser error reports", () => {
  it("keeps the useful parts and strips anything that could identify someone", () => {
    const r = parseClientError({
      kind: "error",
      message: "Failed at https://resoniq.app/u/mia?token=abc#x",
      stack: "TypeError: x\n    at https://resoniq.app/_next/static/chunks/a.js?v=1:2:3",
      path: "/settings",
      digest: "12345",
    });
    expect(r).toEqual({ kind: "error", message: "Failed at /u/mia", stack: "TypeError: x\n    at /_next/static/chunks/a.js:2:3", path: "/settings", digest: "12345" });
  });

  it("caps sizes and rejects reports that aren't one", () => {
    expect(parseClientError({ kind: "error", message: "x".repeat(5000), path: "nope" })).toMatchObject({ message: "x".repeat(300), path: "/", stack: null });
    for (const bad of [null, {}, { kind: "error", message: "" }, { kind: "hack", message: "x" }]) expect(parseClientError(bad)).toBeNull();
    expect(parseClientError({ kind: "boundary", message: "x", digest: "<script>" })?.digest).toBeNull();
  });

  it("ignores browser-extension noise", () => {
    expect(isNoise("ResizeObserver loop completed with undelivered notifications.")).toBe(true);
    expect(isNoise("boom", "at chrome-extension://abc/content.js:1:1")).toBe(true);
    expect(isNoise("TypeError: t.cab[s].toFixed is not a function")).toBe(false);
  });
});
