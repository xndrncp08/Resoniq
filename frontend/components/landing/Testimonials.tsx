"use client";

import { motion } from "framer-motion";

const quotes = [
  {
    name: "Priya Nadarajah",
    role: "session guitarist",
    quote:
      "I gave it a live bootleg with terrible room mic'ing and it still landed on the right amp family. Saved me an afternoon of guessing.",
  },
  {
    name: "Marcus Webb",
    role: "home recordist",
    quote:
      "The signal chain ordering is what got me — it's not just a list of pedals, it actually reasons about what's likely first in the chain.",
  },
  {
    name: "Elena Voss",
    role: "guitar teacher",
    quote:
      "I use the tone recipes as a teaching shortcut. Students can see and hear a real signal chain instead of me describing it from memory.",
  },
];

export default function Testimonials() {
  return (
    <section className="relative mx-auto max-w-6xl px-6 py-32">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">from players</p>
      <h2 className="mt-3 max-w-lg font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        Guitarists using it to skip the guesswork.
      </h2>

      <div className="mt-16 grid gap-5 sm:grid-cols-3">
        {quotes.map((q, i) => (
          <motion.div
            key={q.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="glass rounded-panel p-8"
          >
            <p className="font-body text-sm leading-relaxed text-ink/90">“{q.quote}”</p>
            <div className="mt-6 font-mono text-xs text-muted">
              {q.name} — {q.role}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
