"use client";

import { motion } from "framer-motion";

const features = [
  {
    label: "Detect",
    title: "Tone character analysis",
    body: "Brightness, warmth, saturation, compression, and attack — extracted straight from the recording's spectral and dynamic profile.",
  },
  {
    label: "Match",
    title: "Gear recommendations",
    body: "Amp voicing, cabinet type, and pickup position suggested from the harmonic and transient signature of the guitar track.",
  },
  {
    label: "Chain",
    title: "Full signal chain order",
    body: "Not just which effects — the order they likely sit in, from compressor through drive, amp, time-based effects, and EQ.",
  },
  {
    label: "Tune",
    title: "Editable tone recipe",
    body: "Every knob is yours to adjust afterward — gain, EQ, mix, feedback — starting from the recipe Resoniq inferred.",
  },
];

export default function Features() {
  return (
    <section className="relative mx-auto max-w-6xl px-6 py-32">
      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.5 }}
        className="mb-16 max-w-lg font-display text-3xl font-semibold tracking-tight sm:text-4xl"
      >
        One upload. A complete tone recipe.
      </motion.h2>

      <div className="grid gap-5 sm:grid-cols-2">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="glass rounded-panel p-8 transition hover:border-copper/30"
          >
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-signal">
              {f.label}
            </span>
            <h3 className="mt-3 font-display text-xl font-medium">{f.title}</h3>
            <p className="mt-3 font-body text-sm leading-relaxed text-muted">
              {f.body}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
