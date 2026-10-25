import type { ContentStatus, PostCategory, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import type { Actor } from "@/lib/authz";
import { screenText } from "@/lib/automod";
import { notify } from "@/lib/notify";
import { page, type Cursor } from "@/lib/pagination";
import { AUTHOR_SELECT, type Author } from "@/lib/profiles";
import { hotRank } from "@/lib/ranking";
import { extractMentions, extractTags } from "@/lib/rich-text";
import { fail } from "@/lib/validation";
import { recipeCoreFromStored } from "@/lib/tone-recipe";
import type { RigSpec } from "@/types/rig";
import { toMediaView, type MediaView } from "@/lib/media/view";

export const POST_CATEGORIES: PostCategory[] = [
  "DISCUSSION", "QUESTION", "PERFORMANCE", "COVER", "GEAR_DEMO", "TONE_COMPARISON", "TUTORIAL", "PEDALBOARD",
];
export const MAX_TITLE = 200;
export const MAX_BODY = 10_000;

export type PostInput = { title: string | null; body: string; category: PostCategory; communitySlug: string | null; toneId: string | null; mediaIds?: string[] };

export function parsePostInput(body: Record<string, unknown>, { partial = false } = {}): Partial<PostInput> {
  const out: Partial<PostInput> = {};
  if (body.title !== undefined || !partial) {
    const t = body.title;
    if (t !== undefined && t !== null && typeof t !== "string") fail("Title must be text.");
    const title = typeof t === "string" ? t.trim() : "";
    if (title.length > MAX_TITLE) fail(`Titles are at most ${MAX_TITLE} characters.`);
    out.title = title || null;
  }
  if (body.body !== undefined || !partial) {
    if (body.body !== undefined && typeof body.body !== "string") fail("Post text must be text.");
    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (text.length > MAX_BODY) fail(`Posts are at most ${MAX_BODY} characters.`);
    out.body = text;
  }
  if (body.category !== undefined || !partial) {
    const c = (body.category ?? "DISCUSSION") as PostCategory;
    if (!POST_CATEGORIES.includes(c)) fail("Unknown post type.");
    out.category = c;
  }
  if (!partial) {
    out.communitySlug = typeof body.community === "string" && body.community ? body.community.toLowerCase() : null;
    out.toneId = typeof body.toneId === "string" && body.toneId ? body.toneId : null;
    if (body.mediaIds !== undefined) {
      if (!Array.isArray(body.mediaIds) || !body.mediaIds.every((m) => typeof m === "string")) fail("mediaIds must be a list of ids.");
      out.mediaIds = body.mediaIds as string[];
    }
  }
  return out;
}

// ── Views ──────────────────────────────────────────────────────────────

export const POST_VIEW_SELECT = {
  id: true,
  category: true,
  title: true,
  body: true,
  status: true,
  heldReasons: true,
  removedReason: true,
  score: true,
  upCount: true,
  commentCount: true,
  bookmarkCount: true,
  hotRank: true,
  createdAt: true,
  editedAt: true,
  authorId: true,
  toneId: true,
  author: { select: AUTHOR_SELECT },
  community: { select: { id: true, slug: true, name: true, kind: true } },
  tags: { select: { tag: true } },
  tone: { select: { id: true, name: true, visibility: true, data: true, rig: true, recipeEdited: true, saveCount: true, origin: true } },
  media: { where: { status: { in: ["PROCESSING", "READY", "FAILED"] } }, orderBy: { position: "asc" } },
} satisfies Prisma.PostSelect;

/** What a post card shows about its attached tone. Private tones are never exposed through posts. */
export type PostTone = {
  origin?: "member" | "generated";
  id: string;
  name: string;
  saveCount: number;
  declared: { instrument: string | null; amp: string | null; blocks: number } | null;
  inferred: { amp: string; gain: number; edited: boolean } | null;
};

function toPostTone(t: PostRow["tone"]): PostTone | null {
  if (!t || t.visibility === "PRIVATE") return null;
  const rig = t.rig as RigSpec | null;
  const core = recipeCoreFromStored(t.data);
  const name = (r?: { brand?: string; model: string }) => (r ? [r.brand, r.model].filter(Boolean).join(" ") : null);
  return {
    id: t.id,
    name: t.name,
    origin: t.origin === "GENERATED" ? "generated" : "member",
    saveCount: t.saveCount,
    declared: rig && { instrument: name(rig.instrument?.ref) ?? (rig.instrument ? rig.instrument.kind.toLowerCase() : null), amp: name(rig.amp?.ref), blocks: rig.chain.length },
    inferred: core && { amp: core.amp.model, gain: core.amp.gain, edited: t.recipeEdited },
  };
}

type PostRow = Prisma.PostGetPayload<{ select: typeof POST_VIEW_SELECT }>;

export type PostView = {
  id: string;
  category: PostCategory;
  title: string | null;
  body: string;
  status: ContentStatus;
  heldReasons: string[];
  score: number;
  upCount: number;
  commentCount: number;
  bookmarkCount: number;
  createdAt: string;
  editedAt: string | null;
  author: Author;
  community: { slug: string; name: string; kind: string } | null;
  tags: string[];
  tone: PostTone | null;
  media: MediaView[];
  viewer: { vote: -1 | 0 | 1; bookmarked: boolean; isAuthor: boolean };
};

export function toPostView(row: PostRow, viewer: { vote?: number; bookmarked?: boolean; viewerId?: string | null } = {}): PostView {
  const isAuthor = !!viewer.viewerId && viewer.viewerId === row.authorId;
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    body: row.body,
    status: row.status,
    // Hold reasons are for the author and staff; others never see held posts anyway.
    heldReasons: isAuthor ? row.heldReasons : [],
    score: row.score,
    upCount: row.upCount,
    commentCount: row.commentCount,
    bookmarkCount: row.bookmarkCount,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
    author: row.author,
    community: row.community && { slug: row.community.slug, name: row.community.name, kind: row.community.kind },
    tags: row.tags.map((t) => t.tag),
    tone: toPostTone(row.tone),
    // Others only ever see finished media; the author also sees what's processing or failed.
    media: row.media.filter((m) => isAuthor || m.status === "READY").map((m) => toMediaView(m, viewer.viewerId ?? null)),
    viewer: { vote: (Math.sign(viewer.vote ?? 0) as -1 | 0 | 1), bookmarked: !!viewer.bookmarked, isAuthor },
  };
}

