import { beforeEach, describe, expect, it } from "vitest";
import { addProjectMember, answerInvite, getConversation, getMessages, leaveProject, listConversations, markRead, messageMusician, parseMessage, react, sendInvite, sendMessage, deleteMessage, unreadConversationCount } from "@/lib/messaging";
import { canViewMedia } from "@/lib/media/service";
import { fileReport } from "@/lib/reports";
import { clearRuleCache } from "@/lib/automod";
import { ValidationError } from "@/lib/validation";
import { actorFor, makeUser, prisma, resetDb } from "./db";

beforeEach(async () => { await resetDb(); clearRuleCache(); });

const person = async (data: Record<string, unknown> = {}) => {
  const u = await makeUser();
  if (Object.keys(data).length) await prisma.user.update({ where: { id: u.id }, data });
  return actorFor(u);
};
const msg = (body: string, extra: Record<string, unknown> = {}) => parseMessage({ body, ...extra });
// The HTTP status a route would answer with (input problems are 400s).
const status = (p: Promise<unknown>) => p.then(() => 200, (e: { status?: number }) => (e instanceof ValidationError ? 400 : e.status ?? 500));
const invite = { title: "Prog EP", role: "Drums", when: "Next month", where: "Remote", note: "Interested?" };

describe("who can message whom", () => {
  it("respects each musician's messaging setting", async () => {
    const me = await person();
    const closed = await person({ dmPolicy: "NOBODY" });
    const picky = await person({ dmPolicy: "FOLLOWING" });
    expect(await status(messageMusician(me, closed.id, msg("hi")))).toBe(403);
    expect(await status(messageMusician(me, picky.id, msg("hi")))).toBe(403);
    await prisma.follow.create({ data: { followerId: picky.id, followingId: me.id } });
    expect(await status(messageMusician(me, picky.id, msg("hi")))).toBe(200);
  });

  it("blocking stops messages both ways and hides the conversation for both", async () => {
    const a = await person();
    const b = await person();
    const { conversationId } = await messageMusician(a, b.id, msg("hey"));
    await prisma.block.create({ data: { blockerId: b.id, blockedId: a.id } });
    expect(await status(sendMessage(a, conversationId, msg("hello?")))).toBe(403);
    expect(await status(sendMessage(b, conversationId, msg("no")))).toBe(403);
    expect(await status(messageMusician(a, b.id, msg("again")))).toBe(403);
    expect(await listConversations(a.id)).toEqual([]);
    expect(await listConversations(b.id)).toEqual([]);
    expect(await unreadConversationCount(b.id)).toBe(0);
  });

  it("keeps conversations private to their members", async () => {
    const [a, b, outsider] = await Promise.all([person(), person(), person()]);
    const { conversationId } = await messageMusician(a, b.id, msg("just us"));
    expect(await status(getMessages(outsider.id, conversationId))).toBe(404);
    expect(await status(getConversation(outsider.id, conversationId))).toBe(404);
    expect(await status(sendMessage(outsider, conversationId, msg("let me in")))).toBe(404);
    // Two people share one thread, whoever writes first.
    expect((await messageMusician(b, a.id, msg("back"))).conversationId).toBe(conversationId);
  });
});

describe("collaboration invites and projects", () => {
  it("accepting starts a project with both musicians; an invite is answered once, by its recipient", async () => {
    const [host, guest] = await Promise.all([person(), person()]);
    const { messageId } = await sendInvite(host, guest.id, invite);
    expect(await prisma.notification.count({ where: { userId: guest.id, type: "COLLAB_INVITE" } })).toBe(1);
    expect(await status(answerInvite(host, messageId, true))).toBe(400);
    const { projectId } = await answerInvite(guest, messageId, true);
    expect(await status(answerInvite(guest, messageId, false))).toBe(409);
    const project = await getConversation(host.id, projectId!);
    expect(project).toMatchObject({ kind: "PROJECT", title: "Prog EP", brief: "Looking for: Drums · When: Next month · Where: Remote" });
    expect(project.members.map((m) => m.id).sort()).toEqual([host.id, guest.id].sort());
    expect(await prisma.notification.count({ where: { userId: host.id, type: "COLLAB_ACCEPTED" } })).toBe(1);
    const original = await prisma.message.findUniqueOrThrow({ where: { id: messageId } });
    expect([original.inviteStatus, original.projectId]).toEqual(["ACCEPTED", projectId]);
  });

  it("declining starts nothing, and unanswered invites are capped", async () => {
    const [host, guest] = await Promise.all([person(), person()]);
    const first = await sendInvite(host, guest.id, invite);
    expect(await answerInvite(guest, first.messageId, false)).toEqual({ projectId: null });
    expect(await prisma.conversation.count({ where: { kind: "PROJECT" } })).toBe(0);
    for (let i = 0; i < 3; i++) await sendInvite(host, guest.id, invite);
    expect(await status(sendInvite(host, guest.id, invite))).toBe(429);
  });

  it("projects add members who accept messages from you, and leaving ends access", async () => {
    const [host, guest, third, closed] = await Promise.all([person(), person(), person(), person({ dmPolicy: "NOBODY" })]);
    const { projectId } = await answerInvite(guest, (await sendInvite(host, guest.id, invite)).messageId, true);
    await addProjectMember(guest, projectId!, third.id);
    expect(await status(addProjectMember(guest, projectId!, third.id))).toBe(409);
    expect(await status(addProjectMember(host, projectId!, closed.id))).toBe(403);
    expect(await prisma.notification.count({ where: { userId: third.id, type: "PROJECT_ADDED" } })).toBe(1);
    await leaveProject(third, projectId!);
    expect(await status(getMessages(third.id, projectId!))).toBe(404);
    expect((await getConversation(host.id, projectId!)).members).toHaveLength(2);
  });
});

