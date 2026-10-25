/**
 * Why an analysis didn't finish, in words a musician can act on. The message
 * is what gets stored on the song (Song.analysisError) and shown again after a
 * reload, so whether retrying can help is derived from it.
 */
export const ANALYSIS_FAILURES = {
  unavailable: "The analysis engine didn't answer. It sleeps when nobody has used it for a while and can take a minute or two to wake up.",
  interrupted: "The analysis engine stopped partway through this recording.",
  timeout: "The analysis ran past its five-minute limit.",
  engine: "The analysis engine hit an error while measuring this recording.",
  missing: "The uploaded file is missing from storage. Upload it again.",
  config: "Analysis isn't available right now.",
} as const;

// Earlier messages still stored on songs from before these were written.
const LEGACY_RETRYABLE = new Set(["Analysis failed. Try again.", "Analysis was interrupted. Try again.", "Analysis is unavailable right now. Try again shortly."]);
const RETRYABLE = new Set<string>([ANALYSIS_FAILURES.unavailable, ANALYSIS_FAILURES.interrupted, ANALYSIS_FAILURES.timeout, ANALYSIS_FAILURES.engine, ...LEGACY_RETRYABLE]);

/** Retrying is safe either way (it reuses the saved upload); this says whether it can help. */
export function isRetryable(message: string | null | undefined): boolean {
  return !message || RETRYABLE.has(message);
}

/** A next step for failures that retrying won't fix, keyed on the engine's own (generic) messages. */
export function fixFor(message: string): string | null {
  if (/longer than/i.test(message)) return "Trim it to the part you want measured, or upload a shorter take.";
  if (/too short/i.test(message)) return "Upload at least a few seconds of playing.";
  if (/decode/i.test(message)) return "Export it again as MP3, WAV or FLAC and upload that.";
  if (/too large/i.test(message)) return "Files can be up to 50 MB. An MP3 export of the same take is much smaller.";
  if (message === ANALYSIS_FAILURES.missing) return "Upload the file again; nothing else is lost.";
  return null;
}
