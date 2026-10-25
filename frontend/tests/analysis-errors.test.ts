import { describe, expect, it } from "vitest";
import { ANALYSIS_FAILURES, fixFor, isRetryable } from "@/lib/analysis-errors";
import { failure } from "@/lib/engine";

describe("engine failure classification", () => {
  it("treats host 502-504 (boot, restart after a crash) as transient", () => {
    for (const status of [502, 503, 504]) {
      const err = failure(status, undefined);
      expect(err.transient).toBe(true);
      expect(err.publicMessage).toBe(ANALYSIS_FAILURES.unavailable);
    }
  });

  it("keeps the engine's own user-facing messages and doesn't retry them", () => {
    const err = failure(413, "Audio is longer than 30 minutes.");
    expect([err.publicMessage, err.transient]).toEqual(["Audio is longer than 30 minutes.", false]);
  });

  it("reports setup problems (missing or mismatched secret) as such, not as restarts", () => {
    expect(failure(503, "Analysis engine is not configured.").publicMessage).toBe(ANALYSIS_FAILURES.config);
    expect(failure(401, "Unauthorized.").transient).toBe(false);
  });

  it("never leaks engine internals for unexpected statuses", () => {
    expect(failure(500, "Traceback at /app/main.py").publicMessage).toBe(ANALYSIS_FAILURES.engine);
  });
});

describe("what a failure lets the musician do", () => {
  it("offers a retry for transient failures, including messages stored before this release", () => {
    expect(isRetryable(ANALYSIS_FAILURES.interrupted)).toBe(true);
    expect(isRetryable("Analysis failed. Try again.")).toBe(true);
    expect(isRetryable("Could not decode audio file.")).toBe(false);
  });

  it("suggests a concrete fix when retrying won't help", () => {
    expect(fixFor("Audio is longer than 30 minutes.")).toMatch(/shorter/);
    expect(fixFor("Could not decode audio file.")).toMatch(/MP3, WAV or FLAC/);
    expect(fixFor(ANALYSIS_FAILURES.engine)).toBeNull();
  });
});
