import Image from "next/image";
import Link from "next/link";
import Icon from "@/components/icons/Icon";

type Tile = { img: string; alt: string; who: string; line: string; href: string; cta: string; span: string; tall?: boolean };

// One photograph per kind of player, each tied to something Resoniq actually does for them.
const TILES: Tile[] = [
  { img: "drums-stage", alt: "A drum kit on a stage lit in blue", who: "Drummers", line: "Lock the pocket: tap a tempo, accent the one, climb a few BPM at a time.", href: "/practice", cta: "Practice room", span: "lg:col-span-5 lg:row-span-2", tall: true },
  { img: "bass-sunburst", alt: "Close-up of a sunburst bass guitar's pickups and bridge", who: "Bassists", line: "Hear where the low end changes across a song, section by section.", href: "/analyze", cta: "Analyze a recording", span: "lg:col-span-4" },
  { img: "vocal-mic", alt: "A vintage microphone in a dim room", who: "Singers", line: "Loop the hard phrase and slow it down until it's yours.", href: "/practice", cta: "Loop a phrase", span: "lg:col-span-3" },
  { img: "home-studio", alt: "A home recording studio with monitors and a desk under purple light", who: "Home studios", line: "Dial an amp in 3D and hear it change, live from your interface.", href: "/studio", cta: "Amp Studio", span: "lg:col-span-4" },
  { img: "producer-console", alt: "Hands on a mixing console with lit meters", who: "Producers", line: "Compare two sounds knob for knob before you commit.", href: "/compare", cta: "Compare tones", span: "lg:col-span-3" },
  { img: "live-red", alt: "A guitarist on stage in red light, filmed by a phone in the crowd", who: "Live players", line: "Post the take with the rig attached, so people can learn the sound.", href: "/feed", cta: "The feed", span: "lg:col-span-4" },
  { img: "pedalboard-stage", alt: "A pedalboard at a guitarist's feet on stage", who: "Guitarists", line: "Your board in order, every knob, on every tone you share.", href: "/tones", cta: "Tone library", span: "lg:col-span-5" },
  { img: "piano-hands", alt: "Hands on piano keys in low light", who: "Keys and everyone else", line: "Find people who play what you play, nearby or not.", href: "/musicians", cta: "Find musicians", span: "lg:col-span-3" },
];

/**
 * Who Resoniq is for, as an editorial grid: different instruments, rooms and
 * stages, each photograph used once. Below the fold, so the images load lazily
 * and never compete with the hero for first paint.
 */
export default function Players() {
  return (
    <section aria-labelledby="players-title" className="mx-auto max-w-[1440px] px-4 py-20 sm:px-8">
      <div className="mb-10 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <h2 id="players-title" className="max-w-3xl font-display text-display-md font-semibold tracking-[-0.03em]">
          Whatever you play. <span className="text-muted">Wherever you play it.</span>
        </h2>
        <p className="max-w-sm font-body text-ink-dim">Bedrooms, rehearsal rooms, home studios and stages. Resoniq is built for the music, not one brand of gear.</p>
      </div>
      <ul className="grid auto-rows-[minmax(0,1fr)] grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-12">
        {TILES.map((t, i) => (
          <li key={t.img} className={`${t.span} ${i === 0 ? "col-span-2" : ""}`}>
            <Link href={t.href} className="focus-ring group relative block h-full min-h-[220px] overflow-hidden rounded-[20px] border border-line bg-bg-0 sm:min-h-[260px]">
              <Image
                src={`/images/musicians/${t.img}-960.webp`}
                alt={t.alt}
                fill
                sizes={t.tall ? "(max-width: 1024px) 100vw, 40vw" : "(max-width: 1024px) 50vw, 33vw"}
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] motion-reduce:transition-none"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 [text-shadow:0_1px_10px_rgb(0_0_0/0.9)] sm:p-5">
                <p className="label-engraved text-copper">{t.who}</p>
                <p className="mt-1.5 max-w-xs text-pretty font-body text-sm leading-snug text-ink sm:text-[15px]">{t.line}</p>
                <span className="mt-2 inline-flex items-center gap-1 font-body text-xs font-medium text-ink-dim group-hover:text-ink">{t.cta} <Icon name="chevron-right" size={14} /></span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
