"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AnalysisProgress from "@/components/tone/AnalysisProgress";
import ToneDashboard from "@/components/tone/ToneDashboard";
import { sceneState } from "@/components/scene/state";
import { stageProgress, type StageEvent } from "@/lib/analysis-stages";
import { NDJSON, readNdjson } from "@/lib/ndjson";
import { recipeFromAnalysis, type SongMeta } from "@/lib/tone-recipe";
import type { EngineAnalysis } from "@/types/engine";

const POLL_MS = 3000;

type SongStatus = { status: string; analysisData: EngineAnalysis | null; analysisError: string | null };

type AnalyzeEvent =
  | StageEvent
  | { type: "done"; song: { analysisData: EngineAnalysis } }
  | { type: "error"; error: string };

export default function AnalysisRunner({
  song,
  initialStatus,
  initialError,
  initialData,
  onStatusChange,
}: {
  song: SongMeta;
  initialStatus: string;
  initialError: string | null;
  initialData: EngineAnalysis | null;
  onStatusChange?: (status: string) => void;
}) {
  const songId = song.id;
  const [status, setStatus] = useState(initialStatus);
  const [data, setData] = useState<EngineAnalysis | null>(initialData);
  const [error, setError] = useState<string | null>(initialError);
  const [stage, setStage] = useState<StageEvent | null>(null);
  // True when this page is polling a job rather than streaming it.
  const [following, setFollowing] = useState(initialStatus === "ANALYZING");
  const started = useRef(false);

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);
  // Stable identity, so the dashboard's one-shot reveal doesn't restart on re-render.
  const recipe = useMemo(() => (data?.tone_profile ? recipeFromAnalysis(data, song) : null), [data, song]);

  // Adopt a song's stored status (used when following a job this page didn't start).
  const adopt = useCallback((s: SongStatus) => {
    setData(s.analysisData);
    setError(s.analysisError);
    setStatus(s.status);
  }, []);

  const run = useCallback(async () => {
    setStatus("ANALYZING");
    setError(null);
    setStage(null);
    setFollowing(false);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: NDJSON },
        body: JSON.stringify({ songId }),
      });
      if (res.ok && res.body && res.headers.get("content-type")?.includes(NDJSON)) {
        let settled = false;
        await readNdjson<AnalyzeEvent>(res.body, (event) => {
          if (event.type === "stage") setStage(event);
          else if (event.type === "done") {
            settled = true;
            setData(event.song.analysisData);
            setStatus("ANALYZED");
          } else if (event.type === "error") {
            settled = true;
            setError(event.error);
            setStatus("FAILED");
          }
        }).catch(() => {});
        // The connection dropped mid-analysis. The job may still finish
        // server-side, so follow it rather than calling it failed.
        if (!settled) setFollowing(true);
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setData(body.song.analysisData);
        setStatus("ANALYZED");
      } else if (res.status === 409) {
        // Already running (another tab, an earlier request) or not analyzable.
        // Check which: follow a running job, otherwise show why.
        const current = await fetch(`/api/songs/${songId}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        const s = (current as { song: SongStatus } | null)?.song;
        if (s?.status === "ANALYZING") setFollowing(true);
        else if (s && s.status !== "UPLOADED") adopt(s);
        else {
          setError(body.error ?? "Analysis failed.");
          setStatus("FAILED");
        }
      } else {
        setError(body.error ?? "Analysis failed.");
        setStatus("FAILED");
      }
    } catch {
      setError("Couldn't reach Resoniq. Check your connection and try again.");
      setStatus("FAILED");
    }
  }, [songId, adopt]);

  // Start the analysis once for a fresh upload. The ref keeps React's
  // dev-mode double effect from firing two requests.
  useEffect(() => {
    if (initialStatus !== "UPLOADED" || started.current) return;
    started.current = true;
    void run();
  }, [initialStatus, run]);

  // While a job runs that this page isn't streaming (reload, second tab, a
  // dropped connection), poll it.
  useEffect(() => {
    if (!following || status !== "ANALYZING") return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/songs/${songId}`).catch(() => null);
      if (!res?.ok) return;
      const { song: s } = (await res.json()) as { song: SongStatus };
      if (s.status === "ANALYZING") return;
      setFollowing(false);
      adopt(s);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [following, status, songId, adopt]);

  // Drive the background scene: brighter and quicker as the analysis runs.
  const busy = status === "ANALYZING" || status === "UPLOADED";
  const progress = stage ? stageProgress(stage.index, stage.total) : 0;
  useEffect(() => {
    sceneState.energy = busy ? (stage ? 0.35 + 0.65 * progress : 0.35) : 0;
  }, [busy, stage, progress]);
  useEffect(
    () => () => {
      sceneState.energy = 0;
    },
    [],
  );

  if (busy) {
    return <AnalysisProgress stage={following ? null : stage} />;
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
