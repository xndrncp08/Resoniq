import { beforeEach, describe, expect, it } from "vitest";
import { clearRuleCache } from "@/lib/automod";
import { createComment, deleteComment, editComment, listComments, voteComment } from "@/lib/comments";
import { canCreateCommunity, join } from "@/lib/communities";
import { follow } from "@/lib/follows";
import { moderatePost } from "@/lib/moderation";
import { bookmarksFeed, createPost, followingFeed, forYouFeed, getPost, listPosts, setBookmark, votePost } from "@/lib/posts";
import { fileAppeal, fileReport } from "@/lib/reports";
import { seed } from "@/prisma/seed";
import { makeActor, makeUser, prisma, resetDb } from "./db";

const base = { title: null, category: "DISCUSSION" as const, communitySlug: null, toneId: null };
const q = (extra = {}) => ({ cursor: null, limit: 20, ...extra });

beforeEach(async () => {
  await resetDb();
  clearRuleCache();
});

describe("votes", () => {
  it("keeps score equal to the sum of votes under concurrent clicks", async () => {
    const author = await makeActor();
    const voters = await Promise.all(Array.from({ length: 6 }, () => makeActor()));
    const post = await createPost(author, { ...base, body: "Plexi at noon" });

    await Promise.all(voters.flatMap((v, i) => [votePost(v.id, post.id, 1), votePost(v.id, post.id, i % 2 ? -1 : 1), votePost(v.id, post.id, i % 2 ? -1 : 1)]));
    const row = await prisma.post.findUniqueOrThrow({ where: { id: post.id } });
    const sum = (await prisma.postVote.findMany({ where: { postId: post.id } })).reduce((s, v) => s + v.value, 0);
    expect(row.score).toBe(sum);
    expect(row.upCount).toBe(await prisma.postVote.count({ where: { postId: post.id, value: 1 } }));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: author.id } })).reputation).toBe(sum);

    await votePost(voters[0].id, post.id, 0);
    expect(await prisma.postVote.count({ where: { postId: post.id, userId: voters[0].id } })).toBe(0);
  });

  it("can't vote on removed posts", async () => {
    const author = await makeActor();
    const mod = await makeActor({ handle: "mod_one" });
    await prisma.user.update({ where: { id: mod.id }, data: { role: "MODERATOR" } });
    const post = await createPost(author, { ...base, body: "x" });
    await moderatePost({ ...mod, role: "MODERATOR" }, post.id, { action: "remove", reason: "spam" });
    await expect(votePost(mod.id, post.id, 1)).rejects.toThrow("Post not found.");
  });
});

