import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { listedToneWhere, listTones, parseToneGenre, TONE_GENRES } from "@/lib/tones";
import { parseTankGFilters, TANK_G_AMPS, TANK_G_COLLECTIONS, TANK_G_FACTS, TANK_G_MODULES } from "@/lib/devices/tank-g";
import { Chip, EmptyState, Tabs } from "@/components/app/ui";
import ToneGrid from "@/components/tone/ToneGrid";

type Search = Record<string, string | undefined>;

function ChipRow({ label, items }: { label: string; items: { href: string; text: string; active: boolean }[] }) {
  return (
    <nav aria-label={label} className="flex items-center gap-2">
      <span className="label-engraved w-16 shrink-0">{label}</span>
      <span className="scrollbar-none flex gap-1.5 overflow-x-auto py-0.5">
        {items.map((i) => (
          <Link key={i.href} href={i.href} scroll={false} aria-current={i.active ? "page" : undefined} className={`focus-ring whitespace-nowrap rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wide ${i.active ? "border-copper/60 bg-copper/10 text-copper" : "border-line text-muted hover:text-ink"}`}>{i.text}</Link>
        ))}
      </span>
    </nav>
  );
}

/** The device library: verified capabilities, then the preset catalog filtered by device metadata. */
export default async function TankGLibrary({ gearId, slug, sp, viewerId }: { gearId: string; slug: string; sp: Search; viewerId: string | null }) {
  const f = parseTankGFilters((k) => sp[k]);
  const genre = parseToneGenre(sp.genre);
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const sort = sp.sort === "new" ? "new" : "popular";
  const [page, total] = await Promise.all([
    listTones(viewerId, { sort, gearId, genre, q, ...f, cursor: null, limit: 18 }),
    prisma.tone.count({ where: { AND: [listedToneWhere, { gear: { some: { gearItemId: gearId } } }] } }),
  ]);
  const state: Search = { sort, collection: f.collection, amp: f.ampSlot?.toString(), effect: f.effect, genre, q };
  const params = (o: Search = {}) => new URLSearchParams(Object.entries({ ...state, ...o }).filter((e): e is [string, string] => !!e[1]));
  const href = (o: Search) => `/gear/${slug}?${params(o)}`;
  const api = new URLSearchParams(Object.entries({ sort, gear: gearId, genre, q, amp: state.amp, effect: f.effect, collection: f.collection, limit: "18" }).filter((e): e is [string, string] => !!e[1]));
  const effects = (["mod", "delay", "reverb"] as const).flatMap((m) => Object.keys(TANK_G_MODULES[m].types));
  const filtered = !!(f.collection || f.ampSlot || f.effect || genre || q);

  return (
    <div className="space-y-8">
      <section aria-labelledby="lib-h" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="lib-h" className="font-display text-2xl font-semibold">TANK-G preset library</h2>
            <p className="font-body text-sm text-muted">{total} public presets. Resoniq-generated starting points are labelled as such and haven&apos;t been played on the hardware. <a href="#caps-h" className="text-copper hover:underline">What the pedal can and can&apos;t do</a>.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/gear/${slug}/banks`} className="focus-ring rounded-full border border-line px-4 py-2 font-body text-sm text-ink hover:border-copper/50">Plan my 36 slots</Link>
            <Tabs label="Sort" items={[{ href: href({ sort: "popular" }), label: "Most saved", active: sort === "popular" }, { href: href({ sort: "new" }), label: "Newest", active: sort === "new" }]} />
          </div>
        </div>
        <Tabs label="Collection" items={[{ href: href({ collection: undefined }), label: "All", active: !f.collection }, ...Object.entries(TANK_G_COLLECTIONS).map(([k, label]) => ({ href: href({ collection: k }), label, active: f.collection === k }))]} />
        <form action={`/gear/${slug}`} className="flex gap-2">
          {Object.entries(state).filter(([k, v]) => k !== "q" && v).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <label className="sr-only" htmlFor="tank-q">Search TANK-G presets</label>
          <input id="tank-q" name="q" type="search" defaultValue={q} placeholder="Search by name or sound, e.g. “spring”, “djent”" autoComplete="off" className="panel-inset h-11 w-full max-w-md rounded-full px-4 font-body text-base outline-none focus:border-copper/60" />
        </form>
        <div className="space-y-2">
          <ChipRow label="Amp" items={[{ href: href({ amp: undefined }), text: "Any", active: !f.ampSlot }, ...TANK_G_AMPS.map((a) => ({ href: href({ amp: String(a.slot) }), text: `${a.slot} · ${a.voicing}`, active: f.ampSlot === a.slot }))]} />
          <ChipRow label="Effect" items={[{ href: href({ effect: undefined }), text: "Any", active: !f.effect }, ...effects.map((e) => ({ href: href({ effect: e }), text: e, active: f.effect === e }))]} />
          <ChipRow label="Genre" items={[{ href: href({ genre: undefined }), text: "Any", active: !genre }, ...TONE_GENRES.map((g) => ({ href: href({ genre: g }), text: g, active: genre === g }))]} />
        </div>
        {filtered && <p className="font-body text-sm"><Link href={`/gear/${slug}`} scroll={false} className="text-copper hover:underline">Clear filters</Link></p>}
        <ToneGrid
          key={api.toString()}
          endpoint={`/api/tones/public?${api}`}
          initial={page.items}
          cursor={page.nextCursor}
          empty={<EmptyState icon="tone" title={filtered ? "No presets match" : "No public TANK-G presets yet"}>{filtered ? "Try another amp slot, effect or genre." : "Share your own TANK-G settings from the tone editor."}</EmptyState>}
        />
      </section>

      <section aria-labelledby="caps-h" className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="panel space-y-3 p-5">
          <h2 id="caps-h" className="font-display text-xl font-semibold">What the TANK-G can do</h2>
          <ul className="list-disc space-y-1.5 pl-5 font-body text-sm text-ink-dim">{TANK_G_FACTS.verified.map((t) => <li key={t}>{t}</li>)}</ul>
          <p className="font-body text-xs text-muted">Source: <a className="text-copper hover:underline" href="https://images.equipboard.com/uploads/item/manual/117745/m-vave-tank-g-manual.pdf" rel="noreferrer" target="_blank">M-VAVE TANK-G user manual</a>.</p>
        </div>
        <div className="panel-inset space-y-3 rounded-2xl p-5">
          <h3 className="label-engraved">Not verified · read before you dial in</h3>
          <ul className="list-disc space-y-1.5 pl-5 font-body text-sm text-muted">{TANK_G_FACTS.unverified.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      </section>

      <section aria-labelledby="howto-h" className="panel space-y-3 p-5">
        <h2 id="howto-h" className="font-display text-xl font-semibold">Loading a preset on the pedal</h2>
        <ol className="list-decimal space-y-1.5 pl-5 font-body text-sm text-ink-dim">
          <li>Open a preset and keep its setup sheet in view (or download it as text).</li>
          <li>Tap B+C to switch to LIVE mode; the knobs now set the sound directly.</li>
          <li>Turn every knob to the sheet&apos;s position. For MOD FX, DLY MIX and RVB DECAY, find the right zone first: the module lights go dark between zones.</li>
          <li>Choose the IR slot that holds the named cabinet style in M-EFCS, or import your own IR.</li>
          <li>Pick a bank with BANK−/BANK+, then hold A, B, C or D until it blinks quickly to save.</li>
          <li>Level-match with each preset&apos;s VOLUME knob. MASTER is global and isn&apos;t saved per preset.</li>
        </ol>
        <p className="font-body text-xs text-muted"><Chip>Tip</Chip> M-EFCS (desktop or app) can read and adjust the current preset&apos;s parameters, which can be quicker than turning knobs.</p>
      </section>
    </div>
  );
}
