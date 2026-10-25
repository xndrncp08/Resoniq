import type { EngineAnalysis } from "@/types/engine";
import type { StageEvent } from "@/lib/analysis-stages";
import { readNdjson } from "@/lib/ndjson";
import { ANALYSIS_FAILURES } from "@/lib/analysis-errors";

/**
 * Client for python-engine. The engine is never exposed to browsers: only
 * this server calls it, authenticated with RESONIQ_ENGINE_SECRET.
 */

// Fits inside /api/analyze's 300 s limit and leaves room for a free-tier cold start.
export const ENGINE_TIMEOUT_MS = 285_000;

// Engine responses whose message is meant for the end user (all generic).
const USER_FACING_STATUSES = new Set([413, 422]);

export class EngineError extends Error {
  constructor(
    message: string,
    /** Safe to show the user. */
    readonly publicMessage: string,
    /**
     * The engine was asleep, restarting or dropped the connection before
     * answering: worth waiting for it and trying the same job again.
     */
    readonly transient = false,
  ) {
    super(message);
  }
}

/** Is the engine up? Used to wait out a cold start or a restart before retrying. */
export async function engineHealthy(timeoutMs = 10_000): Promise<boolean> {
  const url = process.env.PYTHON_ENGINE_URL ?? "http://localhost:8000";
  const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" }).catch(() => null);
  return !!res?.ok;
}

/**
 * Free-tier hosting sleeps the engine after idle time and took about 4 minutes to wake (measured
 * 262 s), most of ENGINE_TIMEOUT_MS. Pinging it when someone opens the upload page starts the
 * wake-up while they pick and upload a file. Fire-and-forget: the wake continues server-side even
 * if this request is abandoned.
 */
export async function warmEngine() {
  const url = process.env.PYTHON_ENGINE_URL;
  if (!url) return;
  await fetch(`${url}/health`, { signal: AbortSignal.timeout(10_000), cache: "no-store" }).catch(() => undefined);
}

type EngineRequest = { url: string; init: RequestInit };

function engineRequest(path: string, bytes: Buffer, filename: string, contentType: string, timeoutMs = ENGINE_TIMEOUT_MS): EngineRequest {
  const url = process.env.PYTHON_ENGINE_URL ?? "http://localhost:8000";
  const secret = process.env.RESONIQ_ENGINE_SECRET;
  if (!secret) throw new EngineError("RESONIQ_ENGINE_SECRET is not set", ANALYSIS_FAILURES.config);
  const body = new FormData();
  body.append("file", new Blob([new Uint8Array(bytes)], { type: contentType }), filename);
  return {
    url: `${url}${path}`,
    init: { method: "POST", headers: { "X-Resoniq-Engine-Key": secret }, body, signal: AbortSignal.timeout(timeoutMs) },
  };
}

async function send({ url, init }: EngineRequest): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err) {
    if (isTimeout(err)) throw new EngineError(`python-engine timed out: ${err}`, ANALYSIS_FAILURES.timeout);
    throw new EngineError(`Could not reach python-engine: ${err}`, ANALYSIS_FAILURES.unavailable, true);
  }
}

const isTimeout = (err: unknown) => err instanceof Error && (err.name === "TimeoutError" || (err.cause instanceof Error && err.cause.name === "TimeoutError"));

/**
 * An engine failure as an EngineError: user-facing statuses keep their
 * (generic) message. 502-504 come from the host while the engine boots or
 * restarts after a crash, so they're worth a wait-and-retry.
 */
export function failure(status: number, detail: unknown): EngineError {
  const message = `python-engine returned ${status}: ${JSON.stringify(detail)}`;
  if (USER_FACING_STATUSES.has(status) && typeof detail === "string") return new EngineError(message, detail);
  // The engine's own 503 (no secret configured) and 401 (secrets differ) are setup problems, not restarts.
  if (status === 401 || (status === 503 && typeof detail === "string")) return new EngineError(message, ANALYSIS_FAILURES.config);
  if (status >= 502 && status <= 504) return new EngineError(message, ANALYSIS_FAILURES.unavailable, true);
  return new EngineError(message, ANALYSIS_FAILURES.engine);
}

function checkAnalysis(payload: unknown): EngineAnalysis {
  if (!payload || typeof payload !== "object" || !("tone_profile" in payload)) {
    throw new EngineError("python-engine returned an unexpected body", ANALYSIS_FAILURES.engine);
  }
  return payload as EngineAnalysis;
}

export async function analyzeAudio(bytes: Buffer, filename: string, contentType: string, timeoutMs?: number): Promise<EngineAnalysis> {
  const res = await send(engineRequest("/analyze/file", bytes, filename, contentType, timeoutMs));
  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok) throw failure(res.status, (payload as { detail?: unknown } | null)?.detail);
  return checkAnalysis(payload);
}

type EngineEvent = StageEvent | { type: "result"; data: unknown } | { type: "error"; status: number; detail: unknown };

/**
 * Like analyzeAudio, but reads the engine's NDJSON stream and reports each
 * stage as it starts (see python-engine /analyze/file/stream).
 */
export async function analyzeAudioStream(
  bytes: Buffer,
  filename: string,
  contentType: string,
  onStage: (event: StageEvent) => void,
  timeoutMs?: number,
): Promise<EngineAnalysis> {
  const res = await send(engineRequest("/analyze/file/stream", bytes, filename, contentType, timeoutMs));
  if (!res.ok || !res.body) {
    const payload: unknown = await res.json().catch(() => null);
    throw failure(res.status, (payload as { detail?: unknown } | null)?.detail);
  }
  let result: EngineAnalysis | null = null;
  let error: EngineError | null = null;
  try {
    await readNdjson<EngineEvent>(res.body, (event) => {
      if (event.type === "stage") onStage(event);
      else if (event.type === "result") result = checkAnalysis(event.data);
      else if (event.type === "error") error = failure(event.status, event.detail);
    });
  } catch (err) {
    if (isTimeout(err)) throw new EngineError(`python-engine timed out mid-stream: ${err}`, ANALYSIS_FAILURES.timeout);
    throw new EngineError(`python-engine stream broke: ${err}`, ANALYSIS_FAILURES.interrupted, true);
  }
  if (error) throw error;
  // The engine process died mid-analysis (in production: out of memory) and the host closed the stream.
  if (!result) throw new EngineError("python-engine stream ended without a result", ANALYSIS_FAILURES.interrupted, true);
  return result;
}