describe("feeds and visibility", () => {
  it("filters categories across pagination and both feeds without exposing held posts", async () => {
    const author = await makeActor();
    const viewer = await makeActor();
    await follow(viewer.id, author.id);
    const first = await createPost(author, { ...base, category: "QUESTION", body: "How do you practice changes?" });
    const second = await createPost(author, { ...base, category: "QUESTION", body: "How do you count this?" });
    await createPost(author, { ...base, category: "PERFORMANCE", body: "A take" });
    const held = await createPost(author, { ...base, category: "QUESTION", body: "Held question" });
    await prisma.post.update({ where: { id: held.id }, data: { status: "HELD" } });
    const { decodeCursor } = await import("@/lib/pagination");
    for (const load of [() => forYouFeed(null, { ...q(), sort: "new", category: "QUESTION", limit: 1 }), () => followingFeed(viewer.id, { ...q(), sort: "new", category: "QUESTION", limit: 1 })]) {
      const page = await load();
      expect(page.items).toHaveLength(1);
      expect(page.items[0].category).toBe("QUESTION");
      const next = await listPosts({}, null, { ...q(), sort: "new", category: "QUESTION", limit: 1, cursor: decodeCursor(page.nextCursor) });
      expect(new Set([...page.items, ...next.items].map((p) => p.id))).toEqual(new Set([first.id, second.id]));
      expect(next.nextCursor).toBeNull();
    }
  });
  it("paginates hot and new without gaps or duplicates", async () => {
    const a = await makeActor();
    const voter = await makeActor();
    const ids: string[] = [];
    for (let i = 0; i < 25; i++) ids.push((await createPost(a, { ...base, body: `post ${i}` })).id);
    await votePost(voter.id, ids[3], 1);
    for (const sort of ["hot", "new"] as const) {
      const p1 = await listPosts({}, null, q({ sort }));
      const { decodeCursor } = await import("@/lib/pagination");
      const p2 = await listPosts({}, null, q({ sort, cursor: decodeCursor(p1.nextCursor) }));
      const all = [...p1.items, ...p2.items].map((p) => p.id);
      expect(new Set(all).size).toBe(25);
      expect(p2.nextCursor).toBeNull();
    }
  });

  it("hides held, removed, deleted and banned-author posts from others, but shows authors their held posts", async () => {
    const a = await makeActor();
    const other = await makeActor();
    const banned = await makeActor();
    const visible = await createPost(a, { ...base, body: "fine" });
    const deleted = await createPost(a, { ...base, body: "gone" });
    await prisma.post.update({ where: { id: deleted.id }, data: { status: "DELETED" } });
    const held = await createPost(a, { ...base, body: "held" });
    await prisma.post.update({ where: { id: held.id }, data: { status: "HELD" } });
    await createPost(banned, { ...base, body: "from banned" });
    await prisma.user.update({ where: { id: banned.id }, data: { status: "BANNED" } });

    const seen = (await listPosts({}, other.id, q({ sort: "new" }))).items.map((p) => p.id);
    expect(seen).toEqual([visible.id]);
    const own = (await listPosts({}, a.id, q({ sort: "new" }))).items.map((p) => p.id);
    expect(own).toContain(held.id);
    expect(own).not.toContain(deleted.id);
    expect(await getPost(held.id, other.id)).toBeNull();
  });

  it("builds following and for-you from the viewer's graph", async () => {
    const me = await makeActor();
    const friend = await makeActor();
    const stranger = await makeActor();
    await seed(prisma);
    const blues = await prisma.community.findUniqueOrThrow({ where: { slug: "blues" } });
    await follow(me.id, friend.id);
    const f = await createPost(friend, { ...base, body: "from friend" });
    const s = await createPost(stranger, { ...base, body: "from stranger" });
    const c = await createPost(stranger, { ...base, body: "in blues", communitySlug: "blues" });
    await join(me.id, blues.id);

    const following = (await followingFeed(me.id, q())).items.map((p) => p.id);
    expect(following.sort()).toEqual([f.id, c.id].sort());
    expect((await forYouFeed(me.id, q())).items.map((p) => p.id)).not.toContain(s.id);
    // Popular posts from outside the graph reach for-you.
    const voters = await Promise.all(Array.from({ length: 3 }, () => makeActor()));
    for (const v of voters) await votePost(v.id, s.id, 1);
    expect((await forYouFeed(me.id, q())).items.map((p) => p.id)).toContain(s.id);
    expect((await prisma.community.findUniqueOrThrow({ where: { id: blues.id } })).postCount).toBe(1);
  });

  it("lists bookmarks and drops ones whose post was removed", async () => {
    const a = await makeActor();
    const me = await makeActor();
    const p = await createPost(a, { ...base, body: "save me" });
    await setBookmark(me.id, p.id, true);
    await setBookmark(me.id, p.id, true);
    expect((await prisma.post.findUniqueOrThrow({ where: { id: p.id } })).bookmarkCount).toBe(1);
    expect((await bookmarksFeed(me.id, null, 20)).items).toHaveLength(1);
    await prisma.post.update({ where: { id: p.id }, data: { status: "REMOVED" } });
    expect((await bookmarksFeed(me.id, null, 20)).items).toHaveLength(0);
  });
});

describe("comments", () => {
  it("threads replies, caps depth, notifies, and keeps placeholders for deleted parents", async () => {
    const author = await makeActor();
    const replier = await makeActor({ handle: "replier" });
    const post = await createPost(author, { ...base, body: "thread" });
    let parent = await createComment(replier, post.id, { body: "top", parentId: null });
    const top = parent;
    for (let i = 0; i < 6; i++) parent = await createComment(author, post.id, { body: `depth ${i + 1}`, parentId: parent.id });
    await expect(createComment(replier, post.id, { body: "too deep", parentId: parent.id })).rejects.toThrow("too deep");

    expect((await prisma.post.findUniqueOrThrow({ where: { id: post.id } })).commentCount).toBe(7);
    const types = (await prisma.notification.findMany({ where: { userId: author.id } })).map((n) => n.type);
    expect(types).toContain("COMMENT");

    await deleteComment(replier, top.id);
    const list = await listComments(post.id, null);
    const placeholder = list.find((c) => c.id === top.id)!;
    expect(placeholder.body).toBe("");
    expect(placeholder.author).toBeNull();
    expect(list).toHaveLength(7);

    await voteComment(replier.id, list[1].id, 1);
    expect((await prisma.comment.findUniqueOrThrow({ where: { id: list[1].id } })).score).toBe(1);
  });

  it("notifies mentioned users once", async () => {
    const a = await makeActor();
    const mia = await makeActor({ handle: "mia" });
    const post = await createPost(a, { ...base, body: "hey @mia and @mia" });
    expect(await prisma.notification.count({ where: { userId: mia.id, type: "MENTION", postId: post.id } })).toBe(1);
  });
});

