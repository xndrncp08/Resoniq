import Link from "next/link";
import GuitarArt from "@/components/landing/art/GuitarArt";
import AmpArt from "@/components/landing/art/AmpArt";
import PedalArt from "@/components/landing/art/PedalArt";
import Icon from "@/components/icons/Icon";
import { Provenance } from "@/components/app/ui";

/**
 * The oversized opener: editorial type over a layered, perspective-tilted rig
 * (amp, board, guitar) with the product's rig inspector floating in front.
 * The composition is illustration plus real UI parts, not a screenshot.
 */
export default function HeroStage({ facts }: { facts: { label: string; value: string }[] }) {
  return (
    <section className="relative overflow-hidden pb-10 pt-28 sm:pt-32" aria-labelledby="hero-title">
      <div className="grille pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -left-40 top-20 h-[640px] w-[640px] rounded-full bg-copper/20 blur-[140px]" />
      <div className="pointer-events-none absolute -right-40 top-60 h-[520px] w-[520px] rounded-full bg-signal/10 blur-[140px]" />

      <div className="relative mx-auto max-w-[1440px] px-4 sm:px-8">
        <p className="label-engraved mb-6 flex items-center gap-2 text-copper"><span className="h-1.5 w-1.5 rounded-full bg-signal shadow-[0_0_12px_var(--color-signal)]" /> For guitarists, bassists and the gear-obsessed</p>
        <h1 id="hero-title" className="pointer-events-none relative z-20 font-display [text-shadow:0_4px_40px_rgba(0,0,0,.55)] text-display-xl font-semibold tracking-[-0.045em]">
          <span className="block">Play it.</span>
          <span className="block text-copper">Share the rig.</span>
          <span className="block text-ink/35">Steal the tone.</span>
        </h1>

        <div className="relative mt-10 grid gap-8 lg:grid-cols-[minmax(0,520px)_1fr] lg:items-end">
          <div>
            <p className="max-w-[34rem] text-pretty font-body text-xl leading-relaxed text-ink-dim">
              Resoniq is where musicians post performances with the exact rig attached: guitar, pedals, amp and every knob, declared by the player. Watch a take, open the signal chain, save it, remix it.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="focus-ring inline-flex h-14 items-center gap-2 rounded-full bg-copper px-8 font-body text-base font-semibold text-bg shadow-glow transition hover:bg-copper-soft">Join free <Icon name="chevron-right" size={18} /></Link>
              <Link href="/analyze" className="focus-ring inline-flex h-14 items-center gap-2 rounded-full border border-line-strong bg-surface/60 px-8 font-body text-base text-ink backdrop-blur hover:border-copper/50"><Icon name="analyze" size={20} className="text-signal" /> Analyze a recording</Link>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t hairline pt-6">
              {facts.map((f) => (
                <div key={f.label}><dt className="label-engraved">{f.label}</dt><dd className="mt-1 font-display text-3xl font-semibold tabular-nums">{f.value}</dd></div>
              ))}
            </dl>
          </div>

          {/* The rig, in perspective. */}
          <div className="relative z-0 h-[460px] sm:h-[560px] lg:-mt-48 lg:h-[680px]" aria-hidden>
            <div className="absolute inset-0 [perspective:1600px]">
              <div className="absolute right-0 top-0 w-[86%] animate-[float_9s_ease-in-out_infinite] [transform:rotateX(14deg)_rotateY(-18deg)_rotateZ(2deg)]">
                <AmpArt className="w-full drop-shadow-[0_40px_60px_rgba(0,0,0,.6)]" />
              </div>
              <div className="absolute bottom-[18%] right-[4%] flex w-[64%] gap-[3%] [transform:rotateX(52deg)_rotateZ(-8deg)] [transform-origin:bottom]">
                <div className="flex w-full gap-[3%] rounded-[18px] border border-line bg-bg-0/80 p-[3%] shadow-[0_50px_80px_rgba(0,0,0,.7)]">
                  <PedalArt className="w-1/3" color="#C9C3B8" name="COMP" />
                  <PedalArt className="w-1/3" color="#FF8A3D" name="DRIVE" />
                  <PedalArt className="w-1/3" color="#37E6C9" name="ECHO" />
                </div>
              </div>
              <div className="absolute -left-[6%] bottom-[2%] w-[96%] [transform:rotateZ(-9deg)]">
                <GuitarArt className="w-full" />
              </div>
            </div>

            {/* Real UI: the rig inspector card that sits on every performance. */}
            <div className="panel absolute bottom-[34%] left-[2%] w-[260px] p-4 shadow-panel sm:w-[300px] [transform:rotate(-2deg)]">
              <p className="label-engraved mb-2">Interface preview · rig inspector</p>
              <div className="flex flex-wrap gap-1.5"><Provenance kind="declared" /><Provenance kind="inferred" /></div>
              <ol className="mt-3 space-y-1.5 font-mono text-xs text-ink-dim">
                {["Offset · bridge pickup", "Compressor · sustain 4", "Overdrive · gain 3", "Tweed-style amp · vol 7", "Echo in the loop · 380 ms"].map((s, i) => (
                  <li key={s} className="flex items-center gap-2"><span className="text-muted">{String(i + 1).padStart(2, "0")}</span>{s}</li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
