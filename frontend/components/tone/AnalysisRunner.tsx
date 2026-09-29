"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import ToneDashboard from "@/components/tone/ToneDashboard";
import { recipeFromAnalysis, type SongMeta } from "@/lib/tone-recipe";
import type { EngineAnalysis } from "@/types/engine";

export default function AnalysisRunner({
  song,
  initialStatus,
  initialData,
}: {
  song: SongMeta;
  initialStatus: string;
  initialData: EngineAnalysis | null;
}) {
  const songId = song.id;
  const [status, setStatus] = useState(initialStatus);
  const [data, setData] = useState<EngineAnalysis | null>(initialData);
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
        <p className="font-body text-sm text-danger">
          {error ?? "Analysis failed."}
        </p>
        <p className="mt-2 font-body text-xs text-muted">
          Make sure the python-engine service is running and reachable at
          PYTHON_ENGINE_URL.
        </p>
      </div>
    );
  }

  if (status === "ANALYZED" && data?.tone_profile) {
    return <ToneDashboard songId={songId} initialRecipe={recipeFromAnalysis(data, song)} />;
  }

  return null;
}
