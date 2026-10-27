import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { unreadConversationCount } from "@/lib/messaging";
import { RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Live counts for the nav: unread notifications and conversations with
 * something new. Two indexed counts, polled every few seconds by visible tabs
 * only (lib/queries/pulse.ts), so it stays cheap on the free tier.
 */
export const GET = route("pulse", async () => {
  const actor = await requireActor();
  await enforceRateLimit("message-read", actor.id, RATE_LIMITS.messageRead);
  const [notifications, messages] = await Promise.all([
    prisma.notification.count({ where: { userId: actor.id, readAt: null } }),
    unreadConversationCount(actor.id),
  ]);
  return NextResponse.json({ notifications, messages }, { headers: { "cache-control": "no-store" } });
});
