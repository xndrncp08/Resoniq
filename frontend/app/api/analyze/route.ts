import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, enforceRateLimit, readJson, requireUserId, route } from "@/lib/api";
import { analyzeAudio, analyzeAudioStream, EngineError, engineHealthy } from "@/lib/engine";
import { ANALYSIS_FAILURES } from "@/lib/analysis-errors";
import type { AnalysisNotice, StageEvent } from "@/lib/analysis-stages";
import { NDJSON } from "@/lib/ndjson";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { getStorage } from "@/lib/storage";
import { STALE_ANALYSIS_MS } from "@/lib/analysis-status";

// Analysis of a long track can take a while; don't let a platform default cut it off.
export const maxDuration = 300;

// Everything (a wait for the engine included) finishes inside maxDuration.
const BUDGET_MS = 285_000;
// A retry only starts if an analysis still has this long to run.
const MIN_ANALYSIS_MS = 75_000;
const HEALTH_POLL_MS = 5_000;

/** Polls the engine's health until it answers or `until` passes. */
async function waitForEngine(until: number): Promise<boolean> {
  while (Date.now() < until) {
    if (await engineHealthy(Math.min(10_000, Math.max(1_000, until - Date.now())))) return true;
    await new Promise((r) => setTimeout(r, HEALTH_POLL_MS));
  }
  return false;
}

type Outcome =
  | { ok: true; song: { id: string; status: string; analysisData: Prisma.JsonValue } }
  | { ok: false; error: string };

/**
 * Loads the upload, runs the engine, and saves the result, or marks the song
 * FAILED with a message that's safe to show (details are logged). Shared by
 * the JSON and streaming paths. With `onStage`, the engine's progress is
 * reported as it happens.
 */
async function runAnalysis(job: { id: string; storageKey: string }, onStage?: (event: StageEvent | AnalysisNotice) => void): Promise<Outcome> {
  const deadline = Date.now() + BUDGET_MS;
  const fail = async (detail: unknown, error: string): Promise<Outcome> => {
    console.error(`[api] analyze ${job.id} failed`, detail);
    try {
      await prisma.song.update({ where: { id: job.id }, data: { status: "FAILED", analysisError: error } });
    } catch (err) {
      // A database outage must still settle the response; stale jobs remain retryable.
      console.error(`[api] analyze ${job.id} could not save failure`, err);
    }
    return { ok: false, error };
  };

  try {
    const stored = await getStorage().get(job.storageKey);
    if (!stored) return await fail(`storage object ${job.storageKey} missing`, ANALYSIS_FAILURES.missing);

    const filename = job.storageKey.split("/").pop()!;
    const attempt = () => {
      const timeout = deadline - Date.now();
      return onStage ? analyzeAudioStream(stored.bytes, filename, stored.contentType, onStage, timeout) : analyzeAudio(stored.bytes, filename, stored.contentType, timeout);
    };
    let analysis;
    try {
      analysis = await attempt();
    } catch (err) {
      // Asleep, restarting or dropped mid-way: wait for it and run the same
      // job once more. The song row was claimed above, so this can't duplicate
      // anything, and the stored upload is reused.
      if (!(err instanceof EngineError && err.transient)) throw err;
      console.warn(`[api] analyze ${job.id}: ${err.message}; waiting for the engine to retry`);
      onStage?.({ type: "notice", code: "waking" });
      if (!(await waitForEngine(deadline - MIN_ANALYSIS_MS))) throw err;
      onStage?.({ type: "notice", code: "retrying" });
      analysis = await attempt();
    }
    const song = await prisma.song.update({
      where: { id: job.id },
      // EngineAnalysis is plain JSON from the engine; Prisma's input type can't see that.
      data: { status: "ANALYZED", analysisData: analysis as unknown as Prisma.InputJsonValue, analysisError: null },
      select: { id: true, status: true, analysisData: true },
    });
    return { ok: true, song };
  } catch (err) {
    return fail(err, err instanceof EngineError ? err.publicMessage : ANALYSIS_FAILURES.engine);
  }
}

export const POST = route("analyze", async (req) => {
  const userId = await requireUserId(undefined, { write: true });
  await enforceRateLimit("analyze", userId, RATE_LIMITS.analyze);

  const { songId } = await readJson(req);
  if (typeof songId !== "string" || !songId) throw new ApiError(400, "songId is required.");

  const song = await prisma.song.findFirst({ where: { id: songId, userId } });
  if (!song) throw new ApiError(404, "Song not found.");
  if (!song.storageKey) throw new ApiError(409, "This upload predates private storage. Upload it again to analyze it.");

  // Claim the job atomically, so a double click or a second tab can't start
  // a second analysis of the same song. FAILED and abandoned jobs can be retried.
  const { count } = await prisma.song.updateMany({
    where: {
      id: song.id,
      userId,
      OR: [
        { status: { in: ["UPLOADED", "FAILED"] } },
        { status: "ANALYZING", analysisStartedAt: { lt: new Date(Date.now() - STALE_ANALYSIS_MS) } },
        { status: "ANALYZING", analysisStartedAt: null },
      ],
    },
    data: { status: "ANALYZING", analysisError: null, analysisStartedAt: new Date() },
  });
  if (count === 0) throw new ApiError(409, "This song is already being analyzed or is done.");

  const job = { id: song.id, storageKey: song.storageKey };

  // Streaming: the browser asked for progress. Relay stages as NDJSON, then
  // the saved song (or a safe error) once the result is persisted.
  if (req.headers.get("accept")?.includes(NDJSON)) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        // If the browser goes away, enqueue throws; swallow it so the analysis
        // still finishes and is saved (the client falls back to polling).
        let open = true;
        const send = (event: unknown) => {
          if (!open) return;
          try {
            controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
          } catch {
            open = false;
          }
        };
        const outcome = await runAnalysis(job, send);
        send(outcome.ok ? { type: "done", song: outcome.song } : { type: "error", error: outcome.error });
        if (open) controller.close();
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": NDJSON, "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
    });
  }

  const outcome = await runAnalysis(job);
  return outcome.ok ? NextResponse.json({ song: outcome.song }) : NextResponse.json({ error: outcome.error }, { status: 502 });
});
