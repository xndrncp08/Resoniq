import type { Metadata } from "next";
import Link from "next/link";
import { Avatar, Button, Chip, EmptyState, LinkButton } from "@/components/app/ui";
import Icon from "@/components/icons/Icon";
import { discoverMusicians, playMates } from "@/lib/discovery";
import { optionalActor } from "@/lib/api";
import { OPEN_TO, OPEN_TO_LABEL, isOpenTo } from "@/lib/portfolio-options";
import { INSTRUMENTS, INSTRUMENT_LABEL, type Instrument } from "@/lib/instruments";
import { musicianDirectoryHref, parseMusicianFilters, type DirectoryParams } from "@/lib/musician-directory";

type Props = { searchParams: Promise<DirectoryParams> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const filtered = Object.values(await searchParams).some(Boolean);
  return {
    title: "Find your people",
    description: "Find musicians by instrument and genre. Explore their music, follow their progress, and start a conversation.",
    ...(filtered && { robots: { index: false, follow: true } }),
  };
}

const field = "panel-inset mt-2 h-12 w-full min-w-0 rounded-xl px-3 font-body text-base outline-none focus:border-copper/60";

export default async function MusiciansPage({ searchParams }: Props) {
  const filters = parseMusicianFilters(await searchParams);
  const viewer = await optionalActor();
  const [{ items, nextCursor }, mates] = await Promise.all([discoverMusicians(filters), viewer ? playMates(viewer.id) : null]);
  const filtered = !!(filters.q || filters.instrument || filters.genre || filters.open);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="panel grille p-6 sm:p-10">
        <p className="label-engraved mb-3 text-signal">The people behind the sound</p>
        <h1 className="font-display text-display-lg font-semibold tracking-tight">Find your people.</h1>
        <p className="mt-4 max-w-xl font-body text-lg leading-relaxed text-ink-dim">A rhythm section. A fresh pair of ears. Someone exploring the same sound. Start with what you play and what moves you.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <LinkButton href="/tag/collaboration?sort=new" icon="community">Collaboration posts</LinkButton>
          <LinkButton href="/settings" icon="edit" variant="ghost">Add your instruments</LinkButton>
        </div>
      </header>

      <form key={musicianDirectoryHref({ ...filters, after: "" })} action="/musicians" role="search" aria-label="Find musicians" className="panel p-5 sm:p-6">
        <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
          <label className="min-w-0"><span className="label-engraved">Name, handle or bio</span><input type="search" name="q" defaultValue={filters.q} maxLength={100} placeholder="A player or a musical interest" className={field} /></label>
          <label className="min-w-0"><span className="label-engraved">Instrument</span><select name="instrument" defaultValue={filters.instrument ?? ""} className={field}><option value="">Any instrument</option>{INSTRUMENTS.map((i) => <option key={i} value={i}>{INSTRUMENT_LABEL[i]}</option>)}</select></label>
          <label className="min-w-0"><span className="label-engraved">Genre</span><input name="genre" defaultValue={filters.genre} maxLength={24} placeholder="e.g. jazz, OPM, soul" className={field} /></label>
          <label className="min-w-0"><span className="label-engraved">Open to</span><select name="open" defaultValue={filters.open ?? ""} className={field}><option value="">Anything</option>{OPEN_TO.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
          <Button type="submit" variant="primary" size="lg" icon="search">Find musicians</Button>
        </div>
        <p className="mt-3 font-body text-xs text-muted">Matches the instruments and genres musicians put on their profiles.</p>
      </form>

      {mates && !filtered && !filters.after && (
        <section aria-labelledby="mates-heading" className="space-y-4">
          <div>
            <h2 id="mates-heading" className="font-display text-2xl font-semibold">Players for you</h2>
            <p className="mt-1 font-body text-sm text-muted">They share a genre with you, play a part you don&apos;t, and are open to playing with others.</p>
          </div>
          {mates.items.length ? (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {mates.items.map((u) => (
                <li key={u.id} className="min-w-0">
                  <Link href={`/u/${u.handle}`} className="focus-ring panel group flex h-full items-start gap-3 p-4 transition-colors hover:border-signal/50">
                    <Avatar user={u} size={48} />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-display text-base font-semibold">{u.name ?? u.handle}</h3>
                      <p className="mt-0.5 font-body text-sm text-ink-dim">
                        Plays {u.why.plays.map((i) => (INSTRUMENT_LABEL[i as Instrument] ?? i).toLowerCase()).join(", ")}
                        {u.why.genres.length > 0 && <> · you both play {u.why.genres.slice(0, 3).join(", ")}</>}
                      </p>
                      <p className="mt-1.5 flex flex-wrap gap-x-2 font-body text-xs text-signal">
                        {u.openTo.filter(isOpenTo).slice(0, 3).map((o) => <span key={o}>Open to {OPEN_TO_LABEL[o].toLowerCase()}</span>)}
                        {u.why.near && <span className="text-copper">Also in {u.location}</span>}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel-inset rounded-2xl p-5 font-body text-sm text-muted">
              {mates.missing ? <>Add your {mates.missing} in <Link href="/settings" className="text-copper hover:underline">settings</Link> and we&apos;ll suggest people who fill the parts you don&apos;t play.</> : "No matches yet. As more musicians share what they're open to, players who complement you will show up here."}
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="musicians-heading" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div><h2 id="musicians-heading" className="font-display text-2xl font-semibold">{filtered ? "Your kind of music" : "Meet the musicians"}</h2><p className="mt-1 font-body text-sm text-muted">Member profiles, A–Z by handle. Explore a profile to hear what they share.</p></div>
          {(filtered || filters.after) && <Link href="/musicians" className="focus-ring rounded-lg py-2 font-body text-sm text-copper hover:underline">Clear filters</Link>}
        </div>
        {items.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((u) => (
              <li key={u.id} className="min-w-0">
                <Link href={`/u/${u.handle}`} className="focus-ring panel group flex h-full flex-col p-5 transition-colors hover:border-copper/50">
                  <div className="flex items-center gap-3"><Avatar user={u} size={48} /><div className="min-w-0"><h3 className="truncate font-display text-lg font-semibold">{u.name ?? u.handle}</h3><p className="truncate font-mono text-xs text-muted">@{u.handle}</p></div></div>
                  {u.bio && <p className="mt-4 line-clamp-3 break-words font-body text-sm leading-relaxed text-ink-dim">{u.bio}</p>}
                  {u.instruments.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{u.instruments.map((i) => <Chip key={i} active={i === filters.instrument}>{INSTRUMENT_LABEL[i as Instrument] ?? i}</Chip>)}</div>}
                  {u.genres.length > 0 && <p className="mt-3 line-clamp-2 font-body text-sm text-signal">{u.genres.join(" · ")}</p>}
                  {(u.openTo.length > 0 || u.location) && <p className="mt-2 font-body text-xs text-muted">{[u.location, ...u.openTo.filter(isOpenTo).slice(0, 2).map((o) => `Open to ${OPEN_TO_LABEL[o].toLowerCase()}`)].filter(Boolean).join(" · ")}</p>}
                  <span className="mt-auto flex items-center gap-2 pt-5 font-body text-sm text-copper">Explore profile <Icon name="chevron-right" size={16} /></span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <EmptyState icon="community" title={filtered ? "No musicians match yet" : "There’s room for your sound"} action={<LinkButton href={filtered ? "/musicians" : "/settings"}>{filtered ? "Browse all musicians" : "Build your profile"}</LinkButton>}>{filtered ? "Try another instrument, a broader search, or leave the genre open. You can also post a collaboration invitation." : "Add your instruments, genres and a little about your music so people can find you."}</EmptyState>}
        {(nextCursor || filters.after) && <nav aria-label="Musician pages" className="flex flex-wrap gap-3">{filters.after && <LinkButton href={musicianDirectoryHref({ ...filters, after: "" })}>Back to first page</LinkButton>}{nextCursor && <LinkButton href={musicianDirectoryHref({ ...filters, after: nextCursor })} icon="chevron-right">Next musicians</LinkButton>}</nav>}
      </section>

      <aside className="panel-inset flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5 sm:p-6">
        <div className="max-w-xl"><h2 className="font-display text-xl font-semibold">Give the next session a starting point.</h2><p className="mt-2 font-body text-sm leading-relaxed text-muted">Have a song idea, a part to work on, or a role to fill? Say what you’re making and who you’d like to make it with.</p></div>
        <LinkButton href="/new?prompt=collaboration" variant="primary" icon="plus">Invite a collaboration</LinkButton>
      </aside>
    </div>
  );
}
