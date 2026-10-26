import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimits } from "@/lib/rate-limit";
import { isEnabled } from "@/lib/flags";
import { validRecipe } from "./fixtures";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/flags", () => ({ isEnabled: vi.fn() }));

const db = {
  user: { findFirst: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  follow: { findUnique: vi.fn() },
  toneGear: { deleteMany: vi.fn(), createMany: vi.fn() },
  gearItem: { count: vi.fn() },
  $transaction: vi.fn(),
  song: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  tone: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: db }));

const storage = { driver: "local", put: vi.fn(), get: vi.fn(), remove: vi.fn() };
vi.mock("@/lib/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/storage")>()),
  getStorage: () => storage,
}));

const analyzeAudio = vi.fn();
const analyzeAudioStream = vi.fn();
const engineHealthy = vi.fn();
vi.mock("@/lib/engine", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/engine")>()),
  analyzeAudio: (...args: unknown[]) => analyzeAudio(...args),
  analyzeAudioStream: (...args: unknown[]) => analyzeAudioStream(...args),
  engineHealthy: (...args: unknown[]) => engineHealthy(...args),
}));

const register = await import("@/app/api/register/route");
const tones = await import("@/app/api/tones/route");
const tone = await import("@/app/api/tones/[id]/route");
const upload = await import("@/app/api/upload/route");
const analyze = await import("@/app/api/analyze/route");
const audio = await import("@/app/api/songs/[id]/audio/route");
const songStatus = await import("@/app/api/songs/[id]/route");
const users = await import("@/app/api/users/[handle]/route");
const followRoute = await import("@/app/api/users/[handle]/follow/route");
const me = await import("@/app/api/me/route");
const { EngineError } = await import("@/lib/engine");
const { ANALYSIS_FAILURES } = await import("@/lib/analysis-errors");

const json = (body: unknown, { headers, ...init }: Omit<RequestInit, "headers"> & { headers?: Record<string, string> } = {}) =>
  new Request("http://localhost/api", {
    method: "POST",
    body: JSON.stringify(body),
    ...init,
    headers: { "content-type": "application/json", ...headers },
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const hctx = (handle: string) => ({ params: Promise.resolve({ handle }) });
const actor = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  handle: id.replace(/-/g, "_"),
  role: "USER",
  status: "ACTIVE",
  suspendedUntil: null,
  ...extra,
});
const signedIn = (id = "user-a", extra: Record<string, unknown> = {}) => {
  authMock.mockResolvedValue({ user: { id } });
  db.user.findUnique.mockResolvedValue(actor(id, extra));
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(isEnabled).mockResolvedValue(true);
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db));
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
    ["GET /api/songs/[id]", () => songStatus.GET(new Request("http://localhost"), ctx("s"))],
  ])("%s requires a session", async (_name, call) => {
    const res = await call();
    expect(res.status).toBe(401);
  });
});

describe("account status", () => {
  it("refuses writes from a banned user with a valid session", async () => {
    signedIn("user-a", { status: "BANNED" });
    const res = await tones.POST(json({ name: "x", recipe: validRecipe() }), undefined);
    expect(res.status).toBe(403);
    expect(db.tone.create).not.toHaveBeenCalled();
  });

  it("lets a suspended user read but not write", async () => {
    signedIn("user-a", { status: "SUSPENDED", suspendedUntil: new Date(Date.now() + 86_400_000) });
    db.tone.findMany.mockResolvedValue([]);
    expect((await tones.GET(new Request("http://localhost/api/tones"), undefined)).status).toBe(200);
    const res = await tones.POST(json({ name: "x", recipe: validRecipe() }), undefined);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/suspended until \d{4}-\d{2}-\d{2}/);
  });

  it("treats a session for a deleted user as signed out", async () => {
    authMock.mockResolvedValue({ user: { id: "gone" } });
    db.user.findUnique.mockResolvedValue(null);
    expect((await tones.GET(new Request("http://localhost/api/tones"), undefined)).status).toBe(401);
  });
});

