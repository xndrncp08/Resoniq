"use client";

import { useState } from "react";
import { motion, type Variants } from "motion/react";
import { RotateCcw } from "lucide-react";
import type { ToneRecipe } from "@/types/tone";
import type { StoredToneData } from "@/lib/tone-recipe";
import AmpPanel from "@/components/tone/AmpPanel";
import Pedalboard from "@/components/tone/Pedalboard";
import RecipeSummary from "@/components/tone/RecipeSummary";
import SignalMonitor from "@/components/tone/SignalMonitor";
import SignalChain from "@/components/tone/SignalChain";
import MeasurementsPanel from "@/components/tone/MeasurementsPanel";
import ToneMatcher from "@/components/tone/ToneMatcher";
import type { EngineAnalysis } from "@/types/engine";
import Feedback from "@/components/ui/Feedback";
import { notifyDataChanged } from "@/lib/studio/events";
import { spring } from "@/lib/motion";

// The moment analysis lands: panels assemble down the signal path, one
// after another. Reduced motion keeps the fade and drops the movement.
const assemble: Variants = { show: { transition: { staggerChildren: 0.09 } } };
const panel: Variants = {
  hidden: { opacity: 0, y: 20, filter: "blur(4px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: spring.enter },
};

export default function ToneDashboard({
  songId,
  initialRecipe,
  measurements,
}: {
  songId: string;
  initialRecipe: ToneRecipe;
  measurements?: EngineAnalysis["raw_features"];
}) {
  const [recipe, setRecipe] = useState<ToneRecipe>(initialRecipe);
  const [toneName, setToneName] = useState(initialRecipe.title);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveAttempts, setSaveAttempts] = useState(0);

  function update(patch: Partial<ToneRecipe>) {
    setRecipe((r) => ({ ...r, ...patch }));
    if (saveState === "saved") setSaveState("idle");
  }

  async function handleSave() {
    setSaveAttempts((n) => n + 1);
    setSaveState("saving");
    const { confidenceScore, recipeDescription, amp, cabinet, pickup, pedalboard, similarArtists } = recipe;
    const data: StoredToneData = {
      version: 2,
      recipe: { confidenceScore, recipeDescription, amp, cabinet, pickup, pedalboard, similarArtists },
    };
    try {
      const res = await fetch("/api/tones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId, name: toneName.trim() || initialRecipe.title, data }),
      });
      setSaveState(res.ok ? "saved" : "error");
      if (res.ok) notifyDataChanged();
    } catch {
      setSaveState("error");
    }
  }

  return (
    // @container: panels lay out by the space they get (a Studio window or the page), not the viewport.
    <motion.div variants={assemble} initial="hidden" animate="show" className="@container space-y-6">
      {measurements && (
        <motion.div variants={panel}>
          {/* Plays against the analysis as it came back, not later knob edits. */}
          <ToneMatcher features={measurements} amp={initialRecipe.amp} confidence={initialRecipe.confidenceScore} />
        </motion.div>
      )}

      {recipe.audioUrl && (
        <motion.div variants={panel}>
          <SignalMonitor audioUrl={recipe.audioUrl} amp={recipe.amp} />
        </motion.div>
      )}

      <motion.section variants={panel} className="glass rounded-panel p-6" aria-labelledby="chain-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="chain-heading" className="font-mono text-xs uppercase tracking-[0.2em] text-signal">
            signal chain
          </h2>
          <button
            type="button"
            onClick={() => update({ amp: initialRecipe.amp, pickup: initialRecipe.pickup, pedalboard: initialRecipe.pedalboard })}
            className="focus-ring flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted transition hover:text-ink"
          >
            <RotateCcw size={12} /> reset to analysis
          </button>
        </div>

        <div className="mt-4">
          <SignalChain recipe={recipe} />
        </div>

        <div className="mt-5">
          <Pedalboard pedals={recipe.pedalboard} onChange={(pedalboard) => update({ pedalboard })} />
        </div>
        {recipe.pedalboard.length > 1 && (
          <p className="mt-3 font-body text-xs text-muted">
            Drag a pedal by its grip to change the order. Click the footswitch to bypass it.
          </p>
        )}
      </motion.section>

      <motion.div variants={panel} className="grid gap-6 @3xl:grid-cols-[1.2fr_1fr]">
        <AmpPanel
          amp={recipe.amp}
          cabinet={recipe.cabinet}
          pickup={recipe.pickup}
          onAmpChange={(amp) => update({ amp })}
          onPickupChange={(pickup) => update({ pickup })}
        />
        <RecipeSummary recipe={recipe} />
      </motion.div>

      {measurements && (
        <motion.div variants={panel}>
          <MeasurementsPanel features={measurements} />
        </motion.div>
      )}

      <motion.div variants={panel} className="glass flex flex-wrap items-center gap-3 rounded-panel p-4">
        <label htmlFor="tone-name" className="sr-only">
          Tone name
        </label>
        <input
          id="tone-name"
          value={toneName}
          onChange={(e) => setToneName(e.target.value)}
          className="focus-ring min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 font-body text-base sm:text-sm outline-none"
          placeholder="Name this tone"
        />
        <button
          onClick={handleSave}
          disabled={saveState === "saving"}
          className="focus-ring shadow-glow whitespace-nowrap rounded-full bg-copper px-6 py-2.5 font-body text-sm font-semibold text-bg transition hover:bg-copper/90 disabled:opacity-60"
        >
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : "Save to library"}
        </button>
        <p role="status" className="sr-only">
          {saveState === "saved" ? "Saved to your library." : ""}
        </p>
        {saveState === "error" && (
          <Feedback tone="error" trigger={saveAttempts} className="w-full font-body text-sm">
            Couldn&apos;t save. Try again.
          </Feedback>
        )}
      </motion.div>
    </motion.div>
  );
}
