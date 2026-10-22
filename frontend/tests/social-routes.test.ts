import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimits } from "@/lib/rate-limit";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));
const db = new Proxy({} as Record<string, Record<string, ReturnType<typeof vi.fn>>>, {
  get: (target, model: string) => (target[model] ??= new Proxy({}, { get: (m: Record<string, ReturnType<typeof vi.fn>>, fn: string) => (m[fn] ??= vi.fn()) })),
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));

const json = (body: unknown, method = "POST") =>
  new Request("http://localhost/api", { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const id = (v: Record<string, string>): any => ({ params: Promise.resolve(v) });

const posts = await import("@/app/api/posts/route");
const post = await import("@/app/api/posts/[id]/route");
const vote = await import("@/app/api/posts/[id]/vote/route");
const comments = await import("@/app/api/posts/[id]/comments/route");
const modPost = await import("@/app/api/posts/[id]/moderation/route");
const communities = await import("@/app/api/communities/route");
const membership = await import("@/app/api/communities/[slug]/membership/route");
const reports = await import("@/app/api/reports/route");
const appeals = await import("@/app/api/appeals/route");
const notifications = await import("@/app/api/notifications/route");
const bookmarks = await import("@/app/api/bookmarks/route");
const feed = await import("@/app/api/feed/route");

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  authMock.mockResolvedValue(null);
});

describe("social routes", () => {
  it.each([
    ["POST /api/posts", () => posts.POST(json({ body: "x" }), undefined)],
    ["PATCH /api/posts/[id]", () => post.PATCH(json({ body: "x" }, "PATCH"), id({ id: "p" }))],
    ["PUT vote", () => vote.PUT(json({ value: 1 }, "PUT"), id({ id: "p" }))],
    ["POST comment", () => comments.POST(json({ body: "x" }), id({ id: "p" }))],
    ["POST moderation", () => modPost.POST(json({ action: "remove", reason: "x" }), id({ id: "p" }))],
    ["POST community", () => communities.POST(json({ name: "Doom" }), undefined)],
    ["PUT membership", () => membership.PUT(new Request("http://localhost", { method: "PUT" }), id({ slug: "blues" }))],
    ["POST report", () => reports.POST(json({}), undefined)],
    ["POST appeal", () => appeals.POST(json({}), undefined)],
    ["GET notifications", () => notifications.GET(new Request("http://localhost"), undefined)],
    ["GET bookmarks", () => bookmarks.GET(new Request("http://localhost"), undefined)],
    ["GET following feed", () => feed.GET(new Request("http://localhost/api/feed?tab=following"), undefined)],
  ])("%s requires a session", async (_n, call) => {
    expect((await call()).status).toBe(401);
  });

  it("rejects bad votes and post types with a 400", async () => {
    db.featureFlag.findMany.mockResolvedValue([]);
    authMock.mockResolvedValue({ user: { id: "u" } });
    db.user.findUnique.mockResolvedValue({ id: "u", handle: "u_1", role: "USER", status: "ACTIVE", suspendedUntil: null });
    expect((await vote.PUT(json({ value: 2 }, "PUT"), id({ id: "p" }))).status).toBe(400);
    expect((await posts.POST(json({ body: "x", category: "MEME" }), undefined)).status).toBe(400);
  });

  it("blocks suspended users from posting", async () => {
    authMock.mockResolvedValue({ user: { id: "u" } });
    db.user.findUnique.mockResolvedValue({ id: "u", handle: "u_1", role: "USER", status: "SUSPENDED", suspendedUntil: null });
    expect((await posts.POST(json({ body: "x" }), undefined)).status).toBe(403);
  });
});