describe("POST /api/register", () => {
  it("honors the administrator signup switch before creating an account", async () => {
    vi.mocked(isEnabled).mockResolvedValue(false);
    expect((await register.POST(json({ email: "a@b.co", password: "long-enough-1" }), undefined)).status).toBe(503);
    expect(db.user.create).not.toHaveBeenCalled();
  });
  it("answers identically for new and existing emails", async () => {
    db.user.create.mockResolvedValue({ id: "new-user" });
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
    const bad = new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body: "{not json" });
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
    db.tone.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "t1", ...data }));
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
    db.tone.findFirst.mockResolvedValue(null);
    db.tone.deleteMany.mockResolvedValue({ count: 0 });
    expect((await tone.PATCH(json({ name: "pwned" }, { method: "PATCH" }), ctx("t1"))).status).toBe(404);
    expect((await tone.DELETE(new Request("http://localhost", { method: "DELETE" }), ctx("t1"))).status).toBe(404);
    expect(db.tone.findFirst.mock.calls[0][0].where).toMatchObject({ id: "t1", userId: "user-b" });
    expect(db.tone.update).not.toHaveBeenCalled();
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

describe("GET /api/songs/[id]", () => {
  it("exposes an abandoned analysis as retryable to its owner without caching it", async () => {
    signedIn("user-a");
    db.song.findFirst.mockResolvedValue({ id: "s1", status: "ANALYZING", analysisStartedAt: new Date(0), analysisError: null });
    const res = await songStatus.GET(new Request("http://localhost"), ctx("s1"));
    expect(res.status).toBe(200);
    expect((await res.json()).song).toMatchObject({ status: "FAILED", analysisError: "The analysis engine stopped partway through this recording." });
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(db.song.findFirst.mock.calls[0][0].where).toEqual({ id: "s1", userId: "user-a" });
    expect(db.song.update).not.toHaveBeenCalled();
  });

  it("does not reveal missing or unowned songs", async () => {
    signedIn();
    db.song.findFirst.mockResolvedValue(null);
    expect((await songStatus.GET(new Request("http://localhost"), ctx("other"))).status).toBe(404);
  });
});

