import Link from "next/link";
import Icon from "@/components/icons/Icon";
import { Avatar, compact } from "@/components/app/ui";
import { popularGear } from "@/lib/gear";
import { playMates, risingMusicians, suggestedCommunities, trendingTags } from "@/lib/discovery";
import { INSTRUMENT_LABEL, type Instrument } from "@/lib/instruments";

/** The right-hand discovery column on wide screens. Sections with nothing real to show are left out. */
export default async function SideRail({ viewerId }: { viewerId: string | null }) {
  const [tags, communities, gear, musicians, mates] = await Promise.all([trendingTags(), suggestedCommunities(viewerId, 5), popularGear(null, 6), risingMusicians(viewerId, 4), viewerId ? playMates(viewerId, 3) : null]);
  return (
    <aside className="hidden w-[320px] shrink-0 space-y-4 xl:block">
      {mates && mates.items.length > 0 && (
        <section className="panel p-4">
          <h2 className="label-engraved mb-3 flex items-center gap-2"><Icon name="users" size={14} /> Players for you</h2>
          <ul className="space-y-2">
            {mates.items.map((m) => (
              <li key={m.id}>
                <Link href={`/u/${m.handle}`} className="focus-ring flex items-center gap-3 rounded-xl px-1 py-1 hover:bg-white/[0.04]">
                  <Avatar user={m} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-body text-sm font-medium">{m.name ?? m.handle}</span>
                    <span className="block truncate font-body text-xs text-muted">{m.why.plays.map((i) => INSTRUMENT_LABEL[i as Instrument] ?? i).join(", ")}{m.why.genres[0] ? ` · ${m.why.genres[0]}` : ""}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/musicians" className="mt-2 block px-1 font-body text-sm text-copper hover:underline">Find more musicians</Link>
        </section>
      )}
      <section className="panel p-4">
        <h2 className="label-engraved mb-3 flex items-center gap-2"><Icon name="community" size={14} /> Communities to join</h2>
        <ul className="space-y-1">
          {communities.map((c) => (
            <li key={c.id}>
              <Link href={`/c/${c.slug}`} className="focus-ring flex items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.04]">
                <span className="min-w-0">
                  <span className="block truncate font-body text-sm font-medium">{c.name}</span>
                  <span className="block truncate font-mono text-[11px] text-muted">c/{c.slug} · {compact(c.memberCount)} members</span>
                </span>
                <Icon name="chevron-right" size={16} className="text-muted" />
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/c" className="mt-2 block px-2 font-body text-sm text-copper hover:underline">All communities</Link>
      </section>
      {musicians.length > 0 && (
        <section className="panel p-4">
          <h2 className="label-engraved mb-3 flex items-center gap-2"><Icon name="trending" size={14} /> Rising this month</h2>
          <ul className="space-y-2">
            {musicians.map((m) => (
              <li key={m.id}>
                <Link href={`/u/${m.handle}`} className="focus-ring flex items-center gap-3 rounded-xl px-1 py-1 hover:bg-white/[0.04]">
                  <Avatar user={m} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-body text-sm font-medium">{m.name ?? m.handle}</span>
                    <span className="block font-mono text-[11px] text-muted">{compact(m.amps)} amps</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {tags.length > 0 && (
        <section className="panel p-4">
          <h2 className="label-engraved mb-3 flex items-center gap-2"><Icon name="hashtag" size={14} /> Trending tags</h2>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <Link key={t.tag} href={`/tag/${t.tag}`} className="focus-ring rounded-full border border-line px-2.5 py-1 font-mono text-xs text-signal hover:border-signal/50">
                #{t.tag} <span className="text-muted">{t.uses}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
      {gear.length > 0 && (
        <section className="panel p-4">
          <h2 className="label-engraved mb-3 flex items-center gap-2"><Icon name="gear-catalog" size={14} /> Gear in shared tones</h2>
          <ul className="space-y-1">
            {gear.map((g) => (
              <li key={g.id}>
                <Link href={`/gear/${g.slug}`} className="focus-ring flex items-center justify-between rounded-lg px-2 py-1.5 font-body text-sm hover:bg-white/[0.04]">
                  <span className="truncate">{g.brand} {g.model}</span>
                  <span className="font-mono text-[11px] text-muted">{g.uses}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="px-2 font-body text-xs leading-relaxed text-muted">
        <Link href="/privacy" className="hover:text-ink">Privacy</Link> · <Link href="/terms" className="hover:text-ink">Terms</Link> · <Link href="/copyright" className="hover:text-ink">Copyright</Link> · <Link href="/appeals" className="hover:text-ink">Appeals</Link> · <Link href="/" className="hover:text-ink">About Resoniq</Link>
      </p>
    </aside>
  );
}
