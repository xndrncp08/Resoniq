import type { ContentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import type { Actor } from "@/lib/authz";
import { screenText } from "@/lib/automod";
import { notify, type NotifyInput } from "@/lib/notify";
import { visiblePostWhere } from "@/lib/posts";
import { AUTHOR_SELECT, type Author } from "@/lib/profiles";
import { extractMentions } from "@/lib/rich-text";
import { fail } from "@/lib/validation";

export const MAX_COMMENT = 5_000;
export const MAX_DEPTH = 6;
// shortcut: a thread loads at most this many comments at once; add per-branch paging when threads outgrow it.
export const THREAD_LIMIT = 500;

export function parseCommentBody(v: unknown): string {
  if (typeof v !== "string") fail("Comment must be text.");
  const body = v.trim();
  if (!body) fail("Write a comment first.");
  if (body.length > MAX_COMMENT) fail(`Comments are at most ${MAX_COMMENT} characters.`);
  return body;
}

export type CommentView = {
  id: string;
  parentId: string | null;
  depth: number;
  body: string;
  status: ContentStatus;
  score: number;
  replyCount: number;
  createdAt: string;
  editedAt: string | null;
  author: Author | null;
  viewer: { vote: -1 | 0 | 1; isAuthor: boolean };
};

const COMMENT_SELECT = {
  id: true,
  parentId: true,
  depth: true,
  body: true,
  status: true,
  score: true,
  replyCount: true,
  createdAt: true,
  editedAt: true,
  authorId: true,
  author: { select: { ...AUTHOR_SELECT, status: true } },
} satisfies Prisma.CommentSelect;

type Row = Prisma.CommentGetPayload<{ select: typeof COMMENT_SELECT }>;

function toView(r: Row, viewerId: string | null, vote = 0): CommentView | null {
  const isAuthor = viewerId === r.authorId;
  const hiddenAuthor = r.author.status === "BANNED";
  const gone = r.status === "DELETED" || r.status === "REMOVED" || hiddenAuthor || (r.status === "HELD" && !isAuthor);
  // Gone comments with replies stay as placeholders so the thread keeps its shape.
  if (gone && r.replyCount === 0) return null;
  const { status: _s, ...author } = r.author;
  return {
    id: r.id,
    parentId: r.parentId,
    depth: r.depth,
    body: gone ? "" : r.body,
    status: gone && r.status === "HELD" ? "REMOVED" : hiddenAuthor ? "REMOVED" : r.status,
    score: gone ? 0 : r.score,
    replyCount: r.replyCount,
    createdAt: r.createdAt.toISOString(),
    editedAt: r.editedAt?.toISOString() ?? null,
    author: gone ? null : author,
    viewer: { vote: Math.sign(vote) as -1 | 0 | 1, isAuthor },
  };
}

async function visiblePost(postId: string, viewerId: string | null) {
  const post = await prisma.post.findFirst({ where: { AND: [{ id: postId }, visiblePostWhere(viewerId)] }, select: { id: true, authorId: true, status: true } });
  if (!post) throw new ApiError(404, "Post not found.");
  return post;
}

/** A flat, chronological list; clients build the tree from parentId. */
export async function listComments(postId: string, viewerId: string | null): Promise<CommentView[]> {
  await visiblePost(postId, viewerId);
  const rows = await prisma.comment.findMany({ where: { postId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: THREAD_LIMIT, select: COMMENT_SELECT });
  const votes = viewerId
    ? new Map(
        (await prisma.commentVote.findMany({ where: { userId: viewerId, commentId: { in: rows.map((r) => r.id) } }, select: { commentId: true, value: true } })).map((v) => [v.commentId, v.value]),
      )
    : new Map<string, number>();
  return rows.map((r) => toView(r, viewerId, votes.get(r.id))).filter((c): c is CommentView => c !== null);
}

export async function createComment(actor: Actor, postId: string, input: { body: string; parentId: string | null }): Promise<CommentView> {
  const post = await visiblePost(postId, actor.id);
  if (post.status !== "PUBLISHED") throw new ApiError(400, "This post isn't open for comments yet.");
  const parent = input.parentId
    ? await prisma.comment.findFirst({ where: { id: input.parentId, postId }, select: { id: true, depth: true, authorId: true, status: true } })
    : null;
  if (input.parentId && (!parent || parent.status === "DELETED" || parent.status === "REMOVED")) throw new ApiError(404, "Comment not found.");
  if (parent && parent.depth + 1 > MAX_DEPTH) throw new ApiError(400, "This thread is too deep to reply to.");

  const author = await prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { createdAt: true } });
  const screen = await screenText(input.body, author);
  const row = await prisma.$transaction(async (tx) => {
    const c = await tx.comment.create({
      data: { postId, authorId: actor.id, parentId: parent?.id ?? null, depth: parent ? parent.depth + 1 : 0, body: input.body, status: screen.hold ? "HELD" : "PUBLISHED" },
      select: COMMENT_SELECT,
    });
    if (!screen.hold) {
      await tx.post.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } });
      if (parent) await tx.comment.update({ where: { id: parent.id }, data: { replyCount: { increment: 1 } } });
    }
    return c;
  });

  if (!screen.hold) {
    const items: NotifyInput[] = [
      parent
        ? { userId: parent.authorId, type: "REPLY", actorId: actor.id, postId, commentId: row.id }
        : { userId: post.authorId, type: "COMMENT", actorId: actor.id, postId, commentId: row.id },
    ];
    const handles = extractMentions(input.body);
    if (handles.length) {
      const users = await prisma.user.findMany({ where: { handle: { in: handles } }, select: { id: true } });
      for (const u of users) if (!items.some((i) => i.userId === u.id)) items.push({ userId: u.id, type: "MENTION", actorId: actor.id, postId, commentId: row.id });
    }
    await notify(items);
  }
  return toView(row, actor.id)!;
}

