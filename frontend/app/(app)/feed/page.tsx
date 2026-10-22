import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { optionalActor } from "@/lib/api";
import { followingFeed, forYouFeed, type FeedSort, type TopWindow } from "@/lib/posts";
import { EmptyState, LinkButton, Tabs } from "@/components/app/ui";
import ComposerPrompt from "@/components/social/ComposerPrompt";
import PostFeed from "@/components/social/PostFeed";
import SideRail from "@/components/social/SideRail";
import FeaturedStrip from "@/components/social/FeaturedStrip";

export const metadata: Metadata = { title: "Feed" };

type Search = Promise<{ tab?: string; sort?: string; t?: string }>;

export default async function FeedPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const viewer = await optionalActor();
  const tab = sp.tab === "following" && viewer ? "following" : "for-you";
  const sort: FeedSort = sp.sort === "new" || sp.sort === "top" ? sp.sort : tab === "following" ? "new" : "hot";
  const window: TopWindow = (["day", "week", "month", "year", "all"] as const).find((w) => w === sp.t) ?? "week";
  const q = { sort, window, cursor: null, limit: 15 };
  const page = tab === "following" && viewer ? await followingFeed(viewer.id, q) : await forYouFeed(viewer?.id ?? null, q);
  const me = viewer ? await prisma.user.findUnique({ where: { id: viewer.id }, select: { handle: true, name: true, image: true } }) : null;
  const qs = (o: Record<string, string>) => `/feed?${new URLSearchParams({ tab, sort, ...o })}`;

  return (
    <div className="flex gap-8">
      <h1 className="sr-only">Feed</h1>
      <div className="mx-auto w-full max-w-[680px] min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            label="Feed"
            items={[
              { href: `/feed?tab=for-you`, label: "For you", active: tab === "for-you" },
              ...(viewer ? [{ href: `/feed?tab=following`, label: "Following", active: tab === "following" }] : []),
            ]}
          />
          <Tabs
            label="Sort"
            items={(["hot", "new", "top"] as const).map((s) => ({ href: qs({ sort: s }), label: s[0].toUpperCase() + s.slice(1), active: sort === s }))}
          />
        </div>
        {sort === "top" && (
          <Tabs label="Time range" items={(["day", "week", "month", "year", "all"] as const).map((w) => ({ href: qs({ t: w }), label: w === "all" ? "All time" : `This ${w}`, active: window === w }))} />
        )}
        {me ? (
          <ComposerPrompt user={me} />
        ) : (
          <div className="panel grille flex flex-wrap items-center justify-between gap-4 p-5">
            <p className="max-w-md font-body text-ink-dim">Join to amp performances, save tones and post your own rig.</p>
            <LinkButton href="/signup" variant="primary">Join Resoniq</LinkButton>
          </div>
        )}
        {tab === "for-you" && sort === "hot" && <FeaturedStrip placement="HOME" viewerId={viewer?.id ?? null} />}
        <PostFeed
          key={`${tab}-${sort}-${window}`}
          endpoint={`/api/feed?tab=${tab}&sort=${sort}&t=${window}&limit=15`}
          initial={page.items}
          cursor={page.nextCursor}
          signedIn={!!viewer}
          empty={
            <EmptyState icon="feed" title={tab === "following" ? "Nothing from your people yet" : "The stage is empty"} action={<LinkButton href={tab === "following" ? "/explore" : "/new"} variant="primary">{tab === "following" ? "Find musicians" : "Post the first one"}</LinkButton>}>
              {tab === "following" ? (
                <>Follow musicians and join <Link className="text-copper" href="/c">communities</Link>; their posts land here, newest first.</>
              ) : (
                "No posts yet. Share a performance, a board tour or a question to get things going."
              )}
            </EmptyState>
          }
        />
      </div>
      <SideRail viewerId={viewer?.id ?? null} />
    </div>
  );
}
