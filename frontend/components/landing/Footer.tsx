import Image from "next/image";
import Link from "next/link";

const links = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Example result", href: "/#example-tone" },
  { label: "Analyze a song", href: "/analyze" },
  { label: "Tone library", href: "/library" },
];

export default function Footer() {
  return (
    <footer className="relative mx-auto max-w-6xl px-6 py-16">
      <div className="flex flex-col items-start justify-between gap-8 border-t border-white/5 pt-12 sm:flex-row">
        <div>
          <div className="flex items-center gap-2">
            <Image src="/logo.svg" alt="" width={28} height={28} className="rounded-lg" />
            <span className="font-display text-base font-semibold">Resoniq</span>
          </div>
          <p className="mt-3 max-w-xs font-body text-sm text-muted">Upload a song. Get a tone recipe to start from.</p>
        </div>

        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-2 font-body text-sm text-muted">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="focus-ring rounded transition-colors hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <p className="mt-12 font-mono text-xs text-muted">
        © {new Date().getFullYear()} Resoniq. Tone results are inferred from audio, not verified rigs. Not affiliated
        with any amp or pedal manufacturer named in them.
      </p>
    </footer>
  );
}
