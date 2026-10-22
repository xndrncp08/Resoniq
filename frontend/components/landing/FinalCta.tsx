import Link from "next/link";
import AmpArt from "@/components/landing/art/AmpArt";

export default function FinalCta() {
  return (
    <section className="relative mx-auto max-w-[1440px] px-4 py-24 sm:px-8" aria-labelledby="cta-title">
      <div className="panel grille relative overflow-hidden p-8 sm:p-14">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-copper/20 blur-[100px]" />
        <div className="relative grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <h2 id="cta-title" className="font-display text-display-lg font-semibold tracking-[-0.035em]">Your sound has a story. <span className="text-copper">Post the rig.</span></h2>
            <p className="mt-5 max-w-lg font-body text-lg text-ink-dim">Free to join. Your analyses stay private, tones stay unlisted until you publish them, and photos lose their location data on upload.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="focus-ring inline-flex h-14 items-center rounded-full bg-copper px-8 font-body font-semibold text-bg shadow-glow hover:bg-copper-soft">Create your account</Link>
              <Link href="/explore" className="focus-ring inline-flex h-14 items-center rounded-full border border-line-strong px-8 font-body text-ink hover:border-copper/50">Look around first</Link>
            </div>
          </div>
          <AmpArt className="w-full [transform:perspective(1200px)_rotateY(-14deg)_rotateX(6deg)]" settings={[7, 5, 6.5, 6, 5.5, 7]} />
        </div>
      </div>
    </section>
  );
}
