import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageActor } from "@/lib/session";
import { ApiError } from "@/lib/api-error";
import { getConversation, getMessages } from "@/lib/messaging";
import { mediaCapabilities } from "@/lib/hosting";
import Thread from "@/components/messages/Thread";

export const metadata: Metadata = { title: "Conversation", robots: { index: false } };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePageActor(`/messages/${id}`);
  // Not a member (or no such conversation): the same 404 either way.
  const loaded = await Promise.all([getConversation(actor.id, id), getMessages(actor.id, id)]).catch((err) => {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  });
  if (!loaded) notFound();
  const [conversation, page] = loaded;
  const caps = await mediaCapabilities();
  return (
    <div className="mx-auto max-w-[860px]">
      <Thread userId={actor.id} conversation={conversation} initial={page.messages} hasMore={page.hasMore} uploadKinds={{ images: caps.images, video: caps.video, audio: caps.audio, note: caps.note }} />
    </div>
  );
}
