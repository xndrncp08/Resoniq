import Link from "next/link";
import { Check } from "lucide-react";
import Reveal from "@/components/motion/Reveal";

const included = [
  "Song analyses, no plans or tiers",
  "A personal library of saved tones",
  "Full signal chain detail",
  "Editable amp and pedal settings",
  "Shareable tone links",
  "Your uploads stay private",
];

export default function FreeAccess() {
  return (
    <section id="free-access" className="relative mx-auto max-w-6xl scroll-mt-28 px-6 py-32">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">access</p>
        <h2 className="mt-3 max-w-lg text-balance font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Free. No card, no tiers.
        </h2>
      </Reveal>

      <Reveal className="glass shadow-panel mt-14 grid gap-10 rounded-panel p-8 sm:grid-cols-[1fr_auto] sm:items-center sm:p-10">
        <div>
          <div className="font-display text-2xl font-medium">Everything, for everyone</div>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {included.map((f) => (
              <li key={f} className="flex items-start gap-2 font-body text-sm text-muted">
                <Check size={16} className="mt-0.5 flex-shrink-0 text-signal" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          <p className="mt-6 font-body text-xs text-muted">Fair-use rate limits apply to keep the service up for everyone.</p>
        </div>

        <Link
          href="/signup"
          className="focus-ring shadow-glow whitespace-nowrap rounded-full bg-copper px-8 py-3.5 text-center font-body text-sm font-semibold text-bg transition-[background-color,transform] hover:bg-copper/90 active:scale-[0.98]"
        >
          Create your account
        </Link>
      </Reveal>
    </section>
  );
}