/** Attaches the viewer's votes and bookmarks with two queries for the whole page. */
export async function withViewerState(rows: PostRow[], viewerId: string | null): Promise<PostView[]> {
  if (!viewerId || rows.length === 0) return rows.map((r) => toPostView(r, { viewerId }));
  const ids = rows.map((r) => r.id);
  const [votes, marks] = await Promise.all([
    prisma.postVote.findMany({ where: { userId: viewerId, postId: { in: ids } }, select: { postId: true, value: true } }),
    prisma.bookmark.findMany({ where: { userId: viewerId, postId: { in: ids } }, select: { postId: true } }),
  ]);
  const vote = new Map(votes.map((v) => [v.postId, v.value]));
  const marked = new Set(marks.map((b) => b.postId));
  return rows.map((r) => toPostView(r, { viewerId, vote: vote.get(r.id), bookmarked: marked.has(r.id) }));
}

/**
 * What a viewer may see: published posts by non-banned authors, plus the
 * viewer's own held or processing posts. Removed and deleted posts never list.
 */
export function visiblePostWhere(viewerId: string | null): Prisma.PostWhereInput {
  return {
    author: { status: { not: "BANNED" } },
    OR: [{ status: "PUBLISHED" }, ...(viewerId ? [{ status: { in: ["HELD", "PROCESSING"] as ContentStatus[] }, authorId: viewerId }] : [])],
  };
}

export async function getPost(id: string, viewerId: string | null, { staff = false } = {}): Promise<PostView | null> {
  const row = await prisma.post.findFirst({
    where: staff ? { id } : { AND: [{ id }, visiblePostWhere(viewerId)] },
    select: POST_VIEW_SELECT,
  });
  if (!row) return null;
  return (await withViewerState([row], viewerId))[0];
}

