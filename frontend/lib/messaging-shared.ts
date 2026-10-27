import type { MediaView } from "@/lib/media/view";

/** Shapes and choices shared by the messaging server code (lib/messaging.ts) and the browser. */

export const MESSAGE_REACTIONS = ["🔥", "🎸", "👏", "🎯", "❤️", "😂", "👀", "🙏"] as const;

export type Invite = { title: string; role: string | null; when: string | null; where: string | null; note: string | null };

export type MessageView = {
  id: string;
  kind: "TEXT" | "COLLAB_INVITE" | "SYSTEM";
  body: string;
  createdAt: string;
  deleted: boolean;
  author: { id: string; handle: string; name: string | null; image: string | null };
  mine: boolean;
  replyTo: { id: string; body: string; author: string } | null;
  reactions: { emoji: string; count: number; mine: boolean }[];
  media: MediaView[];
  invite: (Invite & { status: "PENDING" | "ACCEPTED" | "DECLINED"; projectId: string | null }) | null;
};

export type ConversationSummary = {
  id: string;
  kind: "DIRECT" | "PROJECT";
  title: string;
  brief: string | null;
  members: { id: string; handle: string; name: string | null; image: string | null }[];
  last: { body: string; author: string; at: string } | null;
  unread: boolean;
  pendingInvite: boolean;
};
