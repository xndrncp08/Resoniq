import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimits } from "@/lib/rate-limit";
import { bestClean, MAX_BPM, MIN_BPM, nextRung } from "@/lib/practice";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));
const db = new Proxy({} as Record<string, Record<string, ReturnType<typeof vi.fn>>>, {
  get: (target, model: string) => (target[model] ??= new Proxy({}, { get: (m: Record<string, ReturnType<typeof vi.fn>>, fn: string) => (m[fn] ??= vi.fn()) })),
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));

const { parsePassage, parsePassagePatch, parseTake } = await import("@/lib/practice-ladder");
const passages = await import("@/app/api/practice/passages/route");
const passage = await import("@/app/api/practice/passages/[id]/route");
const takes = await import("@/app/api/practice/passages/[id]/takes/route");
const take = await import("@/app/api/practice/takes/[id]/route");

const json = (body: unknown, method = "POST") => new Request("http://localhost/api", { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const id = (v: Record<string, string>): any => ({ params: Promise.resolve(v) });

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  authMock.mockResolvedValue(null);
});

describe("tempo ladder logic", () => {
  it("finds the best clean tempo, ignoring faster takes that weren't clean", () => {
    expect(bestClean([])).toBeNull();
    expect(bestClean([{ bpm: 120, clean: false }])).toBeNull();
    expect(bestClean([{ bpm: 90, clean: true }, { bpm: 130, clean: false }, { bpm: 100, clean: true }])).toBe(100);
  });

  it("starts near 70% of the target, climbs past the best clean take and stops at the target", () => {
    expect(nextRung([], 140)).toBe(98);
    expect(nextRung([], 40)).toBe(MIN_BPM);
    expect(nextRung([{ bpm: 98, clean: true }], 140)).toBe(102);
    expect(nextRung([{ bpm: 98, clean: true }, { bpm: 110, clean: false }], 140)).toBe(102);
    expect(nextRung([{ bpm: 139, clean: true }], 140)).toBe(140);
    expect(nextRung([{ bpm: 150, clean: true }], 140)).toBe(140);
  });

  it("validates passages and takes at the boundary", () => {
    expect(parsePassage({ title: "  Solo   bars 9-16 ", targetBpm: 160 })).toEqual({ title: "Solo bars 9-16", targetBpm: 160 });
    expect(() => parsePassage({ title: " ", targetBpm: 160 })).toThrow(/Name the passage/);
    expect(() => parsePassage({ title: "x".repeat(121), targetBpm: 160 })).toThrow(/120/);
    for (const bad of [MIN_BPM - 1, MAX_BPM + 1, 99.5, "120", null]) expect(() => parsePassage({ title: "Riff", targetBpm: bad })).toThrow();
    expect(parseTake({ bpm: 120, clean: false })).toEqual({ bpm: 120, clean: false });
    expect(() => parseTake({ bpm: 120, clean: "yes" })).toThrow();
    expect(() => parsePassagePatch({})).toThrow(/Nothing/);
    expect(parsePassagePatch({ targetBpm: 150 })).toEqual({ targetBpm: 150 });
  });
});

describe("tempo ladder routes", () => {
  it.each([
    ["GET passages", () => passages.GET(new Request("http://localhost"), undefined)],
    ["POST passage", () => passages.POST(json({ title: "Riff", targetBpm: 120 }), undefined)],
    ["PATCH passage", () => passage.PATCH(json({ targetBpm: 130 }, "PATCH"), id({ id: "p" }))],
    ["DELETE passage", () => passage.DELETE(new Request("http://localhost", { method: "DELETE" }), id({ id: "p" }))],
    ["POST take", () => takes.POST(json({ bpm: 120, clean: true }), id({ id: "p" }))],
    ["DELETE take", () => take.DELETE(new Request("http://localhost", { method: "DELETE" }), id({ id: "t" }))],
  ])("%s requires a session", async (_n, call) => {
    expect((await call()).status).toBe(401);
  });

  it("rejects malformed input with a 400 before touching the database", async () => {
    authMock.mockResolvedValue({ user: { id: "u" } });
    db.user.findUnique.mockResolvedValue({ id: "u", handle: "u_1", role: "USER", status: "ACTIVE", suspendedUntil: null });
    expect((await passages.POST(json({ title: "Riff", targetBpm: 999 }), undefined)).status).toBe(400);
    expect((await takes.POST(json({ bpm: 120 }), id({ id: "p" }))).status).toBe(400);
    expect(db.practiceTake.create).not.toHaveBeenCalled();
  });

  it("answers 404 for a passage the viewer doesn't own", async () => {
    authMock.mockResolvedValue({ user: { id: "u" } });
    db.user.findUnique.mockResolvedValue({ id: "u", handle: "u_1", role: "USER", status: "ACTIVE", suspendedUntil: null });
    db.practicePassage.deleteMany.mockResolvedValue({ count: 0 });
    const res = await passage.DELETE(new Request("http://localhost", { method: "DELETE" }), id({ id: "someone-elses" }));
    expect(res.status).toBe(404);
    expect(db.practicePassage.deleteMany).toHaveBeenCalledWith({ where: { id: "someone-elses", userId: "u" } });
  });
});
