import type { Metadata } from "next";
import Link from "next/link";
import { optionalActor } from "@/lib/api";
import { risingMusicians, suggestedCommunities, trendingTags } from "@/lib/discovery";
import { popularGear } from "@/lib/gear";
import { listPosts } from "@/lib/posts";
import { listTones } from "@/lib/tones";
import Icon from "@/components/icons/Icon";
import { compact, EmptyState, LinkButton } from "@/components/app/ui";
import PostCard from "@/components/social/PostCard";
import MusicianRow from "@/components/social/MusicianRow";
import ToneCard from "@/components/tone/ToneCard";
import { KIND_ICON } from "@/components/tone/gear-icons";
import FeaturedStrip from "@/components/social/FeaturedStrip";
import ConversationStarters from "@/components/social/ConversationStarters";

export const metadata: Metadata = { title: "Explore" };

function Head({ icon, title, href, label = "See all" }: { icon: Parameters<typeof Icon>[0]["name"]; title: string; href?: string; label?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <h2 className="flex items-center gap-2.5 font-display text-2xl font-semibold tracking-tight"><Icon name={icon} size={22} className="text-copper" /> {title}</h2>
      {href && <Link href={href} className="font-body text-sm text-copper hover:underline">{label}</Link>}
    </div>
  );
}

export default async function ExplorePage() {
  const viewer = await optionalActor();
  const vid = viewer?.id ?? null;
  const [hot, videos, tones, communities, gear, musicians, tags] = await Promise.all([
    listPosts({}, vid, { sort: "top", window: "week", cursor: null, limit: 4 }),
    listPosts({ media: { some: { kind: "VIDEO", status: "READY" } } }, vid, { sort: "hot", cursor: null, limit: 4 }),
    listTones(vid, { sort: "popular", cursor: null, limit: 6 }),
    suggestedCommunities(vid, 8),
    popularGear(null, 10),
    risingMusicians(vid, 6),
    trendingTags(7, 16),
  ]);
  const empty = !hot.items.length && !tones.items.length;

  return (
    <div className="space-y-12">
      <header className="panel grille relative overflow-hidden p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-20 -top-28 h-96 w-96 rounded-full bg-copper/15 blur-3xl" />
        <p className="label-engraved mb-3">Explore</p>
        <h1 className="max-w-3xl font-display text-display-lg font-semibold tracking-tight">Find a sound. <span className="text-muted">Then find who plays it.</span></h1>
        <form action="/search" role="search" className="relative mt-8 max-w-2xl">
          <Icon name="search" size={20} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-muted" />
          <label htmlFor="xq" className="sr-only">Search</label>
          <input id="xq" name="q" placeholder="Musicians, tones, pedals, communities…" className="panel-inset h-14 w-full rounded-full pl-13 pr-5 font-body text-lg outline-none focus:border-copper/60" style={{ paddingLeft: "3.25rem" }} />
        </form>
        <div className="mt-5 flex flex-wrap items-center gap-3"><LinkButton href="/musicians" icon="user">Find musicians</LinkButton><span className="font-body text-sm text-muted">Explore by instrument and genre.</span></div>
        {tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">{tags.map((t) => <Link key={t.tag} href={`/tag/${t.tag}`} className="rounded-full border border-line px-3 py-1 font-mono text-xs text-signal hover:border-signal/50">#{t.tag}</Link>)}</div>
        )}
      </header>

      <FeaturedStrip placement="EXPLORE" viewerId={vid} />
      <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-2xl font-semibold">Make room for music today.</h2><LinkButton href="/practice" icon="audio" variant="signal">Open practice room</LinkButton></div><ConversationStarters /></section>

      {empty && <EmptyState icon="explore" title="Discovery fills up as people post" action={<LinkButton href="/new" variant="primary">Share something</LinkButton>}>Trending posts, popular tones and rising musicians appear here from real activity only.</EmptyState>}

      {videos.items.length > 0 && (
        <section><Head icon="video" title="Performances" href="/feed?sort=hot&category=PERFORMANCE" /><div className="grid gap-4 lg:grid-cols-2">{videos.items.map((p) => <PostCard key={p.id} post={p} signedIn={!!viewer} />)}</div></section>
      )}

      {tones.items.length > 0 && (
        <section><Head icon="tone" title={tones.items.some((t) => t.saveCount > 0) ? "Most-saved tones" : "Sounds to make your own"} href="/tones?sort=popular" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{tones.items.map((t) => <ToneCard key={t.id} tone={t} />)}</div></section>
      )}

      <section>
        <Head icon="community" title="Communities" href="/c" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {communities.map((c) => (
            <Link key={c.id} href={`/c/${c.slug}`} className="focus-ring panel grille flex min-h-[132px] flex-col justify-between p-4 hover:border-copper/40">
              <span className="font-display text-lg font-semibold">{c.name}</span>
              <span className="line-clamp-2 font-body text-sm text-muted">{c.description}</span>
              <span className="font-mono text-[11px] text-muted">{compact(c.memberCount)} members · {compact(c.postCount)} posts</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        {musicians.length > 0 && (
          <section><Head icon="trending" title="Rising musicians" /><div className="panel p-2">{musicians.map((m) => <MusicianRow key={m.id} u={m} />)}</div></section>
        )}
        {gear.length > 0 && (
          <section>
            <Head icon="gear-catalog" title="Gear in shared tones" href="/gear" />
            <ul className="panel divide-y divide-line">
              {gear.map((g, i) => (
                <li key={g.id}><Link href={`/gear/${g.slug}`} className="focus-ring flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03]"><span className="w-6 font-mono text-sm text-muted">{i + 1}</span><Icon name={KIND_ICON[g.kind]} className="text-copper" /><span className="flex-1 font-body"><span className="text-muted">{g.brand}</span> {g.model}</span><span className="font-mono text-xs text-muted">{g.uses} tones</span></Link></li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {hot.items.length > 0 && (
        <section><Head icon="trending" title="Top this week" href="/feed?sort=top&t=week" /><div className="grid gap-4 lg:grid-cols-2">{hot.items.map((p) => <PostCard key={p.id} post={p} signedIn={!!viewer} />)}</div></section>
      )}
    </div>
  );
}
