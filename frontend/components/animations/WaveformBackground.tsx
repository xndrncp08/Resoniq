"use client";

import { useRef } from "react";
import { gsap, REDUCED_MOTION, ScrollTrigger, useGSAP } from "@/lib/gsap";

const VIEW_W = 1350;

/**
 * Each trace: its clean shape (hand-drawn cubic curves) and the parameters
 * of the same wave as a sine, used to compute its overdriven twin.
 * `dir` is -1 when the wave rises first (SVG y grows downward).
 */
const traces = [
  {
    clean: "M0,120 C 150,60 300,180 450,120 S 750,60 900,120 S 1200,180 1350,120",
    base: 120, period: 450, dir: -1, opacity: 0.5, color: "var(--color-signal)", drift: 14,
  },
  {
    clean: "M0,140 C 120,190 320,90 480,140 S 760,190 920,140 S 1180,90 1350,140",
    base: 140, period: 460, dir: 1, opacity: 0.28, color: "var(--color-copper)", drift: 18,
  },
  {
    clean: "M0,100 C 200,40 340,160 500,100 S 800,40 960,100 S 1240,160 1350,100",
    base: 100, period: 480, dir: -1, opacity: 0.18, color: "var(--color-signal)", drift: 22,
  },
];

const AMPLITUDE = 45;
const DRIVE = 3.2; // tanh soft-clip amount: how hard the "amp" is pushed

/** The trace pushed through a soft clipper: flat-topped, like an overdriven amp's output. */
function drivenPath(t: (typeof traces)[number]) {
  const norm = Math.tanh(DRIVE);
  const points: string[] = [];
  for (let x = 0; x <= VIEW_W; x += 6) {
    const s = Math.sin((2 * Math.PI * x) / t.period);
    const y = t.base + t.dir * AMPLITUDE * (Math.tanh(DRIVE * s) / norm);
    points.push(`${points.length ? "L" : "M"}${x},${y.toFixed(1)}`);
  }
  return points.join(" ");
}

/**
 * Signature element: three oscilloscope traces, like three pickups reading
 * the same string at slightly different phase.
 *
 * - On load each trace sweeps in left to right (a scope's first pass).
 * - Scrolling the hero away morphs the traces from clean into overdriven
 *   (GSAP MorphSVG scrubbed by ScrollTrigger): the product's story, from
 *   the recording to the drive behind it.
 * - An idle drift runs only while the hero is on screen.
 *
 * Reduced motion: traces render static and clean.
 */
export default function WaveformBackground() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(`not ${REDUCED_MOTION}`, () => {
        const paths = gsap.utils.toArray<SVGPathElement>("[data-trace]");

        gsap.from(paths, {
          drawSVG: 0,
          duration: 1.6,
          ease: "expo.out",
          stagger: 0.12,
          delay: 0.1,
        });

        const drift = paths.map((p, i) =>
          gsap.fromTo(p, { x: -40 }, { x: 40, duration: traces[i].drift / 2, ease: "sine.inOut", repeat: -1, yoyo: true }),
        );

        const morph = gsap.timeline({
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: "bottom top",
            scrub: 0.6,
          },
        });
        paths.forEach((p, i) => morph.to(p, { morphSVG: drivenPath(traces[i]), ease: "none" }, 0));

        // No point animating a background nobody can see.
        ScrollTrigger.create({
          trigger: root.current,
          start: "top bottom",
          end: "bottom top",
          onToggle: ({ isActive }) => drift.forEach((t) => (isActive ? t.resume() : t.pause())),
        });
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <svg viewBox={`0 0 ${VIEW_W} 240`} preserveAspectRatio="none" className="absolute left-0 top-1/3 h-[240px] w-full">
        {traces.map((t, i) => (
          <path
            key={i}
            data-trace
            d={t.clean}
            fill="none"
            stroke={t.color}
            strokeWidth={1.5}
            strokeOpacity={t.opacity}
          />
        ))}
      </svg>
      {/* radial glow anchoring the hero headline, like a tube socket underlight */}
      <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] max-w-[120vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-copper/10 blur-[140px]" />
    </div>
  );
}
