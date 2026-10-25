import Link from "next/link";
import Image from "next/image";

export default function FinalCta() {
  return (
    <section className="relative mx-auto max-w-[1440px] px-4 py-24 sm:px-8" aria-labelledby="cta-title">
      <div className="panel grille relative overflow-hidden p-8 sm:p-14">
        <Image src="/images/musicians/crowd-lights-960.webp" alt="" fill sizes="100vw" className="object-cover opacity-30" />
        <div className="relative max-w-4xl">
          <div>
            <h2 id="cta-title" className="font-display text-display-lg font-semibold tracking-[-0.035em]">Your next breakthrough. <span className="text-copper">Someone to share it with.</span></h2>
            <p className="mt-5 max-w-lg font-body text-lg text-ink-dim">Free to join. Your analyses stay private, tones stay unlisted until you publish them, and photos lose their location data on upload.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="focus-ring inline-flex h-14 items-center rounded-full bg-copper px-8 font-body font-semibold text-bg shadow-glow hover:bg-copper-soft">Create your account</Link>
              <Link href="/explore" className="focus-ring inline-flex h-14 items-center rounded-full border border-line-strong px-8 font-body text-ink hover:border-copper/50">Look around first</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
