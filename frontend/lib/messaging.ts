import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import type { Actor } from "@/lib/authz";
import { fail } from "@/lib/validation";
import { notify } from "@/lib/notify";
import { hasBlockedTerm, screenText } from "@/lib/automod";
import { AUTHOR_SELECT } from "@/lib/profiles";
import { toMediaView } from "@/lib/media/view";
import { MESSAGE_REACTIONS, type ConversationSummary, type Invite, type MessageView } from "@/lib/messaging-shared";

export { MESSAGE_REACTIONS, type ConversationSummary, type Invite, type MessageView };

/**
 * Private conversations between musicians, and the projects that grow out of
 * them. Rules, all enforced here rather than in the UI:
 *   - only members read or write a conversation; leaving a project ends access;
 *   - starting a conversation respects the recipient's "who can message me"
 *     setting and blocks in either direction;
 *   - a collaboration invite is a structured message the recipient accepts
 *     (which starts a project with both of them) or declines;
 *   - messages run through the same blocked-term and new-account link rules as posts.
 */

export const MAX_MESSAGE = 4000;
export const MAX_ATTACHMENTS = 4;
export const MAX_PROJECT_MEMBERS = 12;
const PAGE = 40;


const text = (v: unknown, field: string, max: number, required = false): string | null => {
  if (v == null || v === "") {
    if (required) fail(`${field} is required.`);
    return null;
  }
  if (typeof v !== "string") fail(`${field} must be text.`);
  const s = v.trim();
  if (required && !s) fail(`${field} is required.`);
  if (s.length > max) fail(`${field} must be at most ${max} characters.`);
  return s || null;
};

export function parseInvite(body: Record<string, unknown>): Invite {
  return {
    title: text(body.title, "Project name", 80, true)!,
    role: text(body.role, "Role", 60),
    when: text(body.when, "When", 80),
    where: text(body.where, "Where", 80),
    note: text(body.note, "Message", 1000),
  };
}

export function parseMessage(body: Record<string, unknown>) {
  const message = text(body.body, "Message", MAX_MESSAGE) ?? "";
  const mediaIds = body.mediaIds === undefined ? [] : body.mediaIds;
  if (!Array.isArray(mediaIds) || mediaIds.length > MAX_ATTACHMENTS || !mediaIds.every((m) => typeof m === "string" && m.length <= 40)) fail(`Attach up to ${MAX_ATTACHMENTS} files.`);
  if (!message && !mediaIds.length) fail("Write something or attach a recording.");
  const replyToId = body.replyToId == null ? null : typeof body.replyToId === "string" && body.replyToId.length <= 40 ? body.replyToId : fail("replyToId must be an id.");
  return { body: message, mediaIds: [...new Set(mediaIds as string[])], replyToId };
}

// ── Who can talk to whom ───────────────────────────────────────────────

export async function blockedBetween(a: string, b: string) {
  return (await prisma.block.count({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] } })) > 0;
}

/** Throws unless `sender` may start a conversation with (or add to a project) `recipientId`. */
export async function assertCanReach(senderId: string, recipientId: string) {
  if (senderId === recipientId) throw new ApiError(400, "That's you.");
  const r = await prisma.user.findFirst({ where: { id: recipientId, status: "ACTIVE", kind: "PERSON" }, select: { handle: true, dmPolicy: true } });
  if (!r || (await blockedBetween(senderId, recipientId))) throw new ApiError(403, "You can't message this musician.");
  if (r.dmPolicy === "NOBODY") throw new ApiError(403, `@${r.handle} isn't taking messages right now.`);
  if (r.dmPolicy === "FOLLOWING" && !(await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: recipientId, followingId: senderId } } }))) {
    throw new ApiError(403, `@${r.handle} takes messages from people they follow.`);
  }
}

const directKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);

/** The one conversation two people share, created on first contact. */
export async function directConversation(senderId: string, recipientId: string) {
  const key = directKey(senderId, recipientId);
  const existing = await prisma.conversation.findUnique({ where: { directKey: key }, select: { id: true } });
  if (existing) return existing.id;
  await assertCanReach(senderId, recipientId);
  try {
    const c = await prisma.conversation.create({
      data: { kind: "DIRECT", directKey: key, createdById: senderId, members: { create: [{ userId: senderId }, { userId: recipientId }] } },
      select: { id: true },
    });
    return c.id;
  } catch {
    // Both started it at the same moment.
    return (await prisma.conversation.findUniqueOrThrow({ where: { directKey: key }, select: { id: true } })).id;
  }
}

