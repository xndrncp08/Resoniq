import { ANALYSIS_FAILURES } from "@/lib/analysis-errors";

// Longer than the engine timeout and the hosting request limit.
export const STALE_ANALYSIS_MS = 10 * 60_000;

type AnalysisStatus = { status: string; analysisStartedAt: Date | null; analysisError: string | null };

/** Expose abandoned jobs as retryable without changing a job that may have just finished. */
export function recoverAnalysisStatus<T extends AnalysisStatus>(song: T) {
  if (
    song.status === "ANALYZING" &&
    (!song.analysisStartedAt || song.analysisStartedAt.getTime() < Date.now() - STALE_ANALYSIS_MS)
  ) {
    return { ...song, status: "FAILED" as const, analysisError: ANALYSIS_FAILURES.interrupted };
  }
  return song;
}
