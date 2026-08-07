"use client";

import { motion } from "framer-motion";

export default function SignalChainNode({
  label,
  sublabel,
  active,
  selected,
  onClick,
  index,
}: {
  label: string;
  sublabel?: string;
  active?: boolean;
  selected?: boolean;
  onClick?: () => void;
  index: number;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      whileHover={onClick ? { scale: 1.04 } : undefined}
      className={`focus-ring flex min-w-[110px] flex-col items-center justify-center rounded-2xl border px-4 py-4 text-center transition ${
        selected
          ? "border-copper bg-copper/[0.08] shadow-glow"
          : active
          ? "glass border-white/10 hover:border-copper/40"
          : "border-white/5 bg-white/[0.015] text-muted"
      } ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      <span className="font-display text-sm font-medium">{label}</span>
      {sublabel && <span className="mt-1 font-mono text-[10px] text-muted">{sublabel}</span>}
    </motion.button>
  );
}