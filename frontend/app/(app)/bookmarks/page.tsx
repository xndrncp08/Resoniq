import type { Metadata } from "next";
import { requirePageActor } from "@/lib/session";
import { bookmarksFeed } from "@/lib/posts";
import { EmptyState, LinkButton, PageHeader } from "@/components/app/ui";
import PostFeed from "@/components/social/PostFeed";

export const metadata: Metadata = { title: "Bookmarks" };

export default async function BookmarksPage() {
  const actor = await requirePageActor("/bookmarks");
  const page = await bookmarksFeed(actor.id, null, 15);
  return (
    <div className="mx-auto max-w-[680px]">
      <PageHeader eyebrow="Saved" title="Bookmarks">Posts you saved, newest first. Tones you save live in your <a className="text-copper" href={`/u/${actor.handle}?tab=saved`}>saved tones</a>.</PageHeader>
      <PostFeed endpoint="/api/bookmarks?limit=15" initial={page.items} cursor={page.nextCursor} signedIn empty={<EmptyState icon="bookmark" title="No bookmarks yet" action={<LinkButton href="/feed">Browse the feed</LinkButton>} />} />
    </div>
  );
}
