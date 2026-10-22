import Link from "next/link";
import Image from "next/image";
import Icon, { type IconName } from "@/components/icons/Icon";
import { compact, Provenance } from "@/components/app/ui";
import { KIND_ICON, KIND_LABEL } from "@/components/tone/gear-icons";
import type { GearKind } from "@prisma/client";

type Community = { slug: string; name: string; memberCount: number; kind: string };

function Tile({ id, span, eyebrow, title, children, href, cta }: { id?: string; span: string; eyebrow: string; title: string; children: React.ReactNode; href: string; cta: string }) {
  return (
    <article id={id} className={`panel group relative flex flex-col overflow-hidden p-6 sm:p-7 ${span}`}>
      <p className="label-engraved">{eyebrow}</p>
      <h3 className="mt-2 max-w-md font-display text-3xl font-semibold leading-[1.05] tracking-tight sm:text-4xl">{title}</h3>
      <div className="relative mt-6 flex-1">{children}</div>
      <Link href={href} className="focus-ring mt-6 inline-flex items-center gap-1.5 self-start rounded-full font-body text-sm font-medium text-copper hover:underline">{cta} <Icon name="chevron-right" size={16} /></Link>
    </article>
  );
}

/** The whole product in one dense grid. Counts and names come from the database; UI previews are labelled as such. */
export default function Ecosystem({ communities, gearByKind, gearTotal }: { communities: Community[]; gearByKind: { kind: GearKind; count: number }[]; gearTotal: number }) {
  return (
    <section id="ecosystem" className="relative mx-auto max-w-[1440px] scroll-mt-20 px-4 py-24 sm:px-8" aria-labelledby="eco-title">
      <div className="mb-12 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <h2 id="eco-title" className="max-w-4xl font-display text-display-lg font-semibold tracking-[-0.035em]">One place for the take, <span className="text-muted">the talk,</span> and the tone.</h2>
        <p className="max-w-sm font-body text-ink-dim">A feed for performances. Communities for the conversation. A tone vault and a gear catalog so nothing about your sound has to live in a comment.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-6">
        <Tile span="lg:col-span-4" eyebrow="Feed" title="Performances with the rig attached." href="/feed" cta="Open the feed">
          <div className="grid h-full gap-4 sm:grid-cols-[1.3fr_1fr]">
            <div className="panel-inset relative overflow-hidden rounded-2xl">
              <Image src="/images/studio-bassist-768.webp" alt="A bassist playing beside their studio rig" fill sizes="(max-width: 640px) 90vw, 40vw" className="object-cover" />
              <div className="relative flex h-full min-h-[240px] items-center justify-center bg-gradient-to-br from-copper-deep/50 via-transparent to-signal-dim/30">
                <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 font-body text-xs"><Icon name="declared" size={14} className="text-copper" /> Rig: your guitar · your amp</span>
                <span className="absolute bottom-3 left-3 label-engraved">Interface preview</span>
              </div>
            </div>
            <ul className="space-y-3 font-body text-sm text-ink-dim">
              {([
                ["video", "Video, audio and photo posts, processed into fast, seekable playback."],
                ["amp-up", "Amp what moves you. Discussions add up/down voting."],
                ["comment", "Threaded comments, @mentions and #tags."],
                ["bookmark", "Bookmark posts, save tones to your vault."],
                ["bell", "Notifications when people follow, reply, save or remix."],
              ] as [IconName, string][]).map(([icon, text]) => (
                <li key={text} className="flex gap-3"><Icon name={icon} size={20} className="mt-0.5 shrink-0 text-copper" />{text}</li>
              ))}
            </ul>
          </div>
        </Tile>
        <Tile span="lg:col-span-2" eyebrow="Communities" title="Spaces for how you play." href="/c" cta="Browse communities">
          <ul className="grid grid-cols-2 gap-2">
            {communities.slice(0, 6).map((c) => (
              <li key={c.slug}><Link href={`/c/${c.slug}`} className="focus-ring block rounded-xl border border-line px-3 py-2 hover:border-copper/40"><span className="block truncate font-body text-sm font-medium">{c.name}</span><span className="font-mono text-[10.5px] text-muted">{compact(c.memberCount)} members</span></Link></li>
            ))}
          </ul>
        </Tile>
        <Tile span="lg:col-span-2" eyebrow="Tone vault" title="Save, remix, compare." href="/tones" cta="Explore tones">
          <div className="relative h-44 overflow-hidden rounded-xl">
            <Image src="/images/studio-pedals-768.webp" alt="Copper overdrive, teal delay and cream compressor connected on a pedalboard" fill sizes="(max-width: 1024px) 90vw, 30vw" className="object-cover" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2"><Provenance kind="declared" /><Provenance kind="inferred" /></div>
          <p className="mt-4 font-body text-sm text-ink-dim">Remixes credit the original creator, always. Export any tone as Resoniq JSON.</p>
        </Tile>
        <Tile span="lg:col-span-2" eyebrow="Gear catalog" title={`${gearTotal} pieces of gear, and room for yours.`} href="/gear" cta="Browse the catalog">
          <ul className="grid grid-cols-3 gap-2">
            {gearByKind.map((g) => (
              <li key={g.kind} className="panel-inset flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center">
                <Icon name={KIND_ICON[g.kind]} size={24} className="text-copper" />
                <span className="font-body text-xs">{KIND_LABEL[g.kind]}</span>
                <span className="font-mono text-[10.5px] text-muted">{g.count}</span>
              </li>
            ))}
          </ul>
        </Tile>
        <Tile span="lg:col-span-2" eyebrow="Analysis" title="Heard it on a record? Get a starting point." href="/analyze" cta="Analyze a song">
          <svg viewBox="0 0 400 90" className="h-24 w-full" aria-hidden>
            {Array.from({ length: 80 }, (_, i) => {
              const h = 8 + Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.11)) * 70;
              return <rect key={i} x={i * 5} y={45 - h / 2} width="3" height={h} rx="1.5" fill={i < 46 ? "var(--color-signal)" : "var(--color-line-strong)"} />;
            })}
          </svg>
          <p className="mt-3 font-body text-sm text-ink-dim">Resoniq measures the recording and suggests amp, pedals and EQ, labeled as an inferred closest match that sits apart from what players declare.</p>
        </Tile>
      </div>
    </section>
  );
}
