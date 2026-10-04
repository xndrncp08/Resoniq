import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimits } from "@/lib/rate-limit";
import { validRecipe } from "./fixtures";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const db = {
  user: { findFirst: vi.fn(), create: vi.fn() },
  song: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  tone: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: db }));

const storage = { driver: "local", put: vi.fn(), get: vi.fn(), remove: vi.fn() };
vi.mock("@/lib/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/storage")>()),
  getStorage: () => storage,
}));

const analyzeAudio = vi.fn();
vi.mock("@/lib/engine", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/engine")>()),
  analyzeAudio: (...args: unknown[]) => analyzeAudio(...args),
}));

const register = await import("@/app/api/register/route");
const tones = await import("@/app/api/tones/route");
const tone = await import("@/app/api/tones/[id]/route");
const upload = await import("@/app/api/upload/route");
const analyze = await import("@/app/api/analyze/route");
const audio = await import("@/app/api/songs/[id]/audio/route");
const { EngineError } = await import("@/lib/engine");

const json = (body: unknown, init: RequestInit = {}) =>
  new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    ...init,
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const signedIn = (id = "user-a") => authMock.mockResolvedValue({ user: { id } });

beforeEach(() => {
  vi.resetAllMocks();
  resetRateLimits();
  authMock.mockResolvedValue(null);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("auth guard", () => {
  it.each([
    ["GET /api/tones", () => tones.GET(new Request("http://localhost/api/tones"), undefined)],
    ["POST /api/tones", () => tones.POST(json({}), undefined)],
    ["PATCH /api/tones/[id]", () => tone.PATCH(json({}, { method: "PATCH" }), ctx("t"))],
    ["DELETE /api/tones/[id]", () => tone.DELETE(new Request("http://localhost", { method: "DELETE" }), ctx("t"))],
    ["POST /api/upload", () => upload.POST(new Request("http://localhost", { method: "POST" }), undefined)],
    ["POST /api/analyze", () => analyze.POST(json({ songId: "s" }), undefined)],
    ["GET /api/songs/[id]/audio", () => audio.GET(new Request("http://localhost"), ctx("s"))],
  ])("%s requires a session", async (_name, call) => {
    const res = await call();
    expect(res.status).toBe(401);
  });
});

describe("POST /api/register", () => {
  it("answers identically for new and existing emails", async () => {
    db.user.findFirst.mockResolvedValueOnce(null);
    const fresh = await register.POST(json({ email: "New@Example.com", password: "long-enough-1" }), undefined);
    db.user.findFirst.mockResolvedValueOnce({ id: "existing" });
    const existing = await register.POST(json({ email: "old@example.com", password: "long-enough-1" }), undefined);

    expect([fresh.status, existing.status]).toEqual([201, 201]);
    expect(await fresh.json()).toEqual(await existing.json());
    expect(db.user.create).toHaveBeenCalledTimes(1);
    expect(db.user.create.mock.calls[0][0].data.email).toBe("new@example.com");
  });

  it("validates input and rejects malformed JSON with 400", async () => {
    expect((await register.POST(json({ email: "nope", password: "long-enough-1" }), undefined)).status).toBe(400);
    expect((await register.POST(json({ email: "a@b.co", password: "short" }), undefined)).status).toBe(400);
    const bad = new Request("http://localhost", { method: "POST", body: "{not json" });
    expect((await register.POST(bad, undefined)).status).toBe(400);
  });

  it("rate limits per client IP", async () => {
    db.user.findFirst.mockResolvedValue({ id: "existing" });
    const req = () => json({ email: "a@b.co", password: "long-enough-1" }, { headers: { "x-forwarded-for": "198.51.100.4" } });
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await register.POST(req(), undefined)).status);
    expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
  });
});

describe("/api/tones", () => {
  it("scopes listing to the signed-in user", async () => {
    signedIn("user-a");
    db.tone.findMany.mockResolvedValue([]);
    await tones.GET(new Request("http://localhost/api/tones?q=plexi"), undefined);
    expect(db.tone.findMany.mock.calls[0][0].where.userId).toBe("user-a");
  });

  it("refuses to link a song the user doesn't own", async () => {
    signedIn("user-a");
    db.song.findFirst.mockResolvedValue(null);
    const res = await tones.POST(json({ name: "x", songId: "someone-elses", data: { version: 2, recipe: validRecipe() } }), undefined);
    expect(res.status).toBe(404);
    expect(db.song.findFirst.mock.calls[0][0].where).toEqual({ id: "someone-elses", userId: "user-a" });
    expect(db.tone.create).not.toHaveBeenCalled();
  });

  it("stores the validated recipe, not the raw payload", async () => {
    signedIn("user-a");
    db.tone.create.mockImplementation(async ({ data }) => ({ id: "t1", ...data }));
    const res = await tones.POST(json({ name: " Mine ", data: { version: 2, recipe: { ...validRecipe(), extra: "x" } } }), undefined);
    expect(res.status).toBe(201);
    const stored = db.tone.create.mock.calls[0][0].data;
    expect(stored.name).toBe("Mine");
    expect(stored.data.recipe).not.toHaveProperty("extra");
    expect(stored.data.recipe.amp.bass).toBe(0);
  });

  it("rejects invalid recipes with 400", async () => {
    signedIn();
    const res = await tones.POST(json({ name: "x", data: { version: 2, recipe: { pickup: "Bridge" } } }), undefined);
    expect(res.status).toBe(400);
  });

  it("updates and deletes only the owner's tone", async () => {
    signedIn("user-b");
    db.tone.updateMany.mockResolvedValue({ count: 0 });
    db.tone.deleteMany.mockResolvedValue({ count: 0 });
    expect((await tone.PATCH(json({ name: "pwned" }, { method: "PATCH" }), ctx("t1"))).status).toBe(404);
    expect((await tone.DELETE(new Request("http://localhost", { method: "DELETE" }), ctx("t1"))).status).toBe(404);
    expect(db.tone.updateMany.mock.calls[0][0].where).toEqual({ id: "t1", userId: "user-b" });
    expect(db.tone.deleteMany.mock.calls[0][0].where).toEqual({ id: "t1", userId: "user-b" });
  });
});

