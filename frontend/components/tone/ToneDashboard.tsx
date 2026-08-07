"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";
import SignalChainNode from "@/components/tone/SignalChainNode";
import Slider from "@/components/tone/Slider";
import { knobsFor, chainPosition } from "@/lib/effectConfig";

type ToneProfile = {
  gain_percent: number;
  eq: { bass: number; mid: number; treble: number };
  amp_family: string;
  cabinet: string;
  pickup_position: string;
  effects_chain: { name: string; confidence: number }[];
  playing_style_tags: string[];
  match_confidence: number;
};

type PedalState = { id: string; name: string; params: Record<string, number> };
type AmpState = {
  gain: number;
  bass: number;
  mid: number;
  treble: number;
  presence: number;
  master: number;
};

type SelectedNode = { kind: "amp" } | { kind: "pedal"; id: string } | null;

function buildInitialPedals(effects: { name: string; confidence: number }[]): {
  pre: PedalState[];
  post: PedalState[];
} {
  const pre: PedalState[] = [];
  const post: PedalState[] = [];

  effects
    .filter((fx) => fx.name !== "No significant effects detected")
    .forEach((fx, i) => {
      const knobs = knobsFor(fx.name);
      const params: Record<string, number> = {};
      knobs.forEach((k) => (params[k.key] = k.default));
      const pedal: PedalState = {
        id: `${fx.name}-${i}`,
        name: fx.name,
        params,
      };
      if (chainPosition(fx.name) === "pre") pre.push(pedal);
      else post.push(pedal);
    });

  return { pre, post };
}

export default function ToneDashboard({
  songId,
  profile,
}: {
  songId: string;
  profile: ToneProfile;
}) {
  const [amp, setAmp] = useState<AmpState>({
    gain: profile.gain_percent,
    bass: profile.eq.bass,
    mid: profile.eq.mid,
    treble: profile.eq.treble,
    presence: 50,
    master: 70,
  });

  const initial = useMemo(
    () => buildInitialPedals(profile.effects_chain),
    [profile.effects_chain],
  );
  const [pre, setPre] = useState<PedalState[]>(initial.pre);
  const [post, setPost] = useState<PedalState[]>(initial.post);
  const [selected, setSelected] = useState<SelectedNode>(null);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [toneName, setToneName] = useState(
    `${profile.amp_family.split(" ")[0]} tone`,
  );

  function updatePedalParam(id: string, key: string, value: number) {
    const updater = (list: PedalState[]) =>
      list.map((p) =>
        p.id === id ? { ...p, params: { ...p.params, [key]: value } } : p,
      );
    setPre((l) => updater(l));
    setPost((l) => updater(l));
  }

  const selectedPedal =
    selected?.kind === "pedal"
      ? [...pre, ...post].find((p) => p.id === selected.id)
      : null;

  async function handleSave() {
    setSaveState("saving");
    try {
      const res = await fetch("/api/tones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          songId,
          name: toneName,
          data: { profile, amp, pre, post },
        }),
      });
      if (!res.ok) throw new Error();
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      {/* Signal chain visualization */}
      <div className="glass rounded-panel p-8">
        <div className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-signal">
          signal chain
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SignalChainNode
            label="Guitar"
            sublabel={profile.pickup_position}
            index={0}
            active
          />
          <ChevronRight size={16} className="text-muted" />

          {pre.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2">
              <SignalChainNode
                label={p.name}
                selected={selected?.kind === "pedal" && selected.id === p.id}
                onClick={() => setSelected({ kind: "pedal", id: p.id })}
                index={i + 1}
                active
              />
              <ChevronRight size={16} className="text-muted" />
            </div>
          ))}

          <SignalChainNode
            label="Amp"
            sublabel={profile.amp_family}
            selected={selected?.kind === "amp"}
            onClick={() => setSelected({ kind: "amp" })}
            index={pre.length + 1}
            active
          />
          <ChevronRight size={16} className="text-muted" />

          <SignalChainNode
            label="Cabinet"
            sublabel={profile.cabinet}
            index={pre.length + 2}
            active
          />

          {post.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2">
              <ChevronRight size={16} className="text-muted" />
              <SignalChainNode
                label={p.name}
                selected={selected?.kind === "pedal" && selected.id === p.id}
                onClick={() => setSelected({ kind: "pedal", id: p.id })}
                index={pre.length + 3 + i}
                active
              />
            </div>
          ))}
        </div>

        <p className="mt-6 font-body text-xs text-muted">
          Click any block to adjust its settings. This starts from the inferred
          recipe — tune it by ear from here.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <input
            value={toneName}
            onChange={(e) => setToneName(e.target.value)}
            className="focus-ring flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 font-body text-sm outline-none"
            placeholder="Name this tone"
          />
          <button
            onClick={handleSave}
            disabled={saveState === "saving"}
            className="focus-ring shadow-glow whitespace-nowrap rounded-full bg-copper px-6 py-2.5 font-body text-sm font-semibold text-bg transition hover:bg-copper/90 disabled:opacity-60"
          >
            {saveState === "saving"
              ? "Saving…"
              : saveState === "saved"
                ? "Saved ✓"
                : "Save to library"}
          </button>
        </div>
        {saveState === "error" && (
          <p className="mt-2 font-body text-sm text-danger">
            Couldn't save — try again.
          </p>
        )}
      </div>

      {/* Controls panel */}
      <div className="glass rounded-panel p-8">
        <AnimatePresence mode="wait">
          {selected?.kind === "amp" && (
            <motion.div
              key="amp"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="font-display text-lg font-medium">
                {profile.amp_family}
              </div>
              <div className="mt-6 space-y-5">
                <Slider
                  label="Gain"
                  value={amp.gain}
                  onChange={(v) => setAmp((a) => ({ ...a, gain: v }))}
                />
                <Slider
                  label="Bass"
                  value={amp.bass}
                  onChange={(v) => setAmp((a) => ({ ...a, bass: v }))}
                />
                <Slider
                  label="Middle"
                  value={amp.mid}
                  onChange={(v) => setAmp((a) => ({ ...a, mid: v }))}
                />
                <Slider
                  label="Treble"
                  value={amp.treble}
                  onChange={(v) => setAmp((a) => ({ ...a, treble: v }))}
                />
                <Slider
                  label="Presence"
                  value={amp.presence}
                  onChange={(v) => setAmp((a) => ({ ...a, presence: v }))}
                />
                <Slider
                  label="Master"
                  value={amp.master}
                  onChange={(v) => setAmp((a) => ({ ...a, master: v }))}
                />
              </div>
            </motion.div>
          )}

          {selected?.kind === "pedal" && selectedPedal && (
            <motion.div
              key={selectedPedal.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="font-display text-lg font-medium">
                {selectedPedal.name}
              </div>
              <div className="mt-6 space-y-5">
                {knobsFor(selectedPedal.name).map((k) => (
                  <Slider
                    key={k.key}
                    label={k.label}
                    value={selectedPedal.params[k.key]}
                    onChange={(v) =>
                      updatePedalParam(selectedPedal.id, k.key, v)
                    }
                  />
                ))}
              </div>
            </motion.div>
          )}

          {!selected && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-full min-h-[240px] flex-col items-center justify-center text-center"
            >
              <p className="font-body text-sm text-muted">
                Select a block in the signal chain to edit its settings.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
