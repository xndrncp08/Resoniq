"use client";

import { motion } from "framer-motion";

const stages = [
  { name: "Guitar", note: "isolated from the mix" },
  { name: "Pedals", note: "drive, mod, dynamics" },
  { name: "Amp", note: "voicing + gain structure" },
  { name: "Cabinet", note: "mic'd response" },
  { name: "Time FX", note: "delay, reverb" },
  { name: "EQ", note: "final tonal shape" },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative mx-auto max-w-6xl px-6 py-32"
    >
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">
        how it works
      </p>
      <h2 className="mt-3 max-w-lg font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        Resoniq reconstructs the signal chain, stage by stage.
      </h2>

      <div className="mt-16 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-0">
        {stages.map((s, i) => (
          <div key={s.name} className="flex flex-1 items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="glass w-full rounded-2xl px-5 py-6 text-center transition hover:border-copper/40"
            >
              <div className="font-display text-base font-medium">{s.name}</div>
              <div className="mt-1 font-mono text-[11px] text-muted">
                {s.note}
              </div>
            </motion.div>
            {i < stages.length - 1 && (
              <motion.div
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 + 0.15 }}
                className="hidden h-px w-6 flex-shrink-0 origin-left bg-copper/40 sm:block"
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
