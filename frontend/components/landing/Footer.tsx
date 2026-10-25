import Link from "next/link";

const COLUMNS: [string, [string, string][]][] = [
  ["Play", [["Practice room", "/practice"], ["Feed", "/feed"], ["Explore", "/explore"], ["Musicians", "/musicians"], ["Communities", "/c"], ["Tones", "/tones"], ["Gear", "/gear"]]],
  ["Create", [["Share a post", "/new"], ["Share a rig", "/tones/new"], ["Analyze a song", "/analyze"], ["Tone vault", "/library"]]],
  ["Trust", [["Privacy", "/privacy"], ["Terms", "/terms"], ["Copyright", "/copyright"], ["Appeals", "/appeals"]]],
];

export default function Footer() {
  return (
    <footer className="border-t hairline">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-16 sm:px-8 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/lockup.svg" alt="Resoniq" width={200} height={34} className="h-9 w-auto" />
          <p className="mt-4 max-w-xs font-body text-sm text-muted">The community for the sound behind the playing.</p>
        </div>
        {COLUMNS.map(([title, links]) => (
          <nav key={title} aria-label={title}>
            <p className="label-engraved mb-3">{title}</p>
            <ul className="space-y-2 font-body text-sm">
              {links.map(([label, href]) => <li key={href}><Link href={href} className="focus-ring rounded text-ink-dim hover:text-ink">{label}</Link></li>)}
            </ul>
          </nav>
        ))}
      </div>
      <p className="mx-auto max-w-[1440px] px-4 pb-10 font-mono text-xs text-muted sm:px-8">
        Inferred results come from audio analysis and are not verified rigs. Brand and model names identify gear only; Resoniq isn&apos;t affiliated with any manufacturer.
      </p>
    </footer>
  );
}