describe("cross-site protection", () => {
  it("uses the configured public origin even if forwarded headers are forged", async () => {
    vi.stubEnv("AUTH_URL", "https://resoniq.example");
    try {
      const req = json({}, { headers: { origin: "https://evil.example", host: "evil.example", "x-forwarded-host": "evil.example" } });
      expect((await register.POST(req, undefined)).status).toBe(403);
    } finally { vi.unstubAllEnvs(); }
  });
  it("refuses mutations from another origin", async () => {
    signedIn("user-a");
    const req = json({ name: "x" }, { headers: { origin: "https://evil.example", host: "localhost:3000" } });
    expect((await tones.POST(req, undefined)).status).toBe(403);
    expect(db.tone.create).not.toHaveBeenCalled();
  });

  it("allows same-origin browser requests", async () => {
    db.user.findFirst.mockResolvedValue({ id: "existing" });
    const req = json(
      { email: "a@b.co", password: "long-enough-1" },
      { headers: { origin: "http://localhost:3000", host: "localhost:3000" } },
    );
    expect((await register.POST(req, undefined)).status).toBe(201);
  });

  it("rejects non-JSON bodies on JSON routes (no cross-site form posts)", async () => {
    signedIn("user-a");
    const req = new Request("http://localhost/api/tones", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
    expect((await tones.POST(req, undefined)).status).toBe(415);
  });
});

describe("POST /api/analyze (streaming)", () => {
  const streamReq = () =>
    json({ songId: "s1" }, { headers: { accept: "application/x-ndjson" } });
  const readAll = async (res: Response) => (await res.text()).trim().split("\n").map((l) => JSON.parse(l));

  beforeEach(() => {
    signedIn("user-a");
    db.song.findFirst.mockResolvedValue({ id: "s1", userId: "user-a", storageKey: "user-a/x.wav" });
    db.song.updateMany.mockResolvedValue({ count: 1 });
    storage.get.mockResolvedValue({ bytes: Buffer.from("x"), contentType: "audio/wav" });
  });

  it("relays engine stages in order, then the saved song", async () => {
    analyzeAudioStream.mockImplementation(async (_b, _f, _c, onStage: (e: unknown) => void) => {
      onStage({ type: "stage", stage: "decoding", index: 0, total: 9 });
      onStage({ type: "stage", stage: "inference", index: 7, total: 9 });
      return { tone_profile: {}, raw_features: {} };
    });
    db.song.update.mockResolvedValue({ id: "s1", status: "ANALYZED", analysisData: {} });
    const res = await analyze.POST(streamReq(), undefined);
    expect(res.headers.get("content-type")).toBe("application/x-ndjson");
    const events = await readAll(res);
    expect(events.map((e) => e.stage ?? e.type)).toEqual(["decoding", "inference", "done"]);
    expect(events.at(-1).song.status).toBe("ANALYZED");
    expect(db.song.update.mock.calls[0][0].data.status).toBe("ANALYZED");
    expect(analyzeAudio).not.toHaveBeenCalled();
  });

  it("reports engine failures in-band with the safe message and marks the song failed", async () => {
    analyzeAudioStream.mockRejectedValue(new EngineError("socket hang up at 10.0.0.3", "Analysis was interrupted. Try again."));
    const events = await readAll(await analyze.POST(streamReq(), undefined));
    expect(events).toEqual([{ type: "error", error: "Analysis was interrupted. Try again." }]);
    expect(JSON.stringify(events)).not.toContain("10.0.0.3");
    expect(db.song.update.mock.calls[0][0].data.status).toBe("FAILED");
  });

  it("ends the stream with a safe error even when saving the failure also fails", async () => {
    analyzeAudioStream.mockRejectedValue(new Error("engine unavailable"));
    db.song.update.mockRejectedValue(new Error("database unavailable"));
    const events = await readAll(await analyze.POST(streamReq(), undefined));
    expect(events).toEqual([{ type: "error", error: ANALYSIS_FAILURES.engine }]);
  });

  it("reports persistence failures instead of claiming the analysis was saved", async () => {
    analyzeAudioStream.mockResolvedValue({ tone_profile: {}, raw_features: {} });
    db.song.update.mockRejectedValue(new Error("database unavailable"));
    const events = await readAll(await analyze.POST(streamReq(), undefined));
    expect(events).toEqual([{ type: "error", error: ANALYSIS_FAILURES.engine }]);
  });

  it("waits out an engine restart and runs the same job once more, without a second claim or record", async () => {
    // Production: the engine was killed mid-analysis, then answered 502 while it rebooted.
    analyzeAudioStream
      .mockRejectedValueOnce(new EngineError("python-engine stream ended without a result", ANALYSIS_FAILURES.interrupted, true))
      .mockImplementationOnce(async (_b, _f, _c, onStage: (e: unknown) => void) => {
        onStage({ type: "stage", stage: "decoding", index: 0, total: 9 });
        return { tone_profile: {}, raw_features: {} };
      });
    engineHealthy.mockResolvedValue(true);
    db.song.update.mockResolvedValue({ id: "s1", status: "ANALYZED", analysisData: {} });
    const events = await readAll(await analyze.POST(streamReq(), undefined));
    expect(events.map((e) => e.code ?? e.stage ?? e.type)).toEqual(["waking", "retrying", "decoding", "done"]);
    expect(analyzeAudioStream).toHaveBeenCalledTimes(2);
    expect(db.song.updateMany).toHaveBeenCalledTimes(1);
    expect(db.song.update).toHaveBeenCalledTimes(1);
    expect(db.song.update.mock.calls[0][0].data.status).toBe("ANALYZED");
  });

  it("never retries a failure that retrying can't fix", async () => {
    analyzeAudioStream.mockRejectedValue(new EngineError("python-engine returned 422", "Could not decode audio file."));
    const events = await readAll(await analyze.POST(streamReq(), undefined));
    expect(events).toEqual([{ type: "error", error: "Could not decode audio file." }]);
    expect(analyzeAudioStream).toHaveBeenCalledTimes(1);
    expect(engineHealthy).not.toHaveBeenCalled();
  });

  it("gives up with a retryable message when the engine doesn't come back in time", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
    try {
      analyzeAudioStream.mockRejectedValue(new EngineError("python-engine returned 502", ANALYSIS_FAILURES.unavailable, true));
      engineHealthy.mockResolvedValue(false);
      const pending = analyze.POST(streamReq(), undefined).then(readAll);
      await vi.advanceTimersByTimeAsync(300_000);
      const events = await pending;
      expect(events.at(-1)).toEqual({ type: "error", error: ANALYSIS_FAILURES.unavailable });
      expect(analyzeAudioStream).toHaveBeenCalledTimes(1);
      expect(db.song.update.mock.calls[0][0].data).toEqual({ status: "FAILED", analysisError: ANALYSIS_FAILURES.unavailable });
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps going and saves the result when the browser disconnects mid-stream", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    analyzeAudioStream.mockImplementation(async (_b, _f, _c, onStage: (e: unknown) => void) => {
      await gate;
      onStage({ type: "stage", stage: "inference", index: 7, total: 9 });
      return { tone_profile: {}, raw_features: {} };
    });
    db.song.update.mockResolvedValue({ id: "s1", status: "ANALYZED", analysisData: {} });
    const res = await analyze.POST(streamReq(), undefined);
    await res.body!.cancel();
    release();
    await vi.waitFor(() => expect(db.song.update).toHaveBeenCalled());
    expect(db.song.update.mock.calls[0][0].data.status).toBe("ANALYZED");
  });

  it("still answers a job already in progress with a plain 409", async () => {
    db.song.updateMany.mockResolvedValue({ count: 0 });
    const res = await analyze.POST(streamReq(), undefined);
    expect(res.status).toBe(409);
    expect(analyzeAudioStream).not.toHaveBeenCalled();
  });
});

