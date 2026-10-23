import type { EngineAnalysis } from "@/types/engine";
import type { StageEvent } from "@/lib/analysis-stages";
import { readNdjson } from "@/lib/ndjson";

/**
 * Client for python-engine. The engine is never exposed to browsers: only
 * this server calls it, authenticated with RESONIQ_ENGINE_SECRET.
 */

// Fits inside /api/analyze's 300 s limit and leaves room for a free-tier cold start (~262 s measured).
const ENGINE_TIMEOUT_MS = 285_000;

// Engine responses whose message is meant for the end user (all generic).
const USER_FACING_STATUSES = new Set([413, 422]);

export class EngineError extends Error {
  constructor(
    message: string,
    /** Safe to show the user. */
    readonly publicMessage: string,
  ) {
    super(message);
  }
}

/**
 * Free-tier hosting sleeps the engine after idle time and takes about 4 minutes to wake (measured
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

function engineRequest(path: string, bytes: Buffer, filename: string, contentType: string): EngineRequest {
  const url = process.env.PYTHON_ENGINE_URL ?? "http://localhost:8000";
  const secret = process.env.RESONIQ_ENGINE_SECRET;
  if (!secret) throw new EngineError("RESONIQ_ENGINE_SECRET is not set", "Analysis is unavailable right now.");
  const body = new FormData();
  body.append("file", new Blob([new Uint8Array(bytes)], { type: contentType }), filename);
  return {
    url: `${url}${path}`,
    init: { method: "POST", headers: { "X-Resoniq-Engine-Key": secret }, body, signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS) },
  };
}

async function send({ url, init }: EngineRequest): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err) {
    throw new EngineError(`Could not reach python-engine: ${err}`, "Analysis is unavailable right now. Try again shortly.");
  }
}

/** An engine failure as an EngineError: user-facing statuses keep their (generic) message. */
function failure(status: number, detail: unknown): EngineError {
  const publicMessage = USER_FACING_STATUSES.has(status) && typeof detail === "string" ? detail : "Analysis failed. Try again.";
  return new EngineError(`python-engine returned ${status}: ${JSON.stringify(detail)}`, publicMessage);
}

function checkAnalysis(payload: unknown): EngineAnalysis {
  if (!payload || typeof payload !== "object" || !("tone_profile" in payload)) {
    throw new EngineError("python-engine returned an unexpected body", "Analysis failed. Try again.");
  }
  return payload as EngineAnalysis;
}

export async function analyzeAudio(bytes: Buffer, filename: string, contentType: string): Promise<EngineAnalysis> {
  const res = await send(engineRequest("/analyze/file", bytes, filename, contentType));
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
): Promise<EngineAnalysis> {
  const res = await send(engineRequest("/analyze/file/stream", bytes, filename, contentType));
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
    throw new EngineError(`python-engine stream broke: ${err}`, "Analysis was interrupted. Try again.");
  }
  if (error) throw error;
  if (!result) throw new EngineError("python-engine stream ended without a result", "Analysis was interrupted. Try again.");
  return result;
}
