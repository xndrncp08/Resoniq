import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimits } from "@/lib/rate-limit";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));
const db = new Proxy({} as Record<string, Record<string, ReturnType<typeof vi.fn>>>, {
  get: (t, model: string) => (t[model] ??= new Proxy({}, { get: (m: Record<string, ReturnType<typeof vi.fn>>, fn: string) => (m[fn] ??= vi.fn()) })),
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));

const req = (body: unknown = {}, method = "POST") => new Request("http://localhost/api/admin", { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx = (id = "x"): any => ({ params: Promise.resolve({ id }) });
const as = (role: string) => {
  authMock.mockResolvedValue({ user: { id: "u1" } });
  db.user.findUnique.mockResolvedValue({ id: "u1", handle: "u_1", role, status: "ACTIVE", suspendedUntil: null });
};

const routes = {
  users: await import("@/app/api/admin/users/[id]/route"),
  reports: await import("@/app/api/admin/reports/route"),
  appeals: await import("@/app/api/admin/appeals/[id]/route"),
  rules: await import("@/app/api/admin/rules/route"),
  communities: await import("@/app/api/admin/communities/[id]/route"),
  featured: await import("@/app/api/admin/featured/route"),
  gear: await import("@/app/api/admin/gear/route"),
  tones: await import("@/app/api/admin/tones/[id]/route"),
  announcements: await import("@/app/api/admin/announcements/route"),
  flags: await import("@/app/api/admin/flags/route"),
  jobs: await import("@/app/api/admin/jobs/[id]/route"),
  media: await import("@/app/api/media/[id]/moderation/route"),
  publishing: await import("@/app/api/admin/tone-drafts/route"),
};

const calls: [string, () => Promise<Response>][] = [
  ["tone publishing", () => routes.publishing.POST(req({ action: "generate" }), undefined)],
  ["users", () => routes.users.POST(req({ action: "status", status: "BANNED", reason: "x" }), ctx())],
  ["reports", () => routes.reports.POST(req({ action: "dismiss", targetType: "POST", targetId: "p" }), undefined)],
  ["appeals", () => routes.appeals.POST(req({ decision: "REVERSED", note: "x" }), ctx())],
  ["rules", () => routes.rules.POST(req({ kind: "MAX_MENTIONS", config: { max: 3 } }), undefined)],
  ["communities", () => routes.communities.POST(req({ action: "archive" }), ctx())],
  ["featured", () => routes.featured.POST(req({}), undefined)],
  ["gear", () => routes.gear.POST(req({}), undefined)],
  ["tones", () => routes.tones.POST(req({ action: "unpublish", reason: "x" }), ctx())],
  ["announcements", () => routes.announcements.POST(req({ title: "x" }), undefined)],
  ["flags", () => routes.flags.PUT(req({ key: "signups", enabled: false }, "PUT"), undefined)],
  ["jobs", () => routes.jobs.POST(req(), ctx())],
  ["media", () => routes.media.POST(req({ action: "remove", reason: "x" }), ctx())],
];

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
});

describe("admin API authorization", () => {
  it.each(calls)("%s refuses signed-out callers", async (_n, call) => {
    authMock.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
  });

  it.each(calls)("%s refuses regular members even with a crafted request", async (_n, call) => {
    as("USER");
    expect((await call()).status).toBe(403);
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it("keeps platform config and bans away from moderators", async () => {
    as("MODERATOR");
    db.user.findUnique.mockResolvedValueOnce({ id: "u1", handle: "u_1", role: "MODERATOR", status: "ACTIVE", suspendedUntil: null });
    expect((await routes.flags.PUT(req({ key: "signups", enabled: false }, "PUT"), undefined)).status).toBe(403);
    expect((await routes.rules.POST(req({ kind: "MAX_MENTIONS", config: { max: 3 } }), undefined)).status).toBe(403);
    expect((await routes.publishing.POST(req({ action: "import", confirmation: "yes" }), undefined)).status).toBe(403);
    expect((await routes.users.POST(req({ action: "status", status: "BANNED", reason: "x" }), ctx("other"))).status).toBe(403);
  });
});
