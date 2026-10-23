import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/flags", () => ({ isEnabled: vi.fn(async () => true) }));
const { emailRequiredForSignup, mediaCapabilities, mediaWorkerAvailable, signupsOpen, storageAvailable } = await import("@/lib/hosting");
const { cronAuthorized } = await import("@/lib/jobs/drain");

afterEach(() => vi.unstubAllEnvs());
const env = (vars: Record<string, string>) => Object.entries(vars).forEach(([k, v]) => vi.stubEnv(k, v));

describe("hosting capabilities", () => {
  it("keeps everything on for a self-hosted server", async () => {
    env({ VERCEL: "" });
    expect(storageAvailable()).toBe(true);
    expect(mediaWorkerAvailable()).toBe(true);
    expect(await mediaCapabilities()).toMatchObject({ images: true, video: true, audio: true, note: null });
    expect(await signupsOpen()).toEqual({ open: true, reason: null });
  });

  it("turns uploads off on serverless without remote storage", async () => {
    env({ VERCEL: "1", SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "" });
    expect(await mediaCapabilities()).toMatchObject({ images: false, video: false, audio: false, analysis: false });
  });

  it("allows only images on serverless with storage but no worker", async () => {
    env({ VERCEL: "1", SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" });
    const caps = await mediaCapabilities();
    expect(caps).toMatchObject({ images: true, video: false, audio: false });
    expect(caps.note).toMatch(/Video and audio posts are paused/);
    env({ RESONIQ_MEDIA_WORKER: "on" });
    expect((await mediaCapabilities()).video).toBe(true);
  });

  it("keeps public registration closed until email can be delivered", async () => {
    env({ VERCEL: "1", RESEND_API_KEY: "", RESONIQ_EMAIL_FROM: "" });
    expect(emailRequiredForSignup()).toBe(true);
    expect((await signupsOpen()).open).toBe(false);
    env({ RESEND_API_KEY: "re_x", RESONIQ_EMAIL_FROM: "Resoniq <a@b.c>" });
    expect((await signupsOpen()).open).toBe(true);
  });
});

describe("cronAuthorized", () => {
  const req = (auth?: string) => new Request("http://x/api/cron/jobs", { headers: auth ? { authorization: auth } : {} });
  it("requires the exact bearer secret, and refuses everything without one", () => {
    env({ CRON_SECRET: "" });
    expect(cronAuthorized(req("Bearer "))).toBe(false);
    env({ CRON_SECRET: "s3cret" });
    expect(cronAuthorized(req("Bearer s3cret"))).toBe(true);
    expect(cronAuthorized(req("Bearer s3cre"))).toBe(false);
    expect(cronAuthorized(req())).toBe(false);
  });
});