describe("profiles and follows", () => {
  const profileRow = {
    id: "user-b",
    handle: "user_b",
    name: "B",
    image: null,
    bio: null,
    instruments: [],
    genres: [],
    links: null,
    location: null,
    openTo: [],
    influences: [],
    followerCount: 0,
    followingCount: 0,
    reputation: 0,
    createdAt: new Date("2026-01-01"),
  };

  it("never exposes email on a public profile", async () => {
    db.user.findFirst.mockResolvedValue({ ...profileRow, email: "secret@x.dev" });
    const res = await users.GET(new Request("http://localhost"), hctx("user_b"));
    expect(res.status).toBe(200);
    // The query must select fields explicitly; even if a row carried an email, the select excludes it.
    const select = db.user.findFirst.mock.calls[0][0].select;
    expect(select.email).toBeUndefined();
  });

  it("404s unknown handles", async () => {
    db.user.findFirst.mockResolvedValue(null);
    expect((await users.GET(new Request("http://localhost"), hctx("ghost"))).status).toBe(404);
  });

  it("refuses self-follows and requires a session", async () => {
    expect((await followRoute.PUT(new Request("http://localhost", { method: "PUT" }), hctx("user_a"))).status).toBe(401);
    signedIn("user-a");
    db.user.findFirst.mockResolvedValue({ id: "user-a" });
    expect((await followRoute.PUT(new Request("http://localhost", { method: "PUT" }), hctx("user_a"))).status).toBe(400);
  });

  it("answers 409 for a taken handle", async () => {
    signedIn("user-a");
    db.user.update.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002", meta: { target: ["handle"] } }));
    const res = await me.PATCH(json({ handle: "taken_name" }, { method: "PATCH" }), undefined);
    expect(res.status).toBe(409);
  });

  it("needs the handle typed out to delete an account", async () => {
    signedIn("user-a");
    const res = await me.DELETE(json({ confirmHandle: "someone_else" }, { method: "DELETE" }), undefined);
    expect(res.status).toBe(400);
  });

  it("needs the password to delete an email/password account", async () => {
    signedIn("user-a");
    db.user.findUniqueOrThrow.mockResolvedValue({ passwordHash: "$2a$12$abcdefghijklmnopqrstuuJ6kO7zR9G1yCzO9xGQe3e3GQ5yW0yW" });
    const res = await me.DELETE(json({ confirmHandle: "@user_a", password: "wrong-password" }, { method: "DELETE" }), undefined);
    expect(res.status).toBe(403);
  });
});
