import type { Metadata } from "next";
import Link from "next/link";
import { optionalActor } from "@/lib/api";
import { risingMusicians, suggestedCommunities, trendingTags } from "@/lib/discovery";
import { popularGear } from "@/lib/gear";
import { listPosts } from "@/lib/posts";
import { MUSIC_WHERE } from "@/lib/music";
import { listTones } from "@/lib/tones";
import Icon from "@/components/icons/Icon";
import { compact, EmptyState, LinkButton } from "@/components/app/ui";
import PostCard from "@/components/social/PostCard";
import MusicianRow from "@/components/social/MusicianRow";
import ToneCard from "@/components/tone/ToneCard";
import { KIND_ICON } from "@/components/tone/gear-icons";
import FeaturedStrip from "@/components/social/FeaturedStrip";

export const metadata: Metadata = { title: "Explore" };

function Head({ title, href, label = "See all" }: { title: string; href?: string; label?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
      {href && <Link href={href} className="font-body text-sm text-muted hover:text-ink">{label}</Link>}
    </div>
  );
}

const BROWSE = [
  { href: "/musicians", label: "Musicians", icon: "user" },
  { href: "/c", label: "Communities", icon: "community" },
  { href: "/tones", label: "Tones", icon: "tone" },
  { href: "/music", label: "Music", icon: "waveform" },
  { href: "/gear", label: "Gear", icon: "gear-catalog" },
] as const;

export default async function ExplorePage() {
  const viewer = await optionalActor();
  const vid = viewer?.id ?? null;
  const [hot, videos, music, tones, communities, gear, musicians, tags] = await Promise.all([
    listPosts({}, vid, { sort: "top", window: "week", cursor: null, limit: 4 }),
    listPosts({ media: { some: { kind: "VIDEO", status: "READY" } } }, vid, { sort: "hot", cursor: null, limit: 4 }),
    listPosts(MUSIC_WHERE, vid, { sort: "new", cursor: null, limit: 4 }),
    listTones(vid, { sort: "popular", cursor: null, limit: 6 }),
    suggestedCommunities(vid, 8),
    popularGear(null, 10),
    risingMusicians(vid, 6),
    trendingTags(7, 16),
  ]);
  const empty = !hot.items.length && !tones.items.length;

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Explore</h1>
        <form action="/search" role="search" className="relative mt-4 max-w-2xl">
          <Icon name="search" size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <label htmlFor="xq" className="sr-only">Search</label>
          <input id="xq" name="q" placeholder="Musicians, tones, pedals, communities…" className="panel-inset h-12 w-full rounded-full pl-12 pr-5 font-body text-base outline-none focus:border-copper/60" />
        </form>
        <nav aria-label="Browse" className="scrollbar-none mt-4 flex gap-2 overflow-x-auto">
          {BROWSE.map((b) => (
            <Link key={b.href} href={b.href} className="focus-ring inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-line px-4 font-body text-sm text-ink-dim hover:border-line-strong hover:text-ink">
              <Icon name={b.icon} size={16} /> {b.label}
            </Link>
          ))}
        </nav>
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">{tags.map((t) => <Link key={t.tag} href={`/tag/${t.tag}`} className="font-mono text-xs text-muted hover:text-signal">#{t.tag}</Link>)}</div>
        )}
      </header>

      <FeaturedStrip placement="EXPLORE" viewerId={vid} />

      {empty && <EmptyState icon="explore" title="Discovery fills up as people post" action={<LinkButton href="/new" variant="primary">Share something</LinkButton>}>Trending posts, popular tones and rising musicians appear here from real activity only.</EmptyState>}

      {music.items.length > 0 && (
        <section><Head title="New music" href="/music" label="Browse all music" /><div className="grid gap-4 lg:grid-cols-2">{music.items.map((p) => <PostCard key={p.id} post={p} signedIn={!!viewer} />)}</div></section>
      )}

      {videos.items.length > 0 && (
        <section><Head title="Performances" href="/feed?sort=hot&category=PERFORMANCE" /><div className="grid gap-4 lg:grid-cols-2">{videos.items.map((p) => <PostCard key={p.id} post={p} signedIn={!!viewer} />)}</div></section>
      )}

      {tones.items.length > 0 && (
        <section><Head title={tones.items.some((t) => t.saveCount > 0) ? "Most-saved tones" : "Sounds to make your own"} href="/tones?sort=popular" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{tones.items.map((t) => <ToneCard key={t.id} tone={t} />)}</div></section>
      )}

      <section>
        <Head title="Communities" href="/c" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {communities.map((c) => (
            <Link key={c.id} href={`/c/${c.slug}`} className="focus-ring panel flex min-h-[120px] flex-col justify-between gap-2 p-4 hover:border-line-strong">
              <span className="font-display text-lg font-semibold">{c.name}</span>
              <span className="line-clamp-2 font-body text-sm text-muted">{c.description}</span>
              <span className="font-mono text-[11px] text-muted">{compact(c.memberCount)} members · {compact(c.postCount)} posts</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        {musicians.length > 0 && (
          <section><Head title="Rising musicians" /><div className="panel p-2">{musicians.map((m) => <MusicianRow key={m.id} u={m} />)}</div></section>
        )}
        {gear.length > 0 && (
          <section>
            <Head title="Gear in shared tones" href="/gear" />
            <ul className="panel divide-y divide-line">
              {gear.map((g, i) => (
                <li key={g.id}><Link href={`/gear/${g.slug}`} className="focus-ring flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03]"><span className="w-6 font-mono text-sm text-muted">{i + 1}</span><Icon name={KIND_ICON[g.kind]} className="text-copper" /><span className="flex-1 font-body"><span className="text-muted">{g.brand}</span> {g.model}</span><span className="font-mono text-xs text-muted">{g.uses} tones</span></Link></li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {hot.items.length > 0 && (
        <section><Head title="Top this week" href="/feed?sort=top&t=week" /><div className="grid gap-4 lg:grid-cols-2">{hot.items.map((p) => <PostCard key={p.id} post={p} signedIn={!!viewer} />)}</div></section>
      )}
    </div>
  );
}
