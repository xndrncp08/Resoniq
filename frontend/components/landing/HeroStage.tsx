import Link from "next/link";
import Icon from "@/components/icons/Icon";
import GuitarShowcase from "@/components/landing/GuitarShowcase";

export default function HeroStage({ facts }: { facts: { label: string; value: string }[] }) {
  return (
    <section className="relative overflow-hidden pb-16 pt-28 sm:pt-36" aria-labelledby="hero-title">
      <div className="relative mx-auto max-w-[1440px] px-4 sm:px-8">
        <p className="label-engraved mb-8 flex items-center gap-3 text-copper"><span className="h-1.5 w-1.5 rounded-full bg-signal" /> A home for the music you make</p>
        <div className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.35fr] lg:gap-12">
          <div className="min-w-0">
            <h1 id="hero-title" className="font-display text-[clamp(3.3rem,5.2vw,5rem)] font-semibold leading-[0.93] tracking-[-0.055em]">
              Find a sound.<br /><span className="text-copper">Make it yours.</span><br /><span className="text-ink-dim">Play it forward.</span>
            </h1>
            <p className="mt-7 max-w-lg text-pretty font-body text-lg leading-relaxed text-ink-dim">A phrase you cannot put down. A sound you want to chase. Someone who hears what you hear. Practice, trade ideas and make music with people who get it.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/practice" className="focus-ring inline-flex min-h-12 items-center gap-2 rounded-full bg-copper px-7 font-body text-sm font-semibold text-bg hover:bg-copper-soft">Start playing <Icon name="chevron-right" size={18} /></Link>
              <Link href="/explore" className="focus-ring inline-flex min-h-12 items-center gap-2 rounded-full border border-line-strong px-6 font-body text-sm hover:border-copper">Find your people</Link>
            </div>
          </div>
          <GuitarShowcase />
        </div>
        <div className="mt-12 grid gap-6 border-t hairline pt-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <p className="max-w-md font-body text-sm text-muted">First chord or next record. You belong here.<br /><span className="text-ink-dim">Any instrument. Any setup. Your sound.</span></p>
          <dl className="grid grid-cols-3 gap-6 sm:gap-12">{facts.map((f) => <div key={f.label}><dt className="label-engraved">{f.label}</dt><dd className="mt-1 font-display text-2xl font-semibold tabular-nums">{f.value}</dd></div>)}</dl>
        </div>
      </div>
    </section>
  );
}
