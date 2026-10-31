import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

const directive = (csp: string, name: string) => csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? "";

describe("content security policy", () => {
  const csp = proxy(new NextRequest("http://localhost/feed")).headers.get("content-security-policy")!;

  it("lets Google account photos load, and only from Google's photo host", () => {
    const img = directive(csp, "img-src");
    expect(img.split(" ")).toContain("https://lh3.googleusercontent.com");
    expect(img).not.toMatch(/\*|https:(\s|$)|http:/);
  });

  it("keeps scripts nonce-only and frames off", () => {
    expect(directive(csp, "script-src")).toMatch(/^script-src 'self' 'nonce-[^']+' 'strict-dynamic'$/);
    expect(directive(csp, "frame-src")).toBe("frame-src 'none'");
  });

  it("upgrades insecure requests on HTTPS (production) but not on plain-HTTP localhost", () => {
    const https = proxy(new NextRequest("https://resoniq.example/feed")).headers.get("content-security-policy")!;
    const proxied = proxy(new NextRequest("http://internal/feed", { headers: { "x-forwarded-proto": "https" } })).headers.get("content-security-policy")!;
    if (process.env.NODE_ENV !== "development") {
      expect(https).toContain("upgrade-insecure-requests");
      expect(proxied).toContain("upgrade-insecure-requests");
    }
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
});
