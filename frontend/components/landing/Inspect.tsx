import GuitarArt from "@/components/landing/art/GuitarArt";
import Icon from "@/components/icons/Icon";
import { Provenance } from "@/components/app/ui";

const CALLOUTS = [
  { x: "27%", y: "58%", label: "Pickups & position", text: "Which pickup, which tuning, which strings." },
  { x: "46%", y: "77%", label: "Knobs as they're set", text: "Volume rolled to 7 is half the tone. It's in the rig." },
  { x: "17%", y: "40%", label: "Bridge to cab", text: "Every block in order: front of amp, or in the loop." },
];

/** Zoomed-in gear with callouts, then the one idea Resoniq is built on: declared vs. inferred. */
export default function Inspect() {
  return (
    <section id="inspect" className="relative scroll-mt-20 overflow-hidden py-24" aria-labelledby="inspect-title">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
        <p className="label-engraved mb-4">Inspect any performance</p>
        <h2 id="inspect-title" className="max-w-5xl font-display text-display-lg font-semibold tracking-[-0.035em]">See someone play. <span className="text-copper">Open their signal chain.</span></h2>
      </div>
      <div className="relative mx-auto mt-6 max-w-[1700px]">
        <GuitarArt className="w-[150%] max-w-none -translate-x-[12%] sm:w-[125%] lg:w-full lg:translate-x-0" title="An offset-body electric guitar" />
        {CALLOUTS.map((c) => (
          <div key={c.label} className="absolute hidden lg:block" style={{ left: c.x, top: c.y }}>
            <span className="absolute -left-2 -top-2 h-4 w-4 rounded-full border-2 border-signal bg-bg shadow-[0_0_16px_var(--color-signal)]" />
            <div className="panel ml-6 -mt-3 w-60 p-3"><p className="font-display text-sm font-semibold">{c.label}</p><p className="font-body text-xs text-muted">{c.text}</p></div>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-12 grid max-w-[1440px] gap-4 px-4 sm:px-8 lg:grid-cols-2">
        <div className="panel p-7">
          <Provenance kind="declared" />
          <h3 className="mt-4 font-display text-3xl font-semibold tracking-tight">What the player says they used.</h3>
          <p className="mt-3 font-body text-ink-dim">Guitar, pedals in order, amp settings, cab and mic, notes on technique. Optional, piece by piece: share one pedal or the whole board. Gear from the catalog or your own custom builds.</p>
        </div>
        <div className="panel p-7">
          <Provenance kind="inferred" />
          <h3 className="mt-4 font-display text-3xl font-semibold tracking-tight">What Resoniq&apos;s analysis heard.</h3>
          <p className="mt-3 font-body text-ink-dim">Measured from the audio: gain, EQ balance, effects, an amp family as a closest match with heuristic confidence. Always labeled. Never passed off as the player&apos;s actual rig.</p>
        </div>
      </div>
      <p className="mx-auto mt-6 flex max-w-[1440px] items-center gap-2 px-4 font-body text-sm text-muted sm:px-8"><Icon name="info" size={16} /> The two never merge. Adjusted analysis results are labeled “inferred · adjusted”.</p>
    </section>
  );
}
