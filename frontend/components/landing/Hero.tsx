"use client";

import { motion } from "framer-motion";
import WaveformBackground from "@/components/animations/WaveformBackground";

export default function Hero() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      <WaveformBackground />

      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="mb-5 font-mono text-xs uppercase tracking-[0.25em] text-signal"
        >
          gear recognition, from the recording out
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
          className="text-glow font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl"
        >
          Recreate Any
          <br />
          Guitar Tone.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="mx-auto mt-6 max-w-xl font-body text-lg text-muted"
        >
          Upload your favorite songs and discover the amp, pedals, EQ, and
          effects behind the sound.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <button className="focus-ring shadow-glow rounded-full bg-copper px-8 py-3.5 font-body text-sm font-semibold text-bg transition hover:scale-[1.03]">
            Analyze A Song
          </button>
          <button className="focus-ring glass rounded-full px-8 py-3.5 font-body text-sm font-medium text-ink transition hover:bg-white/[0.08]">
            Explore Tones
          </button>
        </motion.div>
      </div>
    </section>
  );
}
