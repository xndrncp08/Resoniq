"use client";

import { motion } from "framer-motion";

const example = {
  song: "Slow Dancing In A Burning Room",
  artist: "John Mayer",
  matchScore: 92,
  amp: "Two-Rock style clean",
  cab: "2x12 open back",
  effects: ["Compressor", "Blues Driver-style overdrive", "Spring reverb", "Delay"],
  eq: { bass: 45, mid: 60, treble: 70 },
  gain: 25,
  pickup: "Neck + middle",
};

function EQBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between font-mono text-[11px] text-muted">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${value}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full bg-copper"
        />
      </div>
    </div>
  );
}

export default function ExampleTones() {
  return (
    <section className="relative mx-auto max-w-6xl px-6 py-32">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">example tone</p>
      <h2 className="mt-3 max-w-lg font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        What comes out of an analysis.
      </h2>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6 }}
        className="glass shadow-panel mt-14 grid gap-10 rounded-panel p-10 sm:grid-cols-[1fr_1.2fr]"
      >
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            {example.artist}
          </div>
          <div className="mt-1 font-display text-2xl font-medium">{example.song}</div>

          <div className="mt-8 flex items-baseline gap-2">
            <span className="font-display text-5xl font-semibold text-copper">
              {example.matchScore}%
            </span>
            <span className="font-mono text-xs text-muted">tone match score</span>
          </div>

          <dl className="mt-8 space-y-3 font-body text-sm">
            <div className="flex justify-between border-b border-white/5 pb-2">
              <dt className="text-muted">Amp</dt>
              <dd>{example.amp}</dd>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <dt className="text-muted">Cabinet</dt>
              <dd>{example.cab}</dd>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <dt className="text-muted">Pickup</dt>
              <dd>{example.pickup}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Gain</dt>
              <dd>{example.gain}%</dd>
            </div>
          </dl>
        </div>

        <div>
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            effects chain
          </div>
          <ul className="mt-3 space-y-2">
            {example.effects.map((fx) => (
              <li
                key={fx}
                className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-2.5 font-body text-sm"
              >
                {fx}
              </li>
            ))}
          </ul>

          <div className="mt-8 space-y-4">
            <EQBar label="Bass" value={example.eq.bass} />
            <EQBar label="Mid" value={example.eq.mid} />
            <EQBar label="Treble" value={example.eq.treble} />
          </div>
        </div>
      </motion.div>
    </section>
  );
}
