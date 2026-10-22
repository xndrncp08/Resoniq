import type { Metadata } from "next";
import { optionalActor } from "@/lib/api";
import { listTones } from "@/lib/tones";
import { EmptyState, LinkButton, PageHeader, Tabs } from "@/components/app/ui";
import ToneGrid from "@/components/tone/ToneGrid";

export const metadata: Metadata = { title: "Tones", description: "Guitar and bass tones shared by musicians: declared rigs, signal chains and analysis recipes." };

export default async function TonesPage({ searchParams }: { searchParams: Promise<{ sort?: string; instrument?: string; q?: string }> }) {
  const sp = await searchParams;
  const viewer = await optionalActor();
  const sort = sp.sort === "popular" ? "popular" : "new";
  const instrument = sp.instrument === "GUITAR" || sp.instrument === "BASS" ? sp.instrument : undefined;
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const page = await listTones(viewer?.id ?? null, { sort, instrument, q, cursor: null, limit: 18 });
  const qs = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ sort, instrument, q, ...o }).filter((e): e is [string, string] => !!e[1]));
    return `/tones?${p}`;
  };
  return (
    <div>
      <PageHeader eyebrow="Tone library" title="Tones worth stealing" actions={<><LinkButton href="/analyze" icon="analyze">Analyze a song</LinkButton><LinkButton href="/tones/new" icon="plus" variant="primary">Share a rig</LinkButton></>}>
        Real rigs, declared by the players who use them, and starting points inferred from recordings. Save them, remix them, compare them.
      </PageHeader>
      <form action="/tones" className="mb-4 flex gap-2">
        <input type="hidden" name="sort" value={sort} />
        {instrument && <input type="hidden" name="instrument" value={instrument} />}
        <label className="sr-only" htmlFor="tq">Search tones</label>
        <input id="tq" name="q" defaultValue={q} placeholder="Search tones" className="panel-inset h-11 w-full max-w-md rounded-full px-4 font-body outline-none focus:border-copper/60" />
      </form>
      <div className="mb-6 flex flex-wrap gap-3">
        <Tabs label="Sort" items={[{ href: qs({ sort: "new" }), label: "Newest", active: sort === "new" }, { href: qs({ sort: "popular" }), label: "Most saved", active: sort === "popular" }]} />
        <Tabs label="Instrument" items={[{ href: qs({ instrument: undefined }), label: "All", active: !instrument }, { href: qs({ instrument: "GUITAR" }), label: "Guitar", active: instrument === "GUITAR" }, { href: qs({ instrument: "BASS" }), label: "Bass", active: instrument === "BASS" }]} />
      </div>
      <ToneGrid
        key={`${sort}-${instrument}-${q}`}
        endpoint={`/api/tones/public?sort=${sort}${instrument ? `&instrument=${instrument}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}&limit=18`}
        initial={page.items}
        cursor={page.nextCursor}
        empty={<EmptyState icon="tone" title="No public tones yet" action={<LinkButton href="/tones/new" variant="primary">Share yours</LinkButton>}>Publish a tone from your vault or describe your rig to put it here.</EmptyState>}
      />
    </div>
  );
}
