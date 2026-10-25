"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AnalysisProgress from "@/components/tone/AnalysisProgress";
import ToneDashboard from "@/components/tone/ToneDashboard";
import Icon from "@/components/icons/Icon";
import { Button, LinkButton } from "@/components/app/ui";
import type { AnalysisNotice, StageEvent } from "@/lib/analysis-stages";
import { ANALYSIS_FAILURES, fixFor, isRetryable } from "@/lib/analysis-errors";
import { NDJSON, readNdjson } from "@/lib/ndjson";
import { recipeFromAnalysis, type SongMeta } from "@/lib/tone-recipe";
import type { EngineAnalysis } from "@/types/engine";

const POLL_MS = 3000;
const OFFLINE = "Couldn't reach Resoniq. Check your connection and try again.";

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;

/**
 * What happened, whether the upload is safe, and what to do next. Retrying
 * reuses the stored file and the same song, so it's always safe; it's only
 * offered first when it can help.
 */
function AnalysisFailed({ title, error, onRetry }: { title: string | null; error: string; onRetry: () => void }) {
  const retryable = isRetryable(error) || error === OFFLINE;
  const missing = error === ANALYSIS_FAILURES.missing;
  const fix = fixFor(error);
  return (
    <section role="alert" aria-labelledby="analysis-failed-h" className="panel mx-auto max-w-2xl overflow-hidden">
      <div className="grille flex gap-4 border-b border-line p-5 sm:p-7">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-danger/30 bg-danger/10 text-danger">
          <Icon name="alert" size={22} />
        </span>
        <div className="min-w-0">
          <p className="label-engraved text-danger">{retryable ? "Analysis stopped" : "Can't measure this file"}</p>
          <h2 id="analysis-failed-h" className="mt-1.5 font-display text-xl font-semibold tracking-tight sm:text-2xl">
            {retryable ? "We couldn't finish this one." : "This recording needs a change first."}
          </h2>
          <p className="mt-2 text-pretty font-body text-[15px] leading-relaxed text-ink-dim">{error}</p>
        </div>
      </div>
      <dl className="grid gap-5 p-5 sm:grid-cols-2 sm:p-7">
        <div>
          <dt className="label-engraved">Your upload</dt>
          <dd className="mt-2 font-body text-sm text-ink-dim">
            <span className="block truncate text-ink">{title ?? "Untitled upload"}</span>
            {missing ? "The stored copy is gone, so it needs uploading again." : retryable ? "Saved privately. Trying again reuses it; nothing is uploaded twice." : "Saved privately in your account."}
          </dd>
        </div>
        <div>
          <dt className="label-engraved">What you can do</dt>
          <dd className="mt-2 font-body text-sm text-ink-dim">
            {fix ?? (retryable ? "Try again. If the engine was waking up, the next run is usually quick." : "Upload a different take.")}
          </dd>
        </div>
      </dl>
      <div className="flex flex-col-reverse gap-2 border-t border-line p-4 sm:flex-row sm:justify-end sm:p-5">
        <LinkButton href="/analyze" icon="upload" className="w-full sm:w-auto">Upload a different file</LinkButton>
        {retryable && !missing && (
          <Button variant="primary" icon="analyze" onClick={onRetry} className="w-full sm:w-auto">Try again</Button>
        )}
      </div>
    </section>
  );
}

type SongStatus = { status: string; analysisData: EngineAnalysis | null; analysisError: string | null };

type AnalyzeEvent =
  | StageEvent
  | AnalysisNotice
  | { type: "done"; song: { analysisData: EngineAnalysis } }
  | { type: "error"; error: string };

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
  const [stage, setStage] = useState<StageEvent | null>(null);
  const [notice, setNotice] = useState<AnalysisNotice | null>(null);
  // True when this page is polling a job rather than streaming it.
  const [following, setFollowing] = useState(initialStatus === "ANALYZING");
  const started = useRef(false);

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
    setNotice(null);
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
          else if (event.type === "notice") {
            // Waiting out a restart, then starting over: progress restarts too.
            setNotice(event);
            setStage(null);
          } else if (event.type === "done") {
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
      setError(OFFLINE);
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

  if (status === "ANALYZING" || status === "UPLOADED") {
    return <AnalysisProgress stage={following ? null : stage} notice={following ? null : notice} />;
  }

  if (status === "FAILED") {
    return <AnalysisFailed title={song.title} error={error ?? ANALYSIS_FAILURES.engine} onRetry={run} />;
  }

  if (status === "ANALYZED" && data && recipe) {
    const w = data.analysis_window;
    return (
      <>
        {w?.total_s && w.total_s > w.duration_s + 1 && (
          <p className="mx-auto mb-6 max-w-2xl text-center font-body text-xs leading-relaxed text-muted">
            Measured <span className="font-mono text-ink-dim">{clock(w.start_s)}–{clock(w.start_s + w.duration_s)}</span> of {clock(w.total_s)}, the loudest stretch of the recording. A full mix can&apos;t isolate one guitar exactly: treat this as a starting point to dial in by ear.
          </p>
        )}
        <ToneDashboard songId={songId} initialRecipe={recipe} measurements={data.raw_features} />
      </>
    );
  }

  return null;
}