// ── Writes ─────────────────────────────────────────────────────────────

type Db = Prisma.TransactionClient;

async function setTags(tx: Db, postId: string, text: string) {
  await tx.postTag.deleteMany({ where: { postId } });
  const tags = extractTags(text);
  if (tags.length) await tx.postTag.createMany({ data: tags.map((tag) => ({ postId, tag })) });
}

async function mentionTargets(text: string, excludeId: string) {
  const handles = extractMentions(text);
  if (!handles.length) return [];
  const users = await prisma.user.findMany({ where: { handle: { in: handles }, status: { not: "BANNED" }, id: { not: excludeId } }, select: { id: true } });
  return users.map((u) => u.id);
}

/** Hook for later phases (tones, media) to validate and link attachments inside the create transaction. */
export type PostAttachHook = (tx: Db, postId: string) => Promise<{ processing?: boolean } | void>;

export async function createPost(
  actor: Actor,
  input: PostInput,
  opts: { attach?: PostAttachHook; requireContent?: boolean } = {},
): Promise<PostView> {
  const author = await prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { createdAt: true } });
  const community = input.communitySlug
    ? await prisma.community.findUnique({ where: { slug: input.communitySlug }, select: { id: true, archivedAt: true } })
    : null;
  if (input.communitySlug && !community) throw new ApiError(404, "Community not found.");
  if (community?.archivedAt) throw new ApiError(400, "This community is archived and read-only.");
  if (opts.requireContent !== false && !input.body && !input.title) throw new ApiError(400, "Write something first.");

  const text = [input.title, input.body].filter(Boolean).join("\n");
  const screen = await screenText(text, author);
  const createdAt = new Date();

  const id = await prisma.$transaction(async (tx) => {
    const post = await tx.post.create({
      data: {
        authorId: actor.id,
        communityId: community?.id ?? null,
        category: input.category,
        title: input.title,
        body: input.body,
        status: screen.hold ? "HELD" : "PUBLISHED",
        heldReasons: screen.reasons,
        hotRank: hotRank(0, createdAt),
        createdAt,
      },
      select: { id: true },
    });
    const attached = opts.attach ? await opts.attach(tx, post.id) : undefined;
    if (attached?.processing && !screen.hold) await tx.post.update({ where: { id: post.id }, data: { status: "PROCESSING" } });
    await setTags(tx, post.id, text);
    if (community) await tx.community.update({ where: { id: community.id }, data: { postCount: { increment: 1 } } });
    return post.id;
  });

  if (!screen.hold) {
    const mentioned = await mentionTargets(text, actor.id);
    await notify(mentioned.map((userId) => ({ userId, type: "MENTION" as const, actorId: actor.id, postId: id })));
  }
  return (await getPost(id, actor.id))!;
}

export async function editPost(actor: Actor, id: string, patch: Partial<PostInput>): Promise<PostView> {
  const post = await prisma.post.findFirst({ where: { id, authorId: actor.id, status: { in: ["PUBLISHED", "HELD", "PROCESSING"] } } });
  if (!post) throw new ApiError(404, "Post not found.");
  const title = patch.title !== undefined ? patch.title : post.title;
  const body = patch.body !== undefined ? patch.body : post.body;
  const text = [title, body].filter(Boolean).join("\n");
  const author = await prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { createdAt: true } });
  const screen = await screenText(text, author);
  await prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id },
      data: {
        title,
        body,
        category: patch.category ?? post.category,
        editedAt: new Date(),
        // An edit can trip automod; it never clears a hold a moderator hasn't reviewed.
        ...(screen.hold && post.status === "PUBLISHED" && { status: "HELD", heldReasons: screen.reasons }),
      },
    });
    await setTags(tx, id, text);
  });
  return (await getPost(id, actor.id))!;
}

