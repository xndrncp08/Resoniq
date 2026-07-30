"use client";

import { motion } from "framer-motion";

/**
 * Signature element: three overlapping oscilloscope traces that drift and
 * breathe at different speeds, like three pickups reading the same string
 * at slightly different phase. Rendered once, absolutely positioned behind
 * hero content. Respects reduced-motion via Tailwind's media query in globals.css.
 */
export default function WaveformBackground() {
  const traces = [
    { path: "M0,120 C 150,60 300,180 450,120 S 750,60 900,120 S 1200,180 1350,120", opacity: 0.5, dur: 14, color: "#37E6C9" },
    { path: "M0,140 C 120,190 320,90 480,140 S 760,190 920,140 S 1180,90 1350,140", opacity: 0.28, dur: 18, color: "#FF8A3D" },
    { path: "M0,100 C 200,40 340,160 500,100 S 800,40 960,100 S 1240,160 1350,100", opacity: 0.18, dur: 22, color: "#37E6C9" },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg
        viewBox="0 0 1350 240"
        preserveAspectRatio="none"
        className="absolute left-0 top-1/3 w-full h-[240px]"
      >
        {traces.map((t, i) => (
          <motion.path
            key={i}
            d={t.path}
            fill="none"
            stroke={t.color}
            strokeWidth={1.5}
            strokeOpacity={t.opacity}
            initial={{ x: 0 }}
            animate={{ x: [-40, 40, -40] }}
            transition={{ duration: t.dur, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </svg>
      {/* radial glow anchoring the hero headline, like a tube socket underlight */}
      <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-copper/10 blur-[140px]" />
    </div>
  );
}