/** The caller's active membership, or a 404 (not 403: don't confirm a conversation exists). */
async function membership(userId: string, conversationId: string) {
  const m = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { leftAt: true, joinedAt: true, lastReadAt: true, conversation: { select: { id: true, kind: true, members: { where: { leftAt: null }, select: { userId: true } } } } },
  });
  if (!m || m.leftAt) throw new ApiError(404, "Conversation not found.");
  return m;
}

async function screen(actor: Actor, body: string) {
  if (!body) return;
  if (await hasBlockedTerm(body)) throw new ApiError(400, "That message includes words this community doesn't allow.");
  const author = await prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { createdAt: true } });
  const { hold, reasons } = await screenText(body, author);
  if (hold) throw new ApiError(400, `This message can't be sent yet: ${reasons.join(", ")}.`);
}

// ── Sending ────────────────────────────────────────────────────────────

export async function sendMessage(actor: Actor, conversationId: string, input: ReturnType<typeof parseMessage>) {
  const m = await membership(actor.id, conversationId);
  if (m.conversation.kind === "DIRECT") {
    const other = m.conversation.members.find((x) => x.userId !== actor.id);
    if (!other || (await blockedBetween(actor.id, other.userId))) throw new ApiError(403, "You can't message this musician.");
  }
  await screen(actor, input.body);
  if (input.replyToId && !(await prisma.message.count({ where: { id: input.replyToId, conversationId } }))) fail("That reply isn't in this conversation.");
  const now = new Date();
  const id = await prisma.$transaction(async (tx) => {
    const msg = await tx.message.create({ data: { conversationId, authorId: actor.id, body: input.body, replyToId: input.replyToId, createdAt: now }, select: { id: true } });
    if (input.mediaIds.length) {
      const { count } = await tx.media.updateMany({ where: { id: { in: input.mediaIds }, ownerId: actor.id, purpose: "MESSAGE", messageId: null, status: { in: ["PROCESSING", "READY"] } }, data: { messageId: msg.id } });
      if (count !== input.mediaIds.length) throw new ApiError(400, "Some attachments aren't uploaded yet or can't be used.");
    }
    await touch(tx, conversationId, actor.id, now);
    return msg.id;
  });
  return (await loadMessages(actor.id, conversationId, { ids: [id] }))[0];
}

async function touch(tx: Prisma.TransactionClient, conversationId: string, authorId: string, at: Date) {
  await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: at, lastMessageAuthorId: authorId } });
  await tx.conversationMember.update({ where: { conversationId_userId: { conversationId, userId: authorId } }, data: { lastReadAt: at } });
}

/** Starts (or reuses) a direct conversation and sends the first message. */
export async function messageMusician(actor: Actor, recipientId: string, input: ReturnType<typeof parseMessage>) {
  const conversationId = await directConversation(actor.id, recipientId);
  const message = await sendMessage(actor, conversationId, input);
  return { conversationId, message };
}

// ── Collaboration ──────────────────────────────────────────────────────

export async function sendInvite(actor: Actor, recipientId: string, invite: Invite) {
  await screen(actor, [invite.title, invite.role, invite.when, invite.where, invite.note].filter(Boolean).join("\n"));
  const conversationId = await directConversation(actor.id, recipientId);
  if (await blockedBetween(actor.id, recipientId)) throw new ApiError(403, "You can't message this musician.");
  const pending = await prisma.message.count({ where: { conversationId, authorId: actor.id, kind: "COLLAB_INVITE", inviteStatus: "PENDING" } });
  if (pending >= 3) throw new ApiError(429, "They haven't answered your earlier invites yet.");
  const now = new Date();
  const message = await prisma.$transaction(async (tx) => {
    const msg = await tx.message.create({ data: { conversationId, authorId: actor.id, kind: "COLLAB_INVITE", body: invite.note ?? "", invite, inviteStatus: "PENDING", createdAt: now }, select: { id: true } });
    await touch(tx, conversationId, actor.id, now);
    return msg;
  });
  await notify({ userId: recipientId, type: "COLLAB_INVITE", actorId: actor.id, data: { conversationId, title: invite.title } });
  return { conversationId, messageId: message.id };
}