describe("messages", () => {
  it("counts unread conversations from others until they're read", async () => {
    const [a, b] = await Promise.all([person(), person()]);
    const { conversationId } = await messageMusician(a, b.id, msg("riff idea"));
    expect(await unreadConversationCount(a.id)).toBe(0);
    expect(await unreadConversationCount(b.id)).toBe(1);
    await markRead(b.id, conversationId);
    expect(await unreadConversationCount(b.id)).toBe(0);
  });

  it("reactions are limited to the offered set and counted per person", async () => {
    const [a, b] = await Promise.all([person(), person()]);
    const { conversationId, message } = await messageMusician(a, b.id, msg("listen"));
    await react(b, message.id, "🔥", true);
    await react(a, message.id, "🔥", true);
    await react(b, message.id, "🔥", true);
    expect(await status(react(b, message.id, "💩", true))).toBe(400);
    const [view] = (await getMessages(a.id, conversationId)).messages;
    expect(view.reactions).toEqual([{ emoji: "🔥", count: 2, mine: true }]);
  });

  it("refuses blocked terms, and links from brand-new accounts", async () => {
    await prisma.moderationRule.createMany({ data: [
      { kind: "BLOCKED_TERM", label: "Slur", config: { terms: ["badword"] } },
      { kind: "LINK_HOLD_NEW_ACCOUNTS", label: "New account links", config: { hours: 24 } },
    ] });
    clearRuleCache();
    const [a, b] = await Promise.all([person(), person()]);
    expect(await status(messageMusician(a, b.id, msg("you badword")))).toBe(400);
    expect(await status(messageMusician(a, b.id, msg("buy at https://spam.example")))).toBe(400);
    expect(await status(messageMusician(a, b.id, msg("fine message")))).toBe(200);
  });

  it("attachments are visible to members only, and not after the message is deleted", async () => {
    const [a, b, outsider] = await Promise.all([person(), person(), person()]);
    const media = await prisma.media.create({ data: { ownerId: a.id, purpose: "MESSAGE", kind: "AUDIO", status: "READY", mime: "audio/mpeg", sizeBytes: 10, originalKey: "k" } });
    const { message } = await messageMusician(a, b.id, msg("take 2", { mediaIds: [media.id] }));
    const row = await prisma.media.findUniqueOrThrow({ where: { id: media.id } });
    expect(row.messageId).toBe(message.id);
    expect(await canViewMedia(row, b)).toBe(true);
    expect(await canViewMedia(row, outsider)).toBe(false);
    expect(await canViewMedia(row, null)).toBe(false);
    await deleteMessage(a, message.id);
    expect(await canViewMedia(row, b)).toBe(false);
    // Someone else's upload can't be attached.
    const theirs = await prisma.media.create({ data: { ownerId: outsider.id, purpose: "MESSAGE", kind: "AUDIO", status: "READY", mime: "audio/mpeg", sizeBytes: 10, originalKey: "k2" } });
    expect(await status(messageMusician(a, b.id, msg("", { mediaIds: [theirs.id] })))).toBe(400);
  });

  it("only people in the conversation can report a message", async () => {
    const [a, b, outsider] = await Promise.all([person(), person(), person()]);
    const { message } = await messageMusician(a, b.id, msg("rude"));
    const report = { targetType: "MESSAGE" as const, targetId: message.id, reason: "HARASSMENT" as const, details: null };
    expect(await status(fileReport(outsider, report))).toBe(404);
    expect(await status(fileReport(a, report))).toBe(404);
    expect(await status(fileReport(b, report))).toBe(200);
  });
});