describe("POST /api/upload", () => {
  const form = (bytes: Uint8Array, name: string) => {
    const body = new FormData();
    body.append("file", new File([new Uint8Array(bytes)], name));
    return new Request("http://localhost/api/upload", { method: "POST", body });
  };
  const wav = new Uint8Array([...Buffer.from("RIFF\0\0\0\0WAVEfmt ", "latin1")]);

  it("decides the type from the bytes, not the filename", async () => {
    signedIn("user-a");
    const res = await upload.POST(form(new Uint8Array(Buffer.from("<html>")), "song.mp3"), undefined);
    expect(res.status).toBe(400);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it("stores under the user's prefix with the sniffed extension", async () => {
    signedIn("user-a");
    db.song.create.mockResolvedValue({ id: "s1" });
    const res = await upload.POST(form(wav, "Artist - Title.mp3"), undefined);
    expect(res.status).toBe(201);
    expect(storage.put.mock.calls[0][0]).toMatch(/^user-a\/[0-9a-f-]{36}\.wav$/);
    expect(db.song.create.mock.calls[0][0].data).toMatchObject({ userId: "user-a", artist: "Artist", title: "Title" });
  });

  it("removes the stored file if the database write fails", async () => {
    signedIn("user-a");
    db.song.create.mockRejectedValue(new Error("db down"));
    const res = await upload.POST(form(wav, "a.wav"), undefined);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Something went wrong. Try again." });
    expect(storage.remove).toHaveBeenCalledWith(storage.put.mock.calls[0][0]);
  });
});

describe("POST /api/analyze", () => {
  beforeEach(() => {
    signedIn("user-a");
    db.song.findFirst.mockResolvedValue({ id: "s1", userId: "user-a", storageKey: "user-a/x.wav" });
  });

  it("refuses to start a job that is already running", async () => {
    db.song.updateMany.mockResolvedValue({ count: 0 });
    expect((await analyze.POST(json({ songId: "s1" }), undefined)).status).toBe(409);
    expect(analyzeAudio).not.toHaveBeenCalled();
  });

  it("stores the engine's analysis", async () => {
    db.song.updateMany.mockResolvedValue({ count: 1 });
    storage.get.mockResolvedValue({ bytes: Buffer.from("x"), contentType: "audio/wav" });
    analyzeAudio.mockResolvedValue({ tone_profile: {}, raw_features: {} });
    db.song.update.mockResolvedValue({ id: "s1", status: "ANALYZED" });
    const res = await analyze.POST(json({ songId: "s1" }), undefined);
    expect(res.status).toBe(200);
    expect(db.song.update.mock.calls[0][0].data.status).toBe("ANALYZED");
  });

  it("records a generic error and never echoes engine internals", async () => {
    db.song.updateMany.mockResolvedValue({ count: 1 });
    storage.get.mockResolvedValue({ bytes: Buffer.from("x"), contentType: "audio/wav" });
    analyzeAudio.mockRejectedValue(new EngineError("connect ECONNREFUSED 10.0.0.3:8000", "Analysis is unavailable right now."));
    const res = await analyze.POST(json({ songId: "s1" }), undefined);
    expect(res.status).toBe(502);
    const body = JSON.stringify(await res.json());
    expect(body).not.toContain("10.0.0.3");
    expect(db.song.update.mock.calls[0][0].data).toEqual({ status: "FAILED", analysisError: "Analysis is unavailable right now." });
  });
});

describe("GET /api/songs/[id]/audio", () => {
  it("serves byte ranges of the owner's file, uncached", async () => {
    signedIn("user-a");
    db.song.findFirst.mockResolvedValue({ storageKey: "user-a/x.wav", fileUrl: null });
    storage.get.mockResolvedValue({ bytes: Buffer.from("0123456789"), contentType: "audio/wav" });
    const res = await audio.GET(new Request("http://localhost", { headers: { range: "bytes=2-4" } }), ctx("s1"));
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 2-4/10");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("234");
    expect(db.song.findFirst.mock.calls[0][0].where).toEqual({ id: "s1", userId: "user-a" });
  });
});