/** The recipient answers. Accepting starts a project with both of them. */
export async function answerInvite(actor: Actor, messageId: string, accept: boolean) {
  const msg = await prisma.message.findUnique({ where: { id: messageId }, select: { id: true, conversationId: true, authorId: true, kind: true, inviteStatus: true, invite: true } });
  if (!msg || msg.kind !== "COLLAB_INVITE") throw new ApiError(404, "Invite not found.");
  await membership(actor.id, msg.conversationId);
  if (msg.authorId === actor.id) throw new ApiError(400, "You sent this invite.");
  if (msg.inviteStatus !== "PENDING") throw new ApiError(409, "This invite has already been answered.");
  if (accept && (await blockedBetween(actor.id, msg.authorId))) throw new ApiError(403, "You can't collaborate with this musician.");
  const invite = msg.invite as Invite;
  const now = new Date();
  const projectId = await prisma.$transaction(async (tx) => {
    const { count } = await tx.message.updateMany({ where: { id: msg.id, inviteStatus: "PENDING" }, data: { inviteStatus: accept ? "ACCEPTED" : "DECLINED" } });
    if (!count) throw new ApiError(409, "This invite has already been answered.");
    if (!accept) return null;
    const project = await tx.conversation.create({
      data: {
        kind: "PROJECT",
        title: invite.title,
        brief: [invite.role && `Looking for: ${invite.role}`, invite.when && `When: ${invite.when}`, invite.where && `Where: ${invite.where}`].filter(Boolean).join(" · ") || null,
        createdById: msg.authorId,
        lastMessageAt: now,
        lastMessageAuthorId: actor.id,
        members: { create: [{ userId: msg.authorId }, { userId: actor.id, lastReadAt: now }] },
      },
      select: { id: true },
    });
    await tx.message.create({ data: { conversationId: project.id, authorId: actor.id, kind: "SYSTEM", body: "accepted the invite and started this project. Share recordings and feedback here.", createdAt: now } });
    await tx.message.update({ where: { id: msg.id }, data: { projectId: project.id } });
    return project.id;
  });
  if (accept) await notify({ userId: msg.authorId, type: "COLLAB_ACCEPTED", actorId: actor.id, data: { conversationId: projectId, title: invite.title } });
  return { projectId };
}

export async function addProjectMember(actor: Actor, projectId: string, userId: string) {
  const m = await membership(actor.id, projectId);
  if (m.conversation.kind !== "PROJECT") throw new ApiError(400, "Only projects can have more members.");
  if (m.conversation.members.some((x) => x.userId === userId)) throw new ApiError(409, "They're already in this project.");
  if (m.conversation.members.length >= MAX_PROJECT_MEMBERS) throw new ApiError(400, `Projects have up to ${MAX_PROJECT_MEMBERS} members.`);
  await assertCanReach(actor.id, userId);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.conversationMember.upsert({ where: { conversationId_userId: { conversationId: projectId, userId } }, create: { conversationId: projectId, userId }, update: { leftAt: null, joinedAt: now, lastReadAt: null } });
    const added = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { handle: true } });
    await tx.message.create({ data: { conversationId: projectId, authorId: actor.id, kind: "SYSTEM", body: `added @${added.handle} to the project.`, createdAt: now } });
    await touch(tx, projectId, actor.id, now);
  });
  const title = (await prisma.conversation.findUniqueOrThrow({ where: { id: projectId }, select: { title: true } })).title;
  await notify({ userId, type: "PROJECT_ADDED", actorId: actor.id, data: { conversationId: projectId, title } });
}

export async function leaveProject(actor: Actor, projectId: string) {
  const m = await membership(actor.id, projectId);
  if (m.conversation.kind !== "PROJECT") throw new ApiError(400, "You can leave projects, not direct conversations.");
  const now = new Date();
  await prisma.$transaction([
    prisma.message.create({ data: { conversationId: projectId, authorId: actor.id, kind: "SYSTEM", body: "left the project.", createdAt: now } }),
    prisma.conversation.update({ where: { id: projectId }, data: { lastMessageAt: now, lastMessageAuthorId: actor.id } }),
    prisma.conversationMember.update({ where: { conversationId_userId: { conversationId: projectId, userId: actor.id } }, data: { leftAt: now } }),
  ]);
}

// ── Reactions, deletion, reading ───────────────────────────────────────

