"use client";

import Image from "next/image";
import { motion } from "framer-motion";

const links = ["Product", "How it works", "Tones", "Pricing"];

export default function Nav() {
  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed top-0 z-50 w-full"
    >
      <div className="glass mx-auto mt-4 flex max-w-6xl items-center justify-between rounded-panel px-6 py-3">
        <div className="flex items-center gap-2">
          <Image src="/logo.svg" alt="Resoniq" width={32} height={32} className="rounded-lg" />
          <span className="font-display text-lg font-semibold tracking-tight">Resoniq</span>
        </div>
        <nav className="hidden gap-8 font-body text-sm text-muted md:flex">
          {links.map((l) => (
            <a key={l} href="#" className="focus-ring transition hover:text-ink">
              {l}
            </a>
          ))}
        </nav>
        <button className="focus-ring rounded-full bg-copper px-5 py-2 font-body text-sm font-medium text-bg transition hover:bg-copper/90">
          Analyze A Song
        </button>
      </div>
    </motion.header>
  );
}
