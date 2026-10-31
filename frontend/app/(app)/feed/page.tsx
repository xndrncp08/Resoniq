import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { optionalActor } from "@/lib/api";
import { followingFeed, forYouFeed, POST_CATEGORIES, type FeedSort, type TopWindow } from "@/lib/posts";
import { EmptyState, LinkButton, Tabs } from "@/components/app/ui";
import ComposerPrompt from "@/components/social/ComposerPrompt";
import PostFeed from "@/components/social/PostFeed";
import SideRail from "@/components/social/SideRail";
import FeaturedStrip from "@/components/social/FeaturedStrip";
import ConversationStarters from "@/components/social/ConversationStarters";
import { CATEGORY_META } from "@/components/social/categories";
import GettingStartedCard from "@/components/onboarding/GettingStartedCard";
import { onboardingSteps } from "@/lib/onboarding";

export const metadata: Metadata = { title: "Feed" };

type Search = Promise<{ tab?: string; sort?: string; t?: string; category?: string }>;

export default async function FeedPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const viewer = await optionalActor();
  const tab = sp.tab === "following" && viewer ? "following" : "for-you";
  const sort: FeedSort = sp.sort === "new" || sp.sort === "top" ? sp.sort : tab === "following" ? "new" : "hot";
  const window: TopWindow = (["day", "week", "month", "year", "all"] as const).find((w) => w === sp.t) ?? "week";
  const category = POST_CATEGORIES.find((c) => c === sp.category);
  const q = { sort, window, category, cursor: null, limit: 15 };
  const page = tab === "following" && viewer ? await followingFeed(viewer.id, q) : await forYouFeed(viewer?.id ?? null, q);
  const [me, steps] = viewer ? await Promise.all([prisma.user.findUnique({ where: { id: viewer.id }, select: { handle: true, name: true, image: true } }), onboardingSteps(viewer.id)]) : [null, null];
  const qs = (o: Record<string, string>) => `/feed?${new URLSearchParams({ tab, sort, t: window, ...(category && { category }), ...o })}`;

  return (
    <div className="flex gap-8">
      <div className="mx-auto w-full max-w-[680px] min-w-0 space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3 pb-2"><div><p className="label-engraved mb-2">The listening room</p><h1 className="font-display text-3xl font-semibold tracking-tight">What are you working on?</h1></div><Link href="/practice" className="focus-ring rounded-full border border-signal/40 px-4 py-2 text-sm text-signal">Open practice room ↗</Link></header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            label="Feed"
            items={[
              { href: qs({ tab: "for-you" }), label: viewer ? "For you" : "Everyone", active: tab === "for-you" },
              ...(viewer ? [{ href: qs({ tab: "following", sort: "new" }), label: "Following", active: tab === "following" }] : []),
            ]}
          />
          <Tabs
            label="Sort"
            items={(["hot", "new", "top"] as const).map((s) => ({ href: qs({ sort: s }), label: s[0].toUpperCase() + s.slice(1), active: sort === s }))}
          />
        </div>
        <Tabs label="Post type" items={[{ href: qs({ category: "" }), label: "All posts", active: !category }, ...Object.entries(CATEGORY_META).map(([key, meta]) => ({ href: qs({ category: key }), label: meta.label, active: category === key }))]} />
        {sort === "top" && (
          <Tabs label="Time range" items={(["day", "week", "month", "year", "all"] as const).map((w) => ({ href: qs({ t: w }), label: w === "all" ? "All time" : `This ${w}`, active: window === w }))} />
        )}
        {steps && steps.done < steps.total && <GettingStartedCard done={steps.done} total={steps.total} />}
        {me ? (
          <ComposerPrompt user={me} />
        ) : (
          <div className="panel grille flex flex-wrap items-center justify-between gap-4 p-5">
            <p className="max-w-md font-body text-ink-dim">Join to amp performances, save tones and post your own rig.</p>
            <LinkButton href="/signup" variant="primary">Join Resoniq</LinkButton>
          </div>
        )}
        <ConversationStarters />
        {tab === "for-you" && sort === "hot" && !category && <FeaturedStrip placement="HOME" viewerId={viewer?.id ?? null} />}
        <PostFeed
          key={`${tab}-${sort}-${window}-${category}`}
          endpoint={`/api/feed?${new URLSearchParams({ tab, sort, t: window, limit: "15", ...(category && { category }) })}`}
          initial={page.items}
          cursor={page.nextCursor}
          signedIn={!!viewer}
          empty={
            <EmptyState icon="feed" title={category ? `No ${CATEGORY_META[category].label.toLowerCase()} posts here yet` : tab === "following" ? "Nothing from your people yet" : "The stage is open"} action={<LinkButton href={tab === "following" ? "/explore" : category ? `/new?category=${category}` : "/new?prompt=progress"} variant="primary">{tab === "following" ? "Find musicians" : "Start a conversation"}</LinkButton>}>
              {tab === "following" ? (
                <>Follow musicians and join <Link className="text-copper" href="/c">communities</Link>; their posts land here, newest first.</>
              ) : (
                "Share something you are learning, ask for a second pair of ears, or find someone to make music with."
              )}
            </EmptyState>
          }
        />
      </div>
      <SideRail viewerId={viewer?.id ?? null} />
    </div>
  );
}