describe("moderation, reports and appeals", () => {
  it("removes an edited comment from published counters when automod holds it", async () => {
    await seed(prisma);
    const author = await makeActor();
    const p = await createPost(author, { ...base, body: "A riff" });
    const parent = await createComment(author, p.id, { body: "Top", parentId: null });
    const reply = await createComment(author, p.id, { body: "Reply", parentId: parent.id });
    await prisma.moderationRule.updateMany({ where: { kind: "BLOCKED_TERM" }, data: { config: { terms: ["blocked words"] } } });
    clearRuleCache();
    await editComment(author, reply.id, "blocked words");
    await editComment(author, reply.id, "still blocked words");
    expect((await prisma.post.findUniqueOrThrow({ where: { id: p.id } })).commentCount).toBe(1);
    expect((await prisma.comment.findUniqueOrThrow({ where: { id: parent.id } })).replyCount).toBe(0);
    expect((await listComments(p.id, null)).map((c) => c.id)).toEqual([parent.id]);
  });
  it("limits community moderators to their own community", async () => {
    await seed(prisma);
    const author = await makeActor();
    const cmod = await makeActor();
    const blues = await prisma.community.findUniqueOrThrow({ where: { slug: "blues" } });
    await prisma.communityMember.create({ data: { userId: cmod.id, communityId: blues.id, role: "MODERATOR" } });
    const inBlues = await createPost(author, { ...base, body: "a", communitySlug: "blues" });
    const inMetal = await createPost(author, { ...base, body: "b", communitySlug: "metal" });

    await moderatePost(cmod, inBlues.id, { action: "remove", reason: "off topic" });
    await expect(moderatePost(cmod, inMetal.id, { action: "remove", reason: "x" })).rejects.toThrow("Not allowed.");
    expect(await prisma.auditLog.count({ where: { action: "post.remove", targetId: inBlues.id } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: author.id, type: "MODERATION" } })).toBe(1);

    const appeal = await fileAppeal(author, { targetType: "POST", targetId: inBlues.id, body: "It was on topic, it's a blues shuffle." });
    expect(appeal.status).toBe("OPEN");
    await expect(fileAppeal(author, { targetType: "POST", targetId: inBlues.id, body: "Again, it was on topic really." })).rejects.toThrow("already");
    await expect(fileAppeal(author, { targetType: "POST", targetId: inMetal.id, body: "This one isn't even removed." })).rejects.toThrow("Nothing to appeal");
  });

  it("holds a post after three distinct reporters and closes reports on removal", async () => {
    await seed(prisma);
    const author = await makeActor();
    const post = await createPost(author, { ...base, body: "spammy" });
    const reporters = await Promise.all(Array.from({ length: 3 }, () => makeActor()));
    await fileReport(reporters[0], { targetType: "POST", targetId: post.id, reason: "SPAM", details: null });
    await fileReport(reporters[0], { targetType: "POST", targetId: post.id, reason: "SPAM", details: null });
    await fileReport(reporters[1], { targetType: "POST", targetId: post.id, reason: "SPAM", details: null });
    expect((await prisma.post.findUniqueOrThrow({ where: { id: post.id } })).status).toBe("PUBLISHED");
    await fileReport(reporters[2], { targetType: "POST", targetId: post.id, reason: "SPAM", details: null });
    expect((await prisma.post.findUniqueOrThrow({ where: { id: post.id } })).status).toBe("HELD");
    expect(await prisma.report.count()).toBe(3);

    const admin = await makeActor();
    await moderatePost({ ...admin, role: "ADMIN" }, post.id, { action: "remove", reason: "spam" });
    expect(await prisma.report.count({ where: { status: "ACTIONED" } })).toBe(3);
  });

  it("holds automod matches for review", async () => {
    await seed(prisma);
    await prisma.moderationRule.updateMany({ where: { kind: "BLOCKED_TERM" }, data: { config: { terms: ["free followers"] } } });
    clearRuleCache();
    const a = await makeActor();
    const p = await createPost(a, { ...base, body: "Get FREE FOLLOWERS now" });
    expect(p.status).toBe("HELD");
    expect(p.heldReasons).toEqual(["Blocked term"]);
  });
});

describe("community creation eligibility", () => {
  it("requires a week-old account and limits creation rate", async () => {
    const fresh = await makeActor();
    expect(await canCreateCommunity(fresh)).toMatchObject({ ok: false });
    const veteran = await makeUser();
    await prisma.user.update({ where: { id: veteran.id }, data: { createdAt: new Date(Date.now() - 8 * 86_400_000) } });
    const v = await prisma.user.findUniqueOrThrow({ where: { id: veteran.id }, select: { id: true, handle: true, role: true, status: true, suspendedUntil: true } });
    expect(await canCreateCommunity(v)).toEqual({ ok: true });
    await prisma.community.createMany({ data: [{ slug: "one-a", name: "One", createdById: v.id }, { slug: "two-b", name: "Two", createdById: v.id }] });
    expect(await canCreateCommunity(v)).toMatchObject({ ok: false });
    expect(await canCreateCommunity({ ...v, status: "SUSPENDED", suspendedUntil: null })).toMatchObject({ ok: false });
  });
});