export async function deletePost(actor: Actor, id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const post = await tx.post.findFirst({ where: { id, authorId: actor.id, status: { not: "DELETED" } }, select: { communityId: true, status: true } });
    if (!post) throw new ApiError(404, "Post not found.");
    await tx.post.update({ where: { id }, data: { status: "DELETED" } });
    if (post.communityId) await tx.community.update({ where: { id: post.communityId }, data: { postCount: { decrement: 1 } } });
  });
}

/**
 * Sets the viewer's vote (1, -1, or 0 to clear). Votes on one post are
 * serialized by locking the post row, so concurrent clicks can't double-count.
 */
export async function votePost(userId: string, postId: string, value: -1 | 0 | 1) {
  return prisma.$transaction(async (tx) => {
    const [post] = await tx.$queryRaw<{ id: string; authorId: string; score: number; createdAt: Date; status: ContentStatus }[]>`
      SELECT p.id, p."authorId", p.score, p."createdAt", p.status FROM "Post" p
      JOIN "User" u ON u.id = p."authorId" AND u.status <> 'BANNED'
      WHERE p.id = ${postId} FOR UPDATE OF p`;
    if (!post || post.status !== "PUBLISHED") throw new ApiError(404, "Post not found.");
    const existing = await tx.postVote.findUnique({ where: { userId_postId: { userId, postId } }, select: { value: true } });
    const before = existing?.value ?? 0;
    if (before === value) return { score: post.score, vote: value };

    if (value === 0) await tx.postVote.delete({ where: { userId_postId: { userId, postId } } });
    else await tx.postVote.upsert({ where: { userId_postId: { userId, postId } }, create: { userId, postId, value }, update: { value } });

    const score = post.score + value - before;
    const upDelta = (value === 1 ? 1 : 0) - (before === 1 ? 1 : 0);
    await tx.post.update({ where: { id: postId }, data: { score, upCount: { increment: upDelta }, hotRank: hotRank(score, post.createdAt) } });
    if (post.authorId !== userId) {
      await tx.user.update({ where: { id: post.authorId }, data: { reputation: { increment: value - before } } });
    }
    return { score, vote: value };
  });
}

export async function setBookmark(userId: string, postId: string, on: boolean) {
  return prisma.$transaction(async (tx) => {
    const visible = await tx.post.findFirst({ where: { AND: [{ id: postId }, visiblePostWhere(userId)] }, select: { id: true } });
    if (!visible && on) throw new ApiError(404, "Post not found.");
    const { count } = on
      ? await tx.bookmark.createMany({ data: [{ userId, postId }], skipDuplicates: true })
      : await tx.bookmark.deleteMany({ where: { userId, postId } });
    if (count) await tx.post.update({ where: { id: postId }, data: { bookmarkCount: { increment: on ? 1 : -1 } } });
    return { bookmarked: on };
  });
}

// ── Feeds ──────────────────────────────────────────────────────────────

export type FeedSort = "hot" | "new" | "top";
export type TopWindow = "day" | "week" | "month" | "year" | "all";
export const FEED_SORTS: FeedSort[] = ["hot", "new", "top"];
const WINDOW_MS: Record<TopWindow, number> = { day: 864e5, week: 6048e5, month: 2592e6, year: 31536e6, all: Infinity };

type SortSpec = { field: "hotRank" | "createdAt" | "score"; parse: (t: string) => number | Date; key: (r: PostRow) => string };
const SORTS: Record<FeedSort, SortSpec> = {
  hot: { field: "hotRank", parse: Number, key: (r) => String(r.hotRank) },
  new: { field: "createdAt", parse: (t) => new Date(t), key: (r) => r.createdAt.toISOString() },
  top: { field: "score", parse: Number, key: (r) => String(r.score) },
};

export type FeedQuery = { sort?: FeedSort; window?: TopWindow; category?: PostCategory; cursor: Cursor | null; limit: number };