export async function react(actor: Actor, messageId: string, emoji: string, on: boolean) {
  if (!(MESSAGE_REACTIONS as readonly string[]).includes(emoji)) fail("Pick one of the reactions offered.");
  const msg = await prisma.message.findFirst({ where: { id: messageId, deletedAt: null, kind: { not: "SYSTEM" } }, select: { conversationId: true } });
  if (!msg) throw new ApiError(404, "Message not found.");
  await membership(actor.id, msg.conversationId);
  if (on) await prisma.messageReaction.upsert({ where: { messageId_userId_emoji: { messageId, userId: actor.id, emoji } }, create: { messageId, userId: actor.id, emoji }, update: {} });
  else await prisma.messageReaction.deleteMany({ where: { messageId, userId: actor.id, emoji } });
}

/** Authors can delete their own messages: the text goes, attachments stop being served. */
export async function deleteMessage(actor: Actor, messageId: string) {
  const { count } = await prisma.message.updateMany({ where: { id: messageId, authorId: actor.id, deletedAt: null, kind: "TEXT" }, data: { deletedAt: new Date(), body: "" } });
  if (!count) throw new ApiError(404, "Message not found.");
}

export async function markRead(userId: string, conversationId: string) {
  await membership(userId, conversationId);
  await prisma.conversationMember.update({ where: { conversationId_userId: { conversationId, userId } }, data: { lastReadAt: new Date() } });
}

