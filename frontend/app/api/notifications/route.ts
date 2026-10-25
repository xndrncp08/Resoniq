import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { decodeCursor, page, parseLimit } from "@/lib/pagination";
import { AUTHOR_SELECT } from "@/lib/profiles";

export const GET = route("notifications.list", async (req) => {
  const actor = await requireActor();
  const url = new URL(req.url);
  // The nav badge polls this; it needs the number, not the list.
  if (url.searchParams.get("count") === "1") return NextResponse.json({ unread: await prisma.notification.count({ where: { userId: actor.id, readAt: null } }) });
  const limit = parseLimit(url.searchParams.get("limit"), 30);
  const cursor = decodeCursor(url.searchParams.get("cursor"));
  const rows = await prisma.notification.findMany({
    where: {
      userId: actor.id,
      ...(url.searchParams.get("unread") === "1" && { readAt: null }),
      ...(cursor && { OR: [{ createdAt: { lt: new Date(cursor.t) } }, { createdAt: new Date(cursor.t), id: { lt: cursor.id } }] }),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: { id: true, type: true, postId: true, commentId: true, toneId: true, data: true, readAt: true, createdAt: true, actor: { select: AUTHOR_SELECT } },
  });
  const { items, nextCursor } = page(rows, limit, (r) => ({ t: r.createdAt.toISOString(), id: r.id }));
  // Post titles for context, only for posts the recipient can still see.
  const postIds = [...new Set(items.flatMap((n) => (n.postId ? [n.postId] : [])))];
  const posts = new Map(
    (await prisma.post.findMany({ where: { id: { in: postIds }, OR: [{ status: "PUBLISHED" }, { authorId: actor.id }] }, select: { id: true, title: true, body: true } })).map((p) => [
      p.id,
      p.title ?? p.body.slice(0, 80),
    ]),
  );
  const unread = await prisma.notification.count({ where: { userId: actor.id, readAt: null } });
  return NextResponse.json({ items: items.map((n) => ({ ...n, postTitle: n.postId ? posts.get(n.postId) ?? null : null })), nextCursor, unread });
});
