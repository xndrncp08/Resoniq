import AmpPanel from "@/components/tone/AmpPanel";
import Pedalboard from "@/components/tone/Pedalboard";
import RecipeSummary from "@/components/tone/RecipeSummary";
import Reveal from "@/components/motion/Reveal";
import { EXAMPLE_MEASUREMENTS, EXAMPLE_RECIPE, EXAMPLE_SOURCE } from "@/lib/example-analysis";

/**
 * A real analysis, rendered with the same read-only components as a shared
 * tone page. Nothing here is mocked up; see lib/example-analysis.ts.
 */
export default function ExampleTones() {
  return (
    <section id="example-tone" className="relative mx-auto max-w-6xl scroll-mt-28 px-6 py-32">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">a real result</p>
        <h2 className="mt-3 max-w-xl text-balance font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          What comes out of an analysis.
        </h2>
        <p className="mt-4 max-w-2xl text-pretty font-body text-sm leading-relaxed text-muted">
          This is the engine&apos;s unedited output for{" "}
          <a href={EXAMPLE_SOURCE.url} className="focus-ring rounded text-ink underline decoration-white/20 underline-offset-4 hover:decoration-ink">
            a short metal riff
          </a>{" "}
          by {EXAMPLE_SOURCE.author} (
          <a href={EXAMPLE_SOURCE.licenseUrl} className="focus-ring rounded underline decoration-white/20 underline-offset-4 hover:text-ink">
            {EXAMPLE_SOURCE.license}
          </a>
          ), misses included: it reads the gain right, but a player would likely bypass the tremolo and reach for the
          bridge pickup. That&apos;s what the editable dashboard is for.
        </p>
      </Reveal>

      <Reveal className="mt-12 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <AmpPanel amp={EXAMPLE_RECIPE.amp} cabinet={EXAMPLE_RECIPE.cabinet} pickup={EXAMPLE_RECIPE.pickup} />
        <RecipeSummary recipe={EXAMPLE_RECIPE} />
      </Reveal>

      <Reveal className="glass mt-6 rounded-panel p-6">
        <div className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-signal">pedalboard</div>
        <Pedalboard pedals={EXAMPLE_RECIPE.pedalboard} />
      </Reveal>

      <Reveal className="mt-6">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-white/[0.08] bg-white/[0.06] sm:grid-cols-4">
          {EXAMPLE_MEASUREMENTS.map((m) => (
            <div key={m.label} className="bg-bg px-5 py-4">
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">{m.label}</dt>
              <dd className="mt-1 font-mono text-sm tabular-nums text-signal">{m.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 font-mono text-[11px] text-muted">measured from the recording · the recipe above is inferred from these</p>
      </Reveal>
    </section>
  );
}
