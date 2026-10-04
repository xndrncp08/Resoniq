"use client";

import { Fragment } from "react";
import { LayoutGroup, motion } from "motion/react";
import { classifyEffect } from "@/lib/effectConfig";
import { spring } from "@/lib/motion";
import type { ToneRecipe } from "@/types/tone";

type Node = { id: string; label: string; detail: string; kind: "source" | "pedal" | "amp" | "cab"; on: boolean };

/** Stable ids for pedals (they have no id of their own): name + occurrence. */
function pedalNodes(recipe: Pick<ToneRecipe, "pedalboard">): Node[] {
  const seen = new Map<string, number>();
  return recipe.pedalboard.map((p) => {
    const n = (seen.get(p.name) ?? 0) + 1;
    seen.set(p.name, n);
    return { id: `pedal:${p.name}:${n}`, label: p.name, detail: classifyEffect(p.name), kind: "pedal", on: p.enabled };
  });
}

/**
 * The signal path as connected nodes. Nodes share a LayoutGroup, so when a
 * pedal is dragged to a new slot on the pedalboard below, its node glides
 * to its new place here too; bypassed pedals dim and their link goes
 * dashed. Shared layout only, no per-frame work.
 */
export default function SignalChain({ recipe }: { recipe: Pick<ToneRecipe, "pickup" | "pedalboard" | "amp" | "cabinet"> }) {
  const nodes: Node[] = [
    { id: "guitar", label: "Guitar", detail: `${recipe.pickup} pickup`, kind: "source", on: true },
    ...pedalNodes(recipe),
    { id: "amp", label: recipe.amp.family, detail: `gain ${recipe.amp.gain}`, kind: "amp", on: true },
    { id: "cab", label: "Cabinet", detail: recipe.cabinet.type, kind: "cab", on: true },
  ];

  return (
    <LayoutGroup id="signal-chain">
      <ol aria-label="Signal chain" className="flex flex-wrap items-center gap-y-3">
        {nodes.map((node, i) => (
          <Fragment key={node.id}>
            {i > 0 && (
              <motion.li
                layout
                aria-hidden
                transition={spring.layout}
                className={`mx-1.5 h-px w-5 flex-shrink-0 sm:w-7 ${
                  node.on ? "bg-gradient-to-r from-signal/60 to-signal/30" : "border-t border-dashed border-white/20 bg-transparent"
                }`}
              />
            )}
            <motion.li
              layout
              layoutId={node.id}
              transition={spring.layout}
              animate={{ opacity: node.on ? 1 : 0.45 }}
              className={`rounded-xl border px-3 py-2 ${
                node.kind === "amp" || node.kind === "cab"
                  ? "border-copper/40 bg-copper/[0.06]"
                  : node.on && node.kind === "pedal"
                    ? "border-copper/30 bg-white/[0.03]"
                    : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center gap-1.5">
                {node.kind === "pedal" && (
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 rounded-full transition-colors ${
                      node.on ? "bg-copper shadow-[0_0_6px_var(--color-copper)]" : "bg-white/20"
                    }`}
                  />
                )}
                <span className="whitespace-nowrap font-display text-xs font-medium">{node.label}</span>
              </div>
              <div className="mt-0.5 whitespace-nowrap font-mono text-[10px] text-muted">
                {node.detail}
                {node.kind === "pedal" && !node.on && " · bypassed"}
              </div>
            </motion.li>
          </Fragment>
        ))}
      </ol>
    </LayoutGroup>
  );
}
