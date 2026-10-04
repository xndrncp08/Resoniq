"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import ToneDashboard from "@/components/tone/ToneDashboard";
import { recipeFromAnalysis, type SongMeta } from "@/lib/tone-recipe";
import type { EngineAnalysis } from "@/types/engine";

const POLL_MS = 3000;

type SongStatus = { status: string; analysisData: EngineAnalysis | null; analysisError: string | null };

export default function AnalysisRunner({
  song,
  initialStatus,
  initialError,
  initialData,
}: {
  song: SongMeta;
  initialStatus: string;
  initialError: string | null;
  initialData: EngineAnalysis | null;
}) {
  const songId = song.id;
  const [status, setStatus] = useState(initialStatus);
  const [data, setData] = useState<EngineAnalysis | null>(initialData);
  const [error, setError] = useState<string | null>(initialError);
  const started = useRef(false);
  // Stable identity, so the dashboard's one-shot reveal doesn't restart on re-render.
  const recipe = useMemo(() => (data?.tone_profile ? recipeFromAnalysis(data, song) : null), [data, song]);

  const run = useCallback(async () => {
    setStatus("ANALYZING");
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setData(body.song.analysisData);
        setStatus("ANALYZED");
      } else if (res.status === 409) {
        // Another tab or an earlier request owns the job; follow it instead.
        setStatus("ANALYZING");
      } else {
        setError(body.error ?? "Analysis failed.");
        setStatus("FAILED");
      }
    } catch {
      setError("Couldn't reach Resoniq. Check your connection and try again.");
      setStatus("FAILED");
    }
  }, [songId]);

  // Start the analysis once for a fresh upload. The ref keeps React's
  // dev-mode double effect from firing two requests.
  useEffect(() => {
    if (initialStatus !== "UPLOADED" || started.current) return;
    started.current = true;
    void run();
  }, [initialStatus, run]);

  // While a job runs that this page didn't start (reload, second tab), poll it.
  useEffect(() => {
    if (status !== "ANALYZING" || initialStatus === "UPLOADED") return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/songs/${songId}`).catch(() => null);
      if (!res?.ok) return;
      const { song: s } = (await res.json()) as { song: SongStatus };
      if (s.status === "ANALYZING") return;
      setData(s.analysisData);
      setError(s.analysisError);
      setStatus(s.status);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [status, initialStatus, songId]);

  if (status === "ANALYZING" || status === "UPLOADED") {
    return (
      <div className="text-center" role="status">
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
      <div className="text-center" role="alert">
        <p className="font-body text-sm text-danger">{error ?? "Analysis failed."}</p>
        <button
          type="button"
          onClick={run}
          className="focus-ring mt-4 rounded-full border border-white/10 px-5 py-2 font-body text-sm text-ink transition hover:bg-white/[0.05]"
        >
          Try again
        </button>
      </div>
    );
  }

  if (status === "ANALYZED" && data && recipe) {
    return <ToneDashboard songId={songId} initialRecipe={recipe} measurements={data.raw_features} />;
  }

  return null;
}
