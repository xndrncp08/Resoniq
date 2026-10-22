import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type NotifyInput = {
  userId: string;
  type: NotificationType;
  actorId?: string | null;
  postId?: string | null;
  commentId?: string | null;
  toneId?: string | null;
  data?: Prisma.InputJsonValue;
};

/** Creates notifications, skipping self-notifications and banned recipients. */
export async function notify(input: NotifyInput | NotifyInput[], db: Prisma.TransactionClient | typeof prisma = prisma) {
  const items = (Array.isArray(input) ? input : [input]).filter((n) => n.userId !== n.actorId);
  if (items.length === 0) return;
  const active = new Set(
    (
      await db.user.findMany({
        where: { id: { in: [...new Set(items.map((n) => n.userId))] }, status: { not: "BANNED" } },
        select: { id: true },
      })
    ).map((u) => u.id),
  );
  const data = items.filter((n) => active.has(n.userId));
  if (data.length) await db.notification.createMany({ data });
}
