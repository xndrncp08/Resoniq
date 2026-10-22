import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requirePageActor } from "@/lib/session";
import { page } from "@/lib/pagination";
import { AUTHOR_SELECT } from "@/lib/profiles";
import { PageHeader } from "@/components/app/ui";
import NotificationList, { type NotificationItem } from "@/components/social/NotificationList";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const actor = await requirePageActor("/notifications");
  const rows = await prisma.notification.findMany({
    where: { userId: actor.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 31,
    select: { id: true, type: true, postId: true, commentId: true, toneId: true, data: true, readAt: true, createdAt: true, actor: { select: AUTHOR_SELECT } },
  });
  const { items, nextCursor } = page(rows, 30, (r) => ({ t: r.createdAt.toISOString(), id: r.id }));
  const titles = new Map(
    (await prisma.post.findMany({ where: { id: { in: items.flatMap((n) => (n.postId ? [n.postId] : [])) }, OR: [{ status: "PUBLISHED" }, { authorId: actor.id }] }, select: { id: true, title: true, body: true } })).map((p) => [p.id, p.title ?? p.body.slice(0, 80)]),
  );
  const initial: NotificationItem[] = items.map((n) => ({ ...n, data: n.data as Record<string, unknown> | null, readAt: n.readAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString(), postTitle: n.postId ? titles.get(n.postId) ?? null : null }));
  return (
    <div className="mx-auto max-w-[680px]">
      <PageHeader eyebrow="Activity" title="Notifications" />
      <NotificationList initial={initial} cursor={nextCursor} />
    </div>
  );
}