export async function editComment(actor: Actor, id: string, body: string): Promise<CommentView> {
  const author = await prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { createdAt: true } });
  const screen = await screenText(body, author);
  const row = await prisma.$transaction(async (tx) => {
    const [existing] = await tx.$queryRaw<{ status: ContentStatus; postId: string; parentId: string | null }[]>`
      SELECT status, "postId", "parentId" FROM "Comment"
      WHERE id = ${id} AND "authorId" = ${actor.id} AND status IN ('PUBLISHED', 'HELD') FOR UPDATE`;
    if (!existing) throw new ApiError(404, "Comment not found.");
    if (screen.hold && existing.status === "PUBLISHED") {
      await tx.post.update({ where: { id: existing.postId }, data: { commentCount: { decrement: 1 } } });
      if (existing.parentId) await tx.comment.update({ where: { id: existing.parentId }, data: { replyCount: { decrement: 1 } } });
    }
    return tx.comment.update({ where: { id }, data: { body, editedAt: new Date(), ...(screen.hold && { status: "HELD" }) }, select: COMMENT_SELECT });
  });
  return toView(row, actor.id) ?? (() => { throw new ApiError(404, "Comment not found."); })();
}

/** Soft delete: the row stays (as a placeholder when it has replies) so threads don't collapse. */
export async function deleteComment(actor: Actor, id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const c = await tx.comment.findFirst({ where: { id, authorId: actor.id, status: { not: "DELETED" } }, select: { postId: true, parentId: true, status: true } });
    if (!c) throw new ApiError(404, "Comment not found.");
    await tx.comment.update({ where: { id }, data: { status: "DELETED", body: "" } });
    if (c.status === "PUBLISHED") {
      await tx.post.update({ where: { id: c.postId }, data: { commentCount: { decrement: 1 } } });
      if (c.parentId) await tx.comment.update({ where: { id: c.parentId }, data: { replyCount: { decrement: 1 } } });
    }
  });
}

export async function voteComment(userId: string, commentId: string, value: -1 | 0 | 1) {
  return prisma.$transaction(async (tx) => {
    const [c] = await tx.$queryRaw<{ id: string; authorId: string; score: number; status: ContentStatus; postStatus: ContentStatus }[]>`
      SELECT c.id, c."authorId", c.score, c.status, p.status AS "postStatus" FROM "Comment" c
      JOIN "Post" p ON p.id = c."postId"
      WHERE c.id = ${commentId} FOR UPDATE OF c`;
    if (!c || c.status !== "PUBLISHED" || c.postStatus !== "PUBLISHED") throw new ApiError(404, "Comment not found.");
    const existing = await tx.commentVote.findUnique({ where: { userId_commentId: { userId, commentId } }, select: { value: true } });
    const before = existing?.value ?? 0;
    if (before === value) return { score: c.score, vote: value };
    if (value === 0) await tx.commentVote.delete({ where: { userId_commentId: { userId, commentId } } });
    else await tx.commentVote.upsert({ where: { userId_commentId: { userId, commentId } }, create: { userId, commentId, value }, update: { value } });
    const score = c.score + value - before;
    await tx.comment.update({ where: { id: commentId }, data: { score } });
    if (c.authorId !== userId) await tx.user.update({ where: { id: c.authorId }, data: { reputation: { increment: value - before } } });
    return { score, vote: value };
  });
}

export function parseVote(v: unknown): -1 | 0 | 1 {
  if (v !== -1 && v !== 0 && v !== 1) fail("Vote must be 1, 0 or -1.");
  return v;
}