/** Conversations with something new from someone else, for the nav badge. */
export async function unreadConversationCount(userId: string) {
  const [{ n }] = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM "ConversationMember" m
    JOIN "Conversation" c ON c.id = m."conversationId"
    WHERE m."userId" = ${userId} AND m."leftAt" IS NULL
      AND c."lastMessageAuthorId" IS NOT NULL AND c."lastMessageAuthorId" <> ${userId}
      AND c."lastMessageAt" > coalesce(m."lastReadAt", m."joinedAt" - interval '1 second')
      AND NOT EXISTS (SELECT 1 FROM "Block" b WHERE (b."blockerId" = ${userId} AND b."blockedId" = c."lastMessageAuthorId") OR (b."blockedId" = ${userId} AND b."blockerId" = c."lastMessageAuthorId"))`;
  return Number(n);
}

// ── Reading ────────────────────────────────────────────────────────────

const MESSAGE_SELECT = {
  id: true, kind: true, body: true, createdAt: true, deletedAt: true, invite: true, inviteStatus: true, projectId: true,
  author: { select: AUTHOR_SELECT },
  replyTo: { select: { id: true, body: true, deletedAt: true, author: { select: { handle: true, name: true } } } },
  reactions: { select: { emoji: true, userId: true } },
  media: { where: { status: { in: ["PROCESSING", "READY"] } }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.MessageSelect;

function toView(m: Prisma.MessageGetPayload<{ select: typeof MESSAGE_SELECT }>, viewerId: string): MessageView {
  const counts = new Map<string, { count: number; mine: boolean }>();
  for (const r of m.reactions) {
    const c = counts.get(r.emoji) ?? { count: 0, mine: false };
    counts.set(r.emoji, { count: c.count + 1, mine: c.mine || r.userId === viewerId });
  }
  return {
    id: m.id,
    kind: m.kind,
    body: m.deletedAt ? "" : m.body,
    createdAt: m.createdAt.toISOString(),
    deleted: !!m.deletedAt,
    author: { id: m.author.id, handle: m.author.handle, name: m.author.name, image: m.author.image },
    mine: m.author.id === viewerId,
    replyTo: m.replyTo && { id: m.replyTo.id, body: m.replyTo.deletedAt ? "Message deleted" : m.replyTo.body.slice(0, 140), author: m.replyTo.author.name ?? m.replyTo.author.handle },
    reactions: [...counts].map(([emoji, c]) => ({ emoji, ...c })),
    media: m.deletedAt ? [] : m.media.map((x) => toMediaView(x, viewerId)),
    invite: m.kind === "COLLAB_INVITE" && m.invite ? { ...(m.invite as Invite), status: m.inviteStatus ?? "PENDING", projectId: m.projectId } : null,
  };
}

async function loadMessages(viewerId: string, conversationId: string, opts: { before?: Date; after?: Date; ids?: string[] }) {
  const rows = await prisma.message.findMany({
    where: { conversationId, ...(opts.ids && { id: { in: opts.ids } }), ...(opts.before && { createdAt: { lt: opts.before } }), ...(opts.after && { createdAt: { gt: opts.after } }) },
    orderBy: { createdAt: opts.after ? "asc" : "desc" },
    take: PAGE,
    select: MESSAGE_SELECT,
  });
  const views = rows.map((r) => toView(r, viewerId));
  return opts.after ? views : views.reverse();
}

/** A page of messages, oldest first. `after` returns only what's new (for live updates). */
export async function getMessages(viewerId: string, conversationId: string, opts: { before?: Date; after?: Date } = {}) {
  const m = await membership(viewerId, conversationId);
  const messages = await loadMessages(viewerId, conversationId, opts);
  return { messages, hasMore: !opts.after && messages.length === PAGE, lastReadAt: m.lastReadAt?.toISOString() ?? null };
}

export async function getConversation(viewerId: string, conversationId: string): Promise<ConversationSummary> {
  await membership(viewerId, conversationId);
  return (await listConversations(viewerId, { ids: [conversationId] }))[0];
}

export async function listConversations(viewerId: string, opts: { kind?: "DIRECT" | "PROJECT"; ids?: string[] } = {}): Promise<ConversationSummary[]> {
  const blocked = (await prisma.block.findMany({ where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] }, select: { blockerId: true, blockedId: true } })).map((b) => (b.blockerId === viewerId ? b.blockedId : b.blockerId));
  const rows = await prisma.conversationMember.findMany({
    where: { userId: viewerId, leftAt: null, ...(opts.ids && { conversationId: { in: opts.ids } }), ...(opts.kind && { conversation: { kind: opts.kind } }) },
    orderBy: { conversation: { lastMessageAt: "desc" } },
    take: 60,
    select: {
      lastReadAt: true,
      joinedAt: true,
      conversation: {
        select: {
          id: true, kind: true, title: true, brief: true, lastMessageAt: true, lastMessageAuthorId: true,
          members: { where: { leftAt: null }, select: { user: { select: AUTHOR_SELECT } } },
          messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, kind: true, deletedAt: true, createdAt: true, author: { select: { id: true, handle: true, name: true } } } },
        },
      },
    },
  });
  const invites = new Set(
    (await prisma.message.findMany({ where: { conversationId: { in: rows.map((r) => r.conversation.id) }, kind: "COLLAB_INVITE", inviteStatus: "PENDING", authorId: { not: viewerId } }, select: { conversationId: true } })).map((m) => m.conversationId),
  );
  return rows.flatMap(({ conversation: c, lastReadAt, joinedAt }) => {
    const others = c.members.map((m) => m.user).filter((u) => u.id !== viewerId);
    // A blocked person's direct conversation disappears for both sides.
    if (c.kind === "DIRECT" && others.some((u) => blocked.includes(u.id))) return [];
    const last = c.messages[0];
    const preview = !last ? null : last.deletedAt ? "Message deleted" : last.kind === "COLLAB_INVITE" ? "Sent a collaboration invite" : last.kind === "SYSTEM" ? `${last.author.name ?? last.author.handle} ${last.body}` : last.body || "Sent a recording";
    return [{
      id: c.id,
      kind: c.kind,
      title: c.kind === "PROJECT" ? c.title ?? "Project" : others.map((u) => u.name ?? u.handle).join(", ") || "Just you",
      brief: c.brief,
      members: c.members.map((m) => ({ id: m.user.id, handle: m.user.handle, name: m.user.name, image: m.user.image })),
      last: last && preview ? { body: preview.slice(0, 120), author: last.author.id === viewerId ? "You" : last.author.name ?? last.author.handle, at: last.createdAt.toISOString() } : null,
      unread: !!c.lastMessageAuthorId && c.lastMessageAuthorId !== viewerId && c.lastMessageAt > (lastReadAt ?? new Date(joinedAt.getTime() - 1000)),
      pendingInvite: invites.has(c.id),
    }];
  });
}

/** Media attached to messages: only members of that conversation (and the uploader) may fetch it. */
export async function canViewMessageMedia(messageId: string | null, viewerId: string | null) {
  if (!messageId || !viewerId) return false;
  return (await prisma.message.count({ where: { id: messageId, deletedAt: null, conversation: { members: { some: { userId: viewerId, leftAt: null } } } } })) > 0;
}
