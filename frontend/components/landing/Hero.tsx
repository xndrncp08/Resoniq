"use client";

import { motion, type Variants } from "framer-motion";
import Link from "next/link";
import WaveformBackground from "@/components/animations/WaveformBackground";
import { spring, STAGGER_S } from "@/lib/motion";

const group: Variants = { show: { transition: { staggerChildren: STAGGER_S * 1.5, delayChildren: 0.15 } } };
const item: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: spring.enter },
};

export default function Hero() {
  return (
    <section className="relative flex min-h-svh items-center justify-center overflow-hidden px-6">
      <WaveformBackground />

      <motion.div variants={group} initial="hidden" animate="show" className="relative z-10 mx-auto max-w-3xl text-center">
        <motion.p variants={item} className="mb-5 font-mono text-xs uppercase tracking-[0.25em] text-signal">
          tone inference, from the recording out
        </motion.p>

        <motion.h1
          variants={item}
          className="text-glow text-balance font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl"
        >
          Recreate Any
          <br />
          Guitar Tone.
        </motion.h1>

        <motion.p variants={item} className="mx-auto mt-6 max-w-xl text-pretty font-body text-lg text-muted">
          Upload a song and get a starting-point recipe for the amp, pedals, EQ, and effects, inferred from the
          recording itself.
        </motion.p>

        <motion.div variants={item} className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/analyze"
            className="focus-ring shadow-glow rounded-full bg-copper px-8 py-3.5 font-body text-sm font-semibold text-bg transition-[background-color,transform] hover:bg-copper/90 active:scale-[0.98]"
          >
            Analyze a song
          </Link>
          <a
            href="#example-tone"
            className="focus-ring glass rounded-full px-8 py-3.5 font-body text-sm font-medium text-ink transition-colors hover:bg-white/[0.08]"
          >
            See a real result
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
}
