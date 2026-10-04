import type { EngineAnalysis } from "@/types/engine";

/**
 * Client for python-engine. The engine is never exposed to browsers: only
 * this server calls it, authenticated with RESONIQ_ENGINE_SECRET.
 */

const ENGINE_TIMEOUT_MS = 180_000;

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

export async function analyzeAudio(bytes: Buffer, filename: string, contentType: string): Promise<EngineAnalysis> {
  const url = process.env.PYTHON_ENGINE_URL ?? "http://localhost:8000";
  const secret = process.env.RESONIQ_ENGINE_SECRET;
  if (!secret) throw new EngineError("RESONIQ_ENGINE_SECRET is not set", "Analysis is unavailable right now.");

  const body = new FormData();
  body.append("file", new Blob([new Uint8Array(bytes)], { type: contentType }), filename);

  let res: Response;
  try {
    res = await fetch(`${url}/analyze/file`, {
      method: "POST",
      headers: { "X-Resoniq-Engine-Key": secret },
      body,
      signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS),
    });
  } catch (err) {
    throw new EngineError(`Could not reach python-engine: ${err}`, "Analysis is unavailable right now. Try again shortly.");
  }

  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = (payload as { detail?: unknown } | null)?.detail;
    const publicMessage =
      USER_FACING_STATUSES.has(res.status) && typeof detail === "string" ? detail : "Analysis failed. Try again.";
    throw new EngineError(`python-engine returned ${res.status}: ${JSON.stringify(detail)}`, publicMessage);
  }
  if (!payload || typeof payload !== "object" || !("tone_profile" in payload)) {
    throw new EngineError("python-engine returned an unexpected body", "Analysis failed. Try again.");
  }
  return payload as EngineAnalysis;
}
