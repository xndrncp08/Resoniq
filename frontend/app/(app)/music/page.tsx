import type { Metadata } from "next";
import Link from "next/link";
import { optionalActor } from "@/lib/api";
import { listPosts } from "@/lib/posts";
import { artistsToDiscover, forYouWhere, genreWhere, musicGenres, MUSIC_WHERE } from "@/lib/music";
import { EmptyState, LinkButton } from "@/components/app/ui";
import PostFeed from "@/components/social/PostFeed";
import MusicianRow from "@/components/social/MusicianRow";

export const metadata: Metadata = { title: "Music", description: "Original music from Resoniq musicians: songs and recordings, with who played on them. Browse by genre." };

type Props = { searchParams: Promise<{ genre?: string; scope?: string; sort?: string }> };

export default async function MusicPage({ searchParams }: Props) {
  const sp = await searchParams;
  const viewer = await optionalActor();
  const genre = typeof sp.genre === "string" && sp.genre.length <= 24 ? sp.genre.toLowerCase() : null;
  const forYou = sp.scope === "for-you" && !!viewer;
  const sort = sp.sort === "top" ? "top" : "new";
  const where = { AND: [MUSIC_WHERE, ...(genre ? [genreWhere(genre)] : []), ...(forYou && viewer ? [await forYouWhere(viewer.id)] : [])] };
  const [page, genres, artists] = await Promise.all([
    listPosts(where, viewer?.id ?? null, { sort, window: "all", cursor: null, limit: 12 }),
    musicGenres(),
    artistsToDiscover(viewer?.id ?? null),
  ]);
  const qs = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams({ ...(genre && { genre }), ...(forYou && { scope: "for-you" }), ...(sort !== "new" && { sort }) });
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const s = p.toString();
    return `/music${s ? `?${s}` : ""}`;
  };
  const chip = (active: boolean) => `focus-ring rounded-full border px-3 py-1 font-body text-sm ${active ? "border-copper/60 bg-copper/15 text-ink" : "border-line text-muted hover:text-ink"}`;
  return (
    <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-5">
        <header>
          <p className="label-engraved text-copper">Original music</p>
          <h1 className="mt-1 font-display text-display-md font-semibold tracking-tight">New music from people who play</h1>
          <p className="mt-2 max-w-2xl font-body text-muted">Songs and recordings released on Resoniq, with who played on them. Every credit here was confirmed by the musician.</p>
        </header>
        <nav aria-label="Browse music" className="flex flex-wrap gap-2">
          <Link href={qs({ scope: null })} aria-current={!forYou ? "page" : undefined} className={chip(!forYou)}>All</Link>
          {viewer ? <Link href={qs({ scope: "for-you" })} aria-current={forYou ? "page" : undefined} className={chip(forYou)}>For you</Link> : null}
          <span aria-hidden className="mx-1 w-px bg-line" />
          <Link href={qs({ sort: null })} aria-current={sort === "new" ? "page" : undefined} className={chip(sort === "new")}>Newest</Link>
          <Link href={qs({ sort: "top" })} aria-current={sort === "top" ? "page" : undefined} className={chip(sort === "top")}>Top</Link>
        </nav>
        {genres.length > 0 && (
          <nav aria-label="Genres" className="flex flex-wrap gap-1.5">
            <Link href={qs({ genre: null })} aria-current={!genre ? "page" : undefined} className={chip(!genre)}>Any genre</Link>
            {genres.map((g) => <Link key={g} href={qs({ genre: g })} aria-current={genre === g ? "page" : undefined} className={chip(genre === g)}>{g}</Link>)}
          </nav>
        )}
        <PostFeed
          endpoint={`/api/music?limit=12&sort=${sort}${genre ? `&genre=${encodeURIComponent(genre)}` : ""}${forYou ? "&scope=for-you" : ""}`}
          initial={page.items}
          cursor={page.nextCursor}
          signedIn={!!viewer}
          empty={<EmptyState icon="waveform" title={forYou ? "Nothing for you yet" : genre ? `No ${genre} releases yet` : "No releases yet"} action={<LinkButton href="/riffs" variant="primary">Start in the Riff Vault</LinkButton>}>{forYou ? "Follow musicians, or add genres to your profile, and their releases will show up here." : "Record an idea, write the song, and publish it from the Riff Vault or the Songwriting Canvas."}</EmptyState>}
        />
      </div>
      <aside aria-label="Artists to discover" className="space-y-3 lg:sticky lg:top-6 lg:self-start">
        <h2 className="label-engraved">Artists to discover</h2>
        {artists.length ? (
          <div className="panel p-2">{artists.map((a) => <MusicianRow key={a.id} u={a} />)}</div>
        ) : <p className="font-body text-sm text-muted">Artists appear here once they release music.</p>}
      </aside>
    </div>
  );
}
