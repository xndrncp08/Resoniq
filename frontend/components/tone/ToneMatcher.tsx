"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useReducedMotion } from "motion/react";
import type { IProject, ISheet } from "@theatre/core";
import { gainsFromAmp, logFrequencies, MAX_DB, responseDb, xForHz } from "@/lib/eq";
import {
  MATCHER_LENGTH_S,
  MATCHER_OBJECT,
  MATCHER_PROJECT_ID,
  MATCHER_PROPS,
  MATCHER_SHEET,
  matcherState,
  type MatcherProp,
} from "@/lib/theatre/matcher-sequence";
import type { AmpSettings } from "@/types/tone";

type Values = Record<MatcherProp, number>;

const INPUTS = [
  { key: "brightness", label: "brightness" },
  { key: "warmth", label: "warmth" },
  { key: "saturation", label: "saturation" },
  { key: "compression", label: "compression" },
  { key: "sustain", label: "sustain" },
] as const;
type InputKey = (typeof INPUTS)[number]["key"];

const OUTPUTS = ["gain", "bass", "mids", "treble", "presence"] as const;
type OutputKey = (typeof OUTPUTS)[number];

// Which measurements feed which amp settings in the rules engine
// (python-engine/app/heuristics.py). An LLM-written recipe starts from the
// same draft, so this is the honest shape of the inference either way.
const EDGES: [InputKey, OutputKey][] = [
  ["saturation", "gain"],
  ["compression", "gain"],
  ["sustain", "gain"],
  ["warmth", "bass"],
  ["brightness", "mids"],
  ["brightness", "treble"],
  ["brightness", "presence"],
];

const W = 900;
const ROW_Y = (i: number) => 34 + i * 38;
const BAR_W = 120;
const IN_BAR_X = 120;
const OUT_LABEL_X = 650;
const OUT_BAR_X = 740;
const EQ = { x: 260, y: 214, w: 380, h: 70 };
const EQ_FREQS = logFrequencies(64);

// Theatre projects are global singletons per id; create it once per page load.
let projectPromise: Promise<{ project: IProject; sheet: ISheet }> | null = null;

function loadProject() {
  projectPromise ??= (async () => {
    if (process.env.NODE_ENV === "development" && new URLSearchParams(window.location.search).has("theatre")) {
      // Dev-only authoring UI. AGPL-licensed: this branch is dropped from
      // production builds and must stay that way.
      const studio = (await import("@theatre/studio")).default;
      studio.initialize();
    }
    const { getProject } = await import("@theatre/core");
    const project = getProject(MATCHER_PROJECT_ID, { state: matcherState() });
    await project.ready;
    return { project, sheet: project.sheet(MATCHER_SHEET) };
  })();
  return projectPromise;
}

function inputsFrom(features: Record<string, number | null>): Record<InputKey, number> {
  return {
    brightness: features.brightness ?? 0,
    warmth: features.warmth ?? 0,
    saturation: features.saturation ?? 0,
    compression: features.compression ?? 0,
    // The rules engine reads sustain as the inverse of the percussive share.
    sustain: 1 - (features.percussive_ratio ?? 0.5),
  };
}

const pct = (n: number) => `${Math.round(n)}`;
const fmt = (n: number) => n.toFixed(1);

/**
 * The moment an analysis lands: the measured inputs light up, signal paths
 * flow from them into the amp settings they drive, the EQ curve bends from
 * flat into the recipe's shape, and the heuristic confidence resolves last.
 *
 * Timing lives in a Theatre.js sequence (lib/theatre/matcher-sequence.ts);
 * this component only paints its six 0..1 channels onto the SVG through
 * refs, so playback never re-renders React.
 */
