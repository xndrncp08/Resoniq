import type { Metadata } from "next";
import Link from "next/link";
import { optionalActor } from "@/lib/api";
import { listTones, parseToneGenre, parseToneSource, TONE_GENRES } from "@/lib/tones";
import { EmptyState, LinkButton, PageHeader, Tabs } from "@/components/app/ui";
import ToneGrid from "@/components/tone/ToneGrid";

export const metadata: Metadata = { title: "Tones", description: "Guitar and bass tones shared by musicians: declared rigs, signal chains and analysis recipes." };

export default async function TonesPage({ searchParams }: { searchParams: Promise<{ sort?: string; instrument?: string; q?: string; source?: string; genre?: string }> }) {
  const sp = await searchParams;
  const viewer = await optionalActor();
  const sort = sp.sort === "popular" ? "popular" : "new";
  const instrument = sp.instrument === "GUITAR" || sp.instrument === "BASS" ? sp.instrument : undefined;
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const source = parseToneSource(sp.source);
  const genre = parseToneGenre(sp.genre);
  const page = await listTones(viewer?.id ?? null, { sort, instrument, q, source, genre, cursor: null, limit: 18 });
  const params = (o: Record<string, string | undefined> = {}) =>
    new URLSearchParams(Object.entries({ sort, instrument, q, source, genre, ...o }).filter((e): e is [string, string] => !!e[1]));
  const qs = (o: Record<string, string | undefined>) => `/tones?${params(o)}`;
  return (
    <div>
      <PageHeader eyebrow="Tone library" title="Tones worth stealing" actions={<><LinkButton href="/gear/m-vave-tank-g" icon="amp">TANK-G presets</LinkButton><LinkButton href="/analyze" icon="analyze">Analyze a song</LinkButton><LinkButton href="/tones/new" icon="plus" variant="primary">Share a rig</LinkButton></>}>
        Member-declared rigs, starting points inferred from recordings, and clearly labelled Resoniq-generated settings. Save them, remix them, compare them.
      </PageHeader>
      <form action="/tones" className="mb-4 flex gap-2">
        <input type="hidden" name="sort" value={sort} />
        {instrument && <input type="hidden" name="instrument" value={instrument} />}
        {source && <input type="hidden" name="source" value={source} />}
        {genre && <input type="hidden" name="genre" value={genre} />}
        <label className="sr-only" htmlFor="tq">Search tones</label>
        <input id="tq" name="q" defaultValue={q} placeholder="Search tones" className="panel-inset h-11 w-full max-w-md rounded-full px-4 font-body outline-none focus:border-copper/60" />
      </form>
      <div className="mb-6 flex flex-wrap gap-3">
        <Tabs label="Sort" items={[{ href: qs({ sort: "new" }), label: "Newest", active: sort === "new" }, { href: qs({ sort: "popular" }), label: "Most saved", active: sort === "popular" }]} />
        <Tabs label="Instrument" items={[{ href: qs({ instrument: undefined }), label: "All", active: !instrument }, { href: qs({ instrument: "GUITAR" }), label: "Guitar", active: instrument === "GUITAR" }, { href: qs({ instrument: "BASS" }), label: "Bass", active: instrument === "BASS" }]} />
        <Tabs label="Source" items={[{ href: qs({ source: undefined }), label: "All sources", active: !source }, { href: qs({ source: "members" }), label: "Members", active: source === "members" }, { href: qs({ source: "generated" }), label: "Resoniq-generated", active: source === "generated" }]} />
      </div>
      <nav aria-label="Genre" className="-mt-3 mb-6 flex flex-wrap gap-1.5">
        {[undefined, ...TONE_GENRES].map((g) => (
          <Link key={g ?? "all"} href={qs({ genre: g })} aria-current={genre === g ? "page" : undefined} className={`focus-ring rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wide ${genre === g ? "border-copper/60 bg-copper/10 text-copper" : "border-line text-muted hover:text-ink"}`}>{g ?? "Any genre"}</Link>
        ))}
      </nav>
      <ToneGrid
        key={params().toString()}
        endpoint={`/api/tones/public?${params({ limit: "18" })}`}
        initial={page.items}
        cursor={page.nextCursor}
        empty={<EmptyState icon="tone" title="No public tones yet" action={<LinkButton href="/tones/new" variant="primary">Share yours</LinkButton>}>Publish a tone from your vault or describe your rig to put it here.</EmptyState>}
      />
    </div>
  );
}
