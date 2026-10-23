import type { Metadata } from "next";
import Link from "next/link";
import { optionalActor } from "@/lib/api";
import { searchAll, searchCommunities, searchGearItems, searchMusicians, searchPosts, searchTones, SEARCH_TYPES, type SearchType } from "@/lib/search";
import Icon from "@/components/icons/Icon";
import { compact, EmptyState, Tabs } from "@/components/app/ui";
import PostCard from "@/components/social/PostCard";
import MusicianRow from "@/components/social/MusicianRow";
import ToneCard from "@/components/tone/ToneCard";
import { KIND_ICON } from "@/components/tone/gear-icons";
import { parseToneSource } from "@/lib/tones";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

const LABEL: Record<SearchType, string> = { posts: "Posts", tones: "Tones", musicians: "Musicians", communities: "Communities", gear: "Gear" };

type Results = Awaited<ReturnType<typeof searchAll>>;

function Section({ title, href, children, show }: { title: string; href: string; children: React.ReactNode; show: boolean }) {
  if (!show) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between"><h2 className="font-display text-xl font-semibold">{title}</h2><Link href={href} className="font-body text-sm text-copper hover:underline">See all</Link></div>
      {children}
    </section>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; source?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 100) ?? "";
  const type = SEARCH_TYPES.find((t) => t === sp.type);
  const viewer = await optionalActor();
  const vid = viewer?.id ?? null;
  const enc = encodeURIComponent(q);
  const source = parseToneSource(sp.source);

  let all: Results | null = null;
  let one: { type: SearchType; items: unknown[] } | null = null;
  if (q.length >= 2) {
    if (type) {
      const items = await { posts: () => searchPosts(q, vid), tones: () => searchTones(q, vid, 0, undefined, source), musicians: () => searchMusicians(q), communities: () => searchCommunities(q), gear: () => searchGearItems(q) }[type]();
      one = { type, items };
    } else all = await searchAll(q, vid);
  }
  const nothing = all ? Object.values(all).every((v) => v.length === 0) : one ? one.items.length === 0 : false;

  return (
    <div className="mx-auto max-w-[980px] space-y-6">
      <form action="/search" role="search" className="relative">
        <Icon name="search" size={22} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-muted" />
        <label htmlFor="sq" className="sr-only">Search Resoniq</label>
        <input id="sq" name="q" defaultValue={q} autoFocus={!q} placeholder="Search musicians, tones, gear, posts…" className="panel h-16 w-full rounded-full pl-14 pr-5 font-display text-xl outline-none focus:border-copper/60" />
        {type && <input type="hidden" name="type" value={type} />}
      </form>
      {q && <Tabs label="Result type" items={[{ href: `/search?q=${enc}`, label: "All", active: !type }, ...SEARCH_TYPES.map((t) => ({ href: `/search?q=${enc}&type=${t}`, label: LABEL[t], active: type === t }))]} />}
      {q && type === "tones" && <Tabs label="Tone source" items={[{ href: `/search?q=${enc}&type=tones`, label: "All sources", active: !source }, { href: `/search?q=${enc}&type=tones&source=members`, label: "Members only", active: source === "members" }, { href: `/search?q=${enc}&type=tones&source=generated`, label: "Resoniq-generated", active: source === "generated" }]} />}
      {!q && <p className="font-body text-muted">Try a player, a pedal (<Link className="text-copper" href="/search?q=tube%20screamer">tube screamer</Link>), a style (<Link className="text-copper" href="/search?q=%22edge%20of%20breakup%22">&quot;edge of breakup&quot;</Link>) or a community.</p>}
      {nothing && <EmptyState icon="search" title="Nothing matched">Try fewer words, or search a different type.</EmptyState>}

      {all && (
        <div className="space-y-10">
          <Section title="Musicians" href={`/search?q=${enc}&type=musicians`} show={all.musicians.length > 0}><div className="panel grid p-2 sm:grid-cols-2">{all.musicians.map((u) => <MusicianRow key={u.id} u={u} />)}</div></Section>
          <Section title="Tones" href={`/search?q=${enc}&type=tones`} show={all.tones.length > 0}><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{all.tones.map((t) => <ToneCard key={t.id} tone={t} />)}</div></Section>
          <Section title="Gear" href={`/search?q=${enc}&type=gear`} show={all.gear.length > 0}><div className="flex flex-wrap gap-2">{all.gear.map((g) => <Link key={g.id} href={`/gear/${g.slug}`} className="focus-ring panel inline-flex items-center gap-2 rounded-full px-3 py-2 font-body text-sm hover:border-copper/40"><Icon name={KIND_ICON[g.kind]} size={16} className="text-copper" />{g.brand} {g.model}</Link>)}</div></Section>
          <Section title="Communities" href={`/search?q=${enc}&type=communities`} show={all.communities.length > 0}><div className="grid gap-2 sm:grid-cols-2">{all.communities.map((c) => <Link key={c.id} href={`/c/${c.slug}`} className="focus-ring panel p-4 hover:border-copper/40"><span className="font-display font-semibold">{c.name}</span><span className="block font-mono text-xs text-muted">c/{c.slug} · {compact(c.memberCount)} members</span></Link>)}</div></Section>
          <Section title="Posts" href={`/search?q=${enc}&type=posts`} show={all.posts.length > 0}><div className="space-y-4">{all.posts.map((p) => <PostCard key={p.id} post={p} signedIn={!!viewer} />)}</div></Section>
        </div>
      )}
      {one && one.items.length > 0 && (
        <div className={one.type === "tones" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : one.type === "posts" ? "space-y-4" : "panel grid p-2 sm:grid-cols-2"}>
          {one.type === "posts" && (one.items as Results["posts"]).map((p) => <PostCard key={p.id} post={p} signedIn={!!viewer} />)}
          {one.type === "tones" && (one.items as Results["tones"]).map((t) => <ToneCard key={t.id} tone={t} />)}
          {one.type === "musicians" && (one.items as Results["musicians"]).map((u) => <MusicianRow key={u.id} u={u} />)}
          {one.type === "communities" && (one.items as Results["communities"]).map((c) => <Link key={c.id} href={`/c/${c.slug}`} className="focus-ring rounded-2xl p-3 hover:bg-white/[0.03]"><span className="font-display font-semibold">{c.name}</span><span className="block font-mono text-xs text-muted">c/{c.slug} · {compact(c.memberCount)} members</span></Link>)}
          {one.type === "gear" && (one.items as Results["gear"]).map((g) => <Link key={g.id} href={`/gear/${g.slug}`} className="focus-ring flex items-center gap-3 rounded-2xl p-3 font-body hover:bg-white/[0.03]"><Icon name={KIND_ICON[g.kind]} className="text-copper" /> <span><span className="text-muted">{g.brand}</span> {g.model}</span></Link>)}
        </div>
      )}
    </div>
  );
}
