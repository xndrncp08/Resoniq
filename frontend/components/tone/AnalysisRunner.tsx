"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

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

type AnalysisData = { tone_profile: ToneProfile };

function EQBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between font-mono text-[11px] text-muted">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5">
        <div className="h-full rounded-full bg-copper" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default function AnalysisRunner({
  songId,
  initialStatus,
  initialData,
}: {
  songId: string;
  initialStatus: string;
  initialData: AnalysisData | null;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [data, setData] = useState<AnalysisData | null>(initialData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialStatus !== "UPLOADED") return;

    let cancelled = false;
    (async () => {
      setStatus("ANALYZING");
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ songId }),
        });
        const body = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          setError(body.error ?? "Analysis failed.");
          setStatus("FAILED");
          return;
        }
        setData(body.song.analysisData);
        setStatus("ANALYZED");
      } catch {
        if (!cancelled) {
          setError("Could not reach the analysis engine.");
          setStatus("FAILED");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "ANALYZING") {
    return (
      <div className="text-center">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          className="font-mono text-xs uppercase tracking-[0.2em] text-signal"
        >
          analyzing…
        </motion.div>
        <p className="mt-2 font-body text-sm text-muted">
          Extracting tone characteristics from the recording.
        </p>
      </div>
    );
  }

  if (status === "FAILED") {
    return (
      <div className="text-center">
        <p className="font-body text-sm text-danger">{error ?? "Analysis failed."}</p>
        <p className="mt-2 font-body text-xs text-muted">
          Make sure the python-engine service is running and reachable at
          PYTHON_ENGINE_URL.
        </p>
      </div>
    );
  }

  if (status === "ANALYZED" && data?.tone_profile) {
    const p = data.tone_profile;
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-panel p-8 text-left"
      >
        <div className="flex items-baseline gap-2">
          <span className="font-display text-4xl font-semibold text-copper">
            {p.match_confidence}%
          </span>
          <span className="font-mono text-xs text-muted">heuristic confidence</span>
        </div>
        <p className="mt-1 font-body text-xs text-muted">
          A starting point inferred from the recording — not a verified
          gear match. Adjust by ear from here.
        </p>

        <dl className="mt-6 space-y-3 font-body text-sm">
          <div className="flex justify-between border-b border-white/5 pb-2">
            <dt className="text-muted">Amp</dt>
            <dd className="text-right">{p.amp_family}</dd>
          </div>
          <div className="flex justify-between border-b border-white/5 pb-2">
            <dt className="text-muted">Cabinet</dt>
            <dd>{p.cabinet}</dd>
          </div>
          <div className="flex justify-between border-b border-white/5 pb-2">
            <dt className="text-muted">Pickup</dt>
            <dd>{p.pickup_position}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Gain</dt>
            <dd>{p.gain_percent}%</dd>
          </div>
        </dl>

        <div className="mt-6 space-y-4">
          <EQBar label="Bass" value={p.eq.bass} />
          <EQBar label="Mid" value={p.eq.mid} />
          <EQBar label="Treble" value={p.eq.treble} />
        </div>

        <div className="mt-6">
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted">effects</div>
          <ul className="mt-2 space-y-1.5">
            {p.effects_chain.map((fx) => (
              <li key={fx.name} className="flex justify-between font-body text-sm">
                <span>{fx.name}</span>
                <span className="font-mono text-xs text-muted">{Math.round(fx.confidence * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>

        {p.playing_style_tags.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {p.playing_style_tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 px-3 py-1 font-mono text-[11px] text-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </motion.div>
    );
  }

  return null;
}