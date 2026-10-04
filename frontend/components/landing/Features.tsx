import Reveal from "@/components/motion/Reveal";
import { STAGGER_S } from "@/lib/motion";

const features = [
  {
    label: "Measure",
    title: "Tone character analysis",
    body: "Brightness, warmth, saturation, compression, attack, and decay — measured from the recording's spectrum and dynamics with Librosa.",
  },
  {
    label: "Infer",
    title: "Closest-match gear",
    body: "An amp voicing, cabinet, and pickup position suggested from those measurements by a transparent rules engine. A direction to start from, not a gear ID.",
  },
  {
    label: "Chain",
    title: "Signal chain order",
    body: "Not just which effects — where they usually sit: dynamics and drive before the amp, modulation and time-based effects after it.",
  },
  {
    label: "Tune",
    title: "Editable tone recipe",
    body: "Every knob is yours afterward — amp gain and EQ, pedal drive, tone, and level, bypass and order — starting from the inferred recipe.",
  },
];

export default function Features() {
  return (
    <section id="features" className="relative mx-auto max-w-6xl scroll-mt-28 px-6 py-32">
      <Reveal>
        <h2 className="mb-16 max-w-lg text-balance font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          One upload. A complete tone recipe.
        </h2>
      </Reveal>

      <div className="grid gap-5 sm:grid-cols-2">
        {features.map((f, i) => (
          <Reveal
            key={f.title}
            delay={i * STAGGER_S}
            className="glass rounded-panel p-8 transition-colors duration-300 hover:border-copper/30"
          >
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-signal">{f.label}</span>
            <h3 className="mt-3 font-display text-xl font-medium">{f.title}</h3>
            <p className="mt-3 text-pretty font-body text-sm leading-relaxed text-muted">{f.body}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
