"use client";

import Link from "next/link";
import { useEffect } from "react";
import Icon, { type IconName } from "@/components/icons/Icon";
import { Avatar, TimeAgo } from "@/components/app/ui";
import InfiniteList from "@/components/social/InfiniteList";
import { useMarkAllRead } from "@/lib/queries/notifications";

export type NotificationItem = {
  id: string;
  type: string;
  postId: string | null;
  commentId: string | null;
  toneId: string | null;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
  postTitle: string | null;
  actor: { id: string; handle: string; name: string | null; image: string | null } | null;
};

const ICON: Record<string, IconName> = { FOLLOW: "user", MENTION: "at", COMMENT: "comment", REPLY: "comment", TONE_SAVE: "bookmark", TONE_REMIX: "remix", MODERATION: "shield", ANNOUNCEMENT: "megaphone", MEDIA_READY: "check", MEDIA_FAILED: "alert", COLLAB_INVITE: "users", COLLAB_ACCEPTED: "users", PROJECT_ADDED: "users", CREDIT_ADDED: "waveform", CREDIT_RESPONSE: "waveform", NEW_RELEASE: "waveform" };

function describe(n: NotificationItem): { text: string; href: string } {
  const who = n.actor ? n.actor.name ?? `@${n.actor.handle}` : "Resoniq";
  const on = n.postTitle ? ` “${n.postTitle}”` : " your post";
  const d = n.data ?? {};
  switch (n.type) {
    case "FOLLOW": return { text: `${who} followed you`, href: `/u/${n.actor?.handle}` };
    case "MENTION": return { text: `${who} mentioned you`, href: `/p/${n.postId}` };
    case "COMMENT": return { text: `${who} commented on${on}`, href: `/p/${n.postId}#comments` };
    case "REPLY": return { text: `${who} replied to your comment`, href: `/p/${n.postId}#comments` };
    case "COLLAB_INVITE": return { text: `${who} invited you to collaborate on “${String(d.title ?? "a project")}”`, href: `/messages/${String(d.conversationId ?? "")}` };
    case "NEW_RELEASE": return { text: `${who} released${n.postTitle ? ` “${n.postTitle}”` : " new music"}`, href: `/p/${n.postId}` };
    case "CREDIT_ADDED": return { text: `${who} credited you on a release. Confirm it to list it on your profile`, href: `/p/${n.postId}` };
    case "CREDIT_RESPONSE": return { text: d.status === "CONFIRMED" ? `${who} confirmed their credit (${String(d.role ?? "")})` : `${who} disputed their credit${d.note ? `: “${String(d.note)}”` : ""}. It's no longer shown`, href: `/p/${n.postId}` };
    case "COLLAB_ACCEPTED": return { text: `${who} accepted your invite. “${String(d.title ?? "Your project")}” is ready`, href: `/messages/${String(d.conversationId ?? "")}` };
    case "PROJECT_ADDED": return { text: `${who} added you to “${String(d.title ?? "a project")}”`, href: `/messages/${String(d.conversationId ?? "")}` };
    case "TONE_SAVE": return { text: `${who} saved your tone`, href: `/t/${n.toneId}` };
    case "TONE_REMIX": return { text: `${who} remixed your tone`, href: `/t/${n.toneId}` };
    case "MEDIA_READY": return { text: `Your ${String(d.kind ?? "media").toLowerCase()} finished processing`, href: n.postId ? `/p/${n.postId}` : "/settings" };
    case "MEDIA_FAILED": return { text: `Your ${String(d.kind ?? "upload").toLowerCase()} couldn't be processed: ${String(d.error ?? "")}`, href: n.postId ? `/p/${n.postId}` : "/new" };
    case "MODERATION": {
      const target = String(d.target ?? "content");
      if (d.action === "suspend") return { text: `Your account was suspended${d.until ? ` until ${String(d.until).slice(0, 10)}` : ""}: ${String(d.reason ?? "")}`, href: "/appeals?type=ACCOUNT" };
      if (d.action === "appeal_upheld") return { text: `Your appeal was reviewed and the decision stands: ${String(d.reason ?? "")}`, href: "/appeals" };
      if (d.action === "unpublish") return { text: `A moderator took your tone out of discovery: ${String(d.reason ?? "")}`, href: `/t/${n.toneId}` };
      return d.action === "restore"
        ? { text: `A moderator restored your ${target}`, href: n.postId ? `/p/${n.postId}` : "/feed" }
        : { text: `A moderator removed your ${target}: ${String(d.reason ?? "")}. You can appeal.`, href: `/appeals?type=${target === "comment" ? "COMMENT" : target === "media" ? "MEDIA" : "POST"}&id=${target === "comment" ? n.commentId : target === "media" ? d.mediaId : n.postId}` };
    }
    case "ANNOUNCEMENT": return { text: String(d.title ?? "Announcement"), href: "/notifications" };
    default: return { text: "Notification", href: "/notifications" };
  }
}

export default function NotificationList({ userId, initial, cursor }: { userId: string; initial: NotificationItem[]; cursor: string | null }) {
  const { mutate: markAllRead } = useMarkAllRead(userId);
  useEffect(() => {
    // Opening the page reads everything; every badge clears at once.
    if (initial.some((n) => !n.readAt)) markAllRead();
  }, [initial, markAllRead]);
  return (
    <InfiniteList
      endpoint="/api/notifications?limit=30"
      initial={initial}
      initialCursor={cursor}
      className="panel divide-y divide-line overflow-hidden"
      empty={<p className="panel p-6 font-body text-muted">You&apos;re all caught up.</p>}
      render={(n) => {
        const { text, href } = describe(n);
        return (
          <Link href={href} className={`focus-ring flex items-start gap-3 px-4 py-3.5 hover:bg-white/[0.03] ${n.readAt ? "" : "bg-copper/[0.04]"}`}>
            <span className="relative">
              {n.actor ? <Avatar user={n.actor} size={40} /> : <span className="panel-inset flex h-10 w-10 items-center justify-center rounded-full text-copper"><Icon name={ICON[n.type] ?? "bell"} size={20} /></span>}
              {n.actor && <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-surface-3 text-copper ring-2 ring-surface"><Icon name={ICON[n.type] ?? "bell"} size={12} /></span>}
            </span>
            <span className="min-w-0 flex-1 font-body text-[15px] text-ink-dim">
              <span className={n.readAt ? "" : "text-ink"}>{text}</span>
              <TimeAgo iso={n.createdAt} className="block font-mono text-xs text-muted" />
            </span>
            {!n.readAt && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-copper" aria-label="Unread" />}
          </Link>
        );
      }}
    />
  );
}
