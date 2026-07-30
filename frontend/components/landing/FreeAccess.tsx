"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Check } from "lucide-react";

const included = [
  "Unlimited song analyses",
  "Unlimited saved tones",
  "Full signal chain detail",
  "Playing-style analysis",
  "Shareable tone links",
];

export default function FreeAccess() {
  return (
    <section id="free-access" className="relative mx-auto max-w-6xl px-6 py-32">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">
        access
      </p>
      <h2 className="mt-3 max-w-lg font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        Free. No card, no tiers.
      </h2>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="glass shadow-panel mt-14 grid gap-10 rounded-panel p-10 sm:grid-cols-[1fr_auto] sm:items-center"
      >
        <div>
          <div className="font-display text-2xl font-medium">
            Everything, for everyone
          </div>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {included.map((f) => (
              <li
                key={f}
                className="flex items-start gap-2 font-body text-sm text-muted"
              >
                <Check size={16} className="mt-0.5 flex-shrink-0 text-signal" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <Link
          href="/signup"
          className="focus-ring shadow-glow whitespace-nowrap rounded-full bg-copper px-8 py-3.5 text-center font-body text-sm font-semibold text-bg transition hover:scale-[1.03]"
        >
          Create your account
        </Link>
      </motion.div>
    </section>
  );
}
