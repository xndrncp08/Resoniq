import { beforeEach, describe, expect, it } from "vitest";
import { createAnnouncement, fanOutAnnouncement } from "@/lib/admin/announcements";
import { dailySeries, overview, systemHealth } from "@/lib/admin/analytics";
import { addSlot, featured } from "@/lib/admin/curation";
import { decideAppeal, dismissReports, reportQueue } from "@/lib/admin/queue";
import { setUserRole, setUserStatus } from "@/lib/admin/users";
import { moderatePost } from "@/lib/moderation";
import { createPost } from "@/lib/posts";
import { fileAppeal, fileReport } from "@/lib/reports";
import { seed } from "@/prisma/seed";
import { makeActor, prisma, resetDb } from "./db";

const base = { title: null, category: "DISCUSSION" as const, communitySlug: null, toneId: null };
const staff = async (role: "MODERATOR" | "ADMIN") => {
  const a = await makeActor();
  await prisma.user.update({ where: { id: a.id }, data: { role } });
  return { ...a, role };
};

beforeEach(async () => {
  await resetDb();
  await seed(prisma);
});

describe("account actions", () => {
  it("lets moderators suspend but not ban, and never act on themselves or on staff", async () => {
    const mod = await staff("MODERATOR");
    const admin = await staff("ADMIN");
    const member = await makeActor();
    await setUserStatus(mod, member.id, { status: "SUSPENDED", reason: "spam", until: new Date(Date.now() + 86_400_000) });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).status).toBe("SUSPENDED");
    expect(await prisma.notification.count({ where: { userId: member.id, type: "MODERATION" } })).toBe(1);
    await expect(setUserStatus(mod, member.id, { status: "BANNED", reason: "x", until: null })).rejects.toThrow("Not allowed.");
    await expect(setUserStatus(mod, mod.id, { status: "ACTIVE", reason: "", until: null })).rejects.toThrow("your own");
    await expect(setUserStatus(mod, admin.id, { status: "SUSPENDED", reason: "x", until: null })).rejects.toThrow("staff");
    await setUserStatus(admin, member.id, { status: "BANNED", reason: "repeat spam", until: null });
    await expect(setUserStatus(mod, member.id, { status: "ACTIVE", reason: "", until: null })).rejects.toThrow("lift a ban");
    expect(await prisma.auditLog.count({ where: { targetId: member.id } })).toBe(2);
  });

  it("keeps at least one active admin and refuses self-promotion", async () => {
    const admin = await staff("ADMIN");
    const other = await staff("ADMIN");
    const mod = await staff("MODERATOR");
    await expect(setUserRole(mod, mod.id, "ADMIN")).rejects.toThrow("Not allowed.");
    await expect(setUserRole(admin, admin.id, "USER")).rejects.toThrow("another admin");
    await setUserRole(admin, other.id, "USER");
    await prisma.user.update({ where: { id: other.id }, data: { role: "ADMIN" } });
    await prisma.user.update({ where: { id: admin.id }, data: { status: "SUSPENDED" } });
    await expect(setUserRole({ ...admin }, other.id, "USER")).rejects.toThrow("at least one active admin");
  });
});

describe("queue and appeals", () => {
  it("groups reports, lifts report holds on dismissal, and reverses appeals by another moderator only", async () => {
    const author = await makeActor();
    const modA = await staff("MODERATOR");
    const modB = await staff("MODERATOR");
    const post = await createPost(author, { ...base, body: "contested riff" });
    for (const r of await Promise.all([makeActor(), makeActor(), makeActor()])) await fileReport(r, { targetType: "POST", targetId: post.id, reason: "SPAM", details: null });
    const [item] = await reportQueue();
    expect(item).toMatchObject({ targetType: "POST", reports: 3, reasons: { SPAM: 3 }, preview: { status: "HELD" } });
    await dismissReports(modA, "POST", post.id, "not spam");
    expect((await prisma.post.findUniqueOrThrow({ where: { id: post.id } })).status).toBe("PUBLISHED");

    await moderatePost(modA, post.id, { action: "remove", reason: "off-topic" });
    const appeal = await fileAppeal(author, { targetType: "POST", targetId: post.id, body: "It's my original riff, not off-topic." });
    await expect(decideAppeal(modA, appeal.id, { decision: "REVERSED", note: "ok" })).rejects.toThrow("Another moderator");
    await decideAppeal(modB, appeal.id, { decision: "REVERSED", note: "On topic after all." });
    expect((await prisma.post.findUniqueOrThrow({ where: { id: post.id } })).status).toBe("PUBLISHED");
    expect((await prisma.appeal.findUniqueOrThrow({ where: { id: appeal.id } })).status).toBe("REVERSED");
  });

  it("lifts a suspension when an account appeal is reversed", async () => {
    const mod = await staff("MODERATOR");
    const other = await staff("MODERATOR");
    const member = await makeActor();
    await setUserStatus(mod, member.id, { status: "SUSPENDED", reason: "heated thread", until: null });
    const me = await prisma.user.findUniqueOrThrow({ where: { id: member.id }, select: { id: true, handle: true, role: true, status: true, suspendedUntil: true } });
    const appeal = await fileAppeal(me, { targetType: "ACCOUNT", targetId: member.id, body: "I apologised in the thread and edited my post." });
    await decideAppeal(other, appeal.id, { decision: "REVERSED", note: "Lifted." });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).status).toBe("ACTIVE");
  });
});

describe("curation and announcements", () => {
  it("only features public content and drops it once it stops being public", async () => {
    const admin = await staff("ADMIN");
    const author = await makeActor();
    const post = await createPost(author, { ...base, body: "featured riff" });
    await addSlot(admin, { placement: "EXPLORE", kind: "POST", raw: `https://resoniq.test/p/${post.id}`, position: 0, note: null, endsAt: null });
    await expect(addSlot(admin, { placement: "EXPLORE", kind: "COMMUNITY", raw: "c/not-a-thing", position: 0, note: null, endsAt: null })).rejects.toThrow("public");
    expect((await featured("EXPLORE", null)).posts.map((p) => p.id)).toEqual([post.id]);
    await prisma.post.update({ where: { id: post.id }, data: { status: "REMOVED" } });
    expect((await featured("EXPLORE", null)).posts).toEqual([]);
  });

  it("fans an announcement out once per active member, even if a batch is retried", async () => {
    const admin = await staff("ADMIN");
    await Promise.all([makeActor(), makeActor()]);
    const a = await createAnnouncement(admin, { title: "Maintenance tonight", body: "", level: "WARN", endsAt: null, notify: true });
    await fanOutAnnouncement({ announcementId: a.id });
    await fanOutAnnouncement({ announcementId: a.id });
    expect(await prisma.notification.count({ where: { type: "ANNOUNCEMENT" } })).toBe(3);
  });
});

describe("analytics", () => {
  it("zero-fills daily series and reports health", async () => {
    await makeActor();
    const s = await dailySeries("signups", 7);
    expect(s).toHaveLength(7);
    expect(s[6].value).toBe(1);
    expect((await dailySeries("active", 30)).length).toBe(30);
    expect((await overview()).users).toBe(1);
    expect((await systemHealth()).db.ok).toBe(true);
  });
});