/** Keyset-paginated posts matching `where`, visible to the viewer, newest/hottest/top first. */
export async function listPosts(where: Prisma.PostWhereInput, viewerId: string | null, q: FeedQuery) {
  const spec = SORTS[q.sort ?? "hot"];
  const and: Prisma.PostWhereInput[] = [where, visiblePostWhere(viewerId)];
  if (q.category) and.push({ category: q.category });
  if (q.sort === "top" && q.window && q.window !== "all") and.push({ createdAt: { gte: new Date(Date.now() - WINDOW_MS[q.window]) } });
  if (q.cursor) {
    const v = spec.parse(q.cursor.t);
    and.push({ OR: [{ [spec.field]: { lt: v } }, { [spec.field]: v, id: { lt: q.cursor.id } }] });
  }
  const rows = await prisma.post.findMany({
    where: { AND: and },
    orderBy: [{ [spec.field]: "desc" }, { id: "desc" }],
    take: q.limit + 1,
    select: POST_VIEW_SELECT,
  });
  const { items, nextCursor } = page(rows, q.limit, (r) => ({ t: spec.key(r), id: r.id }));
  return { items: await withViewerState(items, viewerId), nextCursor };
}

async function graphOf(userId: string) {
  const [follows, memberships, me] = await Promise.all([
    prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true }, take: 2000 }),
    prisma.communityMember.findMany({ where: { userId }, select: { communityId: true }, take: 500 }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { genres: true, instruments: true } }),
  ]);
  return {
    authorIds: [userId, ...follows.map((f) => f.followingId)],
    communityIds: memberships.map((m) => m.communityId),
    interests: [...me.genres, ...me.instruments].map((s) => s.replace(/\s+/g, "-")),
  };
}

/** Recommended score floor for posts from outside the viewer's graph. */
export const DISCOVERY_MIN_SCORE = 3;

/**
 * For you: the viewer's graph (follows, communities) plus communities that
 * match their genres/instruments, plus well-received posts from anywhere.
 * Signed out, it's the global hot feed.
 */
export async function forYouFeed(viewerId: string | null, q: FeedQuery) {
  if (!viewerId) return listPosts({}, null, q);
  const g = await graphOf(viewerId);
  return listPosts(
    {
      OR: [
        { authorId: { in: g.authorIds } },
        ...(g.communityIds.length ? [{ communityId: { in: g.communityIds } }] : []),
        ...(g.interests.length ? [{ community: { slug: { in: g.interests } } }] : []),
        { score: { gte: DISCOVERY_MIN_SCORE } },
      ],
    },
    viewerId,
    q,
  );
}

/** Following: only the people and communities the viewer chose, newest first by default. */
export async function followingFeed(viewerId: string, q: FeedQuery) {
  const g = await graphOf(viewerId);
  return listPosts(
    { OR: [{ authorId: { in: g.authorIds } }, ...(g.communityIds.length ? [{ communityId: { in: g.communityIds } }] : [])] },
    viewerId,
    { ...q, sort: q.sort ?? "new" },
  );
}

export async function bookmarksFeed(viewerId: string, cursor: Cursor | null, limit: number) {
  const rows = await prisma.bookmark.findMany({
    where: {
      userId: viewerId,
      post: visiblePostWhere(viewerId),
      ...(cursor && { OR: [{ createdAt: { lt: new Date(cursor.t) } }, { createdAt: new Date(cursor.t), postId: { lt: cursor.id } }] }),
    },
    orderBy: [{ createdAt: "desc" }, { postId: "desc" }],
    take: limit + 1,
    select: { createdAt: true, postId: true, post: { select: POST_VIEW_SELECT } },
  });
  const { items, nextCursor } = page(rows, limit, (r) => ({ t: r.createdAt.toISOString(), id: r.postId }));
  return { items: await withViewerState(items.map((r) => r.post), viewerId), nextCursor };
}

export function parseFeedQuery(url: URL): Omit<FeedQuery, "cursor" | "limit"> {
  const sort = url.searchParams.get("sort") as FeedSort | null;
  const window = url.searchParams.get("t") as TopWindow | null;
  const category = url.searchParams.get("category") as PostCategory | null;
  return {
    sort: sort && FEED_SORTS.includes(sort) ? sort : undefined,
    window: window && Object.hasOwn(WINDOW_MS, window) ? window : "week",
    category: category && POST_CATEGORIES.includes(category) ? category : undefined,
  };
}
