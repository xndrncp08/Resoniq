"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Player",
    price: "Free",
    note: "for casual exploring",
    features: ["5 analyses / month", "Save up to 10 tones", "Standard analysis depth"],
    highlight: false,
  },
  {
    name: "Session",
    price: "$14",
    note: "per month",
    features: [
      "Unlimited analyses",
      "Unlimited saved tones",
      "Full signal chain detail",
      "Playing-style analysis",
    ],
    highlight: true,
  },
  {
    name: "Studio",
    price: "$39",
    note: "per month",
    features: ["Everything in Session", "Team tone libraries", "Shareable tone links", "Priority processing"],
    highlight: false,
  },
];

export default function Pricing() {
  return (
    <section className="relative mx-auto max-w-6xl px-6 py-32">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">pricing</p>
      <h2 className="mt-3 max-w-lg font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        Pick your session length.
      </h2>

      <div className="mt-16 grid gap-5 sm:grid-cols-3">
        {plans.map((p, i) => (
          <motion.div
            key={p.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className={`rounded-panel p-8 ${
              p.highlight
                ? "border border-copper/40 bg-copper/[0.06] shadow-glow"
                : "glass"
            }`}
          >
            <div className="font-display text-lg font-medium">{p.name}</div>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="font-display text-4xl font-semibold">{p.price}</span>
              <span className="font-mono text-xs text-muted">{p.note}</span>
            </div>
            <ul className="mt-6 space-y-3">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 font-body text-sm text-muted">
                  <Check size={16} className="mt-0.5 flex-shrink-0 text-signal" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              className={`focus-ring mt-8 w-full rounded-full py-3 font-body text-sm font-medium transition ${
                p.highlight
                  ? "bg-copper text-bg hover:bg-copper/90"
                  : "glass text-ink hover:bg-white/[0.08]"
              }`}
            >
              {p.price === "Free" ? "Start free" : "Choose plan"}
            </button>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