export default function ToneMatcher({
  features,
  amp,
  confidence,
}: {
  features: Record<string, number | null>;
  amp: AmpSettings;
  confidence: number;
}) {
  const reduce = useReducedMotion();
  const svg = useRef<SVGSVGElement>(null);
  const sheetRef = useRef<ISheet | null>(null);
  const [ready, setReady] = useState(false);

  const inputs = inputsFrom(features);

  // Paint is recreated only when the data changes; refs carry the DOM.
  const paint = useCallback(
    (v: Values) => {
      const root = svg.current;
      if (!root) return;
      const q = <T extends Element>(sel: string) => root.querySelectorAll<T>(sel);

      const measured = inputsFrom(features);
      q<SVGRectElement>("[data-in]").forEach((el) => {
        const value = measured[el.dataset.in as InputKey];
        el.setAttribute("width", fmt(Math.max(0, Math.min(1, value)) * BAR_W * v.inputs));
      });
      q<SVGTextElement>("[data-in-label]").forEach((el) => el.setAttribute("opacity", fmt(0.35 + 0.65 * v.inputs)));
      q<SVGPathElement>("[data-edge]").forEach((el) => {
        el.style.strokeDashoffset = String(1 - v.flow);
        el.style.opacity = String(0.15 + 0.6 * Math.min(1, v.flow * 1.4));
      });
      q<SVGRectElement>("[data-out]").forEach((el) => {
        el.setAttribute("width", fmt((amp[el.dataset.out as OutputKey] / 100) * BAR_W * v.outputs));
      });
      q<SVGTextElement>("[data-out-value]").forEach((el) => {
        el.textContent = pct(amp[el.dataset.outValue as OutputKey] * v.outputs);
      });

      const target = gainsFromAmp(amp);
      const gains = {
        bass: target.bass * v.eq,
        mids: target.mids * v.eq,
        treble: target.treble * v.eq,
        presence: target.presence * v.eq,
      };
      const dbs = responseDb(gains, EQ_FREQS);
      const d = EQ_FREQS.map(
        (f, i) => `${i ? "L" : "M"}${fmt(EQ.x + xForHz(f) * EQ.w)} ${fmt(EQ.y + EQ.h / 2 - (dbs[i] / (MAX_DB + 3)) * (EQ.h / 2))}`,
      ).join(" ");
      root.querySelector("[data-eq]")?.setAttribute("d", d);

      const conf = root.querySelector<SVGTextElement>("[data-confidence]");
      if (conf) conf.textContent = `${pct(confidence * v.confidence)}%`;
      root.querySelector("[data-glow]")?.setAttribute("opacity", fmt(v.glow));
    },
    [features, amp, confidence],
  );

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    loadProject()
      .then(({ sheet }) => {
        if (cancelled) return;
        const obj = sheet.object(
          MATCHER_OBJECT,
          Object.fromEntries(MATCHER_PROPS.map((p) => [p, 0])) as Values,
          { reconfigure: true },
        );
        unsubscribe = obj.onValuesChange((v) => paint(v as Values));
        sheetRef.current = sheet;
        setReady(true);
        if (reduce) {
          sheet.sequence.position = MATCHER_LENGTH_S;
        } else {
          sheet.sequence.position = 0;
          void sheet.sequence.play();
        }
      })
      .catch((err) => {
        // The reveal is decoration; if Theatre fails to load, show the end state.
        console.error("[matcher] could not load the sequence", err);
        paint({ inputs: 1, flow: 1, outputs: 1, eq: 1, confidence: 1, glow: 0 });
      });
    return () => {
      cancelled = true;
      unsubscribe?.();
      sheetRef.current?.sequence.pause();
    };
  }, [paint, reduce]);

  function replay() {
    const sheet = sheetRef.current;
    if (!sheet) return;
    sheet.sequence.position = 0;
    void sheet.sequence.play();
  }

  const outRow = (k: OutputKey) => OUTPUTS.indexOf(k);
  const inRow = (k: InputKey) => INPUTS.findIndex((i) => i.key === k);

  return (
    <section className="glass hidden rounded-panel p-6 sm:block" aria-labelledby="matcher-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="matcher-heading" className="font-mono text-xs uppercase tracking-[0.2em] text-signal">
          from measurement to recipe
        </h2>
        <button
          type="button"
          onClick={replay}
          disabled={!ready || !!reduce}
          className="focus-ring flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-ink disabled:opacity-40"
        >
          <RotateCcw size={12} aria-hidden /> replay
        </button>
      </div>

      <svg
        ref={svg}
        viewBox={`0 0 ${W} 300`}
        className="mt-4 h-auto w-full font-mono"
        role="img"
        aria-label={`Measurements feeding the recipe: ${INPUTS.map((i) => `${i.label} ${inputs[i.key].toFixed(2)}`).join(", ")}. Amp: ${OUTPUTS.map((o) => `${o} ${amp[o]}`).join(", ")}. Heuristic confidence ${confidence}%.`}
      >
        <defs>
          <linearGradient id="matcher-edge" x1="0" x2="1">
            <stop offset="0" stopColor="var(--color-signal)" />
            <stop offset="1" stopColor="var(--color-copper)" />
          </linearGradient>
          <filter id="matcher-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* inputs: what was measured */}
        <text x={0} y={12} fontSize={11} fill="var(--color-muted)" letterSpacing={2}>MEASURED</text>
        {INPUTS.map((input, i) => (
          <g key={input.key}>
            <text data-in-label x={0} y={ROW_Y(i) + 4} fontSize={13} fill="var(--color-ink)" opacity={0.35}>
              {input.label}
            </text>
            <rect x={IN_BAR_X} y={ROW_Y(i) - 4} width={BAR_W} height={8} rx={4} fill="rgba(255,255,255,0.06)" />
            <rect data-in={input.key} x={IN_BAR_X} y={ROW_Y(i) - 4} width={0} height={8} rx={4} fill="var(--color-signal)" />
          </g>
        ))}

        {/* edges: how the rules engine connects them */}
        {EDGES.map(([from, to]) => {
          const x1 = IN_BAR_X + BAR_W + 12;
          const y1 = ROW_Y(inRow(from));
          const x2 = OUT_LABEL_X - 14;
          const y2 = ROW_Y(outRow(to));
          return (
            <path
              key={`${from}-${to}`}
              data-edge
              d={`M${x1} ${y1} C${x1 + 140} ${y1} ${x2 - 140} ${y2} ${x2} ${y2}`}
              pathLength={1}
              fill="none"
              stroke="url(#matcher-edge)"
              strokeWidth={1.5}
              style={{ strokeDasharray: 1, strokeDashoffset: 1, opacity: 0.15 }}
            />
          );
        })}

        {/* outputs: the amp settings they drive */}
        <text x={OUT_LABEL_X} y={12} fontSize={11} fill="var(--color-muted)" letterSpacing={2}>AMP</text>
        {OUTPUTS.map((k, i) => (
          <g key={k}>
            <text x={OUT_LABEL_X} y={ROW_Y(i) + 4} fontSize={13} fill="var(--color-ink)">{k}</text>
            <rect x={OUT_BAR_X} y={ROW_Y(i) - 4} width={BAR_W} height={8} rx={4} fill="rgba(255,255,255,0.06)" />
            <rect data-out={k} x={OUT_BAR_X} y={ROW_Y(i) - 4} width={0} height={8} rx={4} fill="var(--color-copper)" />
            <text data-out-value={k} x={W} y={ROW_Y(i) + 4} fontSize={13} textAnchor="end" fill="var(--color-ink)">0</text>
          </g>
        ))}

        {/* the EQ the recipe implies, bending from flat */}
        <text x={EQ.x} y={EQ.y - 8} fontSize={11} fill="var(--color-muted)" letterSpacing={2}>EQ</text>
        <line x1={EQ.x} x2={EQ.x + EQ.w} y1={EQ.y + EQ.h / 2} y2={EQ.y + EQ.h / 2} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />
        <path data-eq d={`M${EQ.x} ${EQ.y + EQ.h / 2} L${EQ.x + EQ.w} ${EQ.y + EQ.h / 2}`} fill="none" stroke="var(--color-copper)" strokeWidth={2} />

        {/* confidence resolves last */}
        <text x={W} y={EQ.y + 6} fontSize={11} textAnchor="end" fill="var(--color-muted)" letterSpacing={2}>HEURISTIC CONFIDENCE</text>
        <text data-glow x={W} y={EQ.y + 48} fontSize={36} textAnchor="end" fill="var(--color-copper)" filter="url(#matcher-glow)" opacity={0}>
          {confidence}%
        </text>
        <text data-confidence x={W} y={EQ.y + 48} fontSize={36} textAnchor="end" fill="var(--color-ink)">0%</text>
      </svg>
    </section>
  );
}
