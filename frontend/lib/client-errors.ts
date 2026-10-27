/**
 * Browser error reports, so crashes users hit show up in the server logs
 * (Vercel runtime logs) instead of vanishing. Anonymous by design: a message,
 * a trimmed stack and the page path, with no query strings, user ids or
 * page content.
 */
export type ClientErrorKind = "boundary" | "error" | "rejection";
export type ClientErrorReport = { kind: ClientErrorKind; message: string; stack: string | null; path: string; digest: string | null };

const KINDS: ClientErrorKind[] = ["boundary", "error", "rejection"];
// Origins, query strings and fragments can carry tokens or ids: keep only paths.
const scrub = (s: string) => s.replace(/https?:\/\/[^/\s)]+/g, "").replace(/\?[^\s):]*/g, "").replace(/#[^\s):]*/g, "");
const text = (v: unknown, max: number) => (typeof v === "string" ? scrub(v).replace(/[\u0000-\u0008\u000b-\u001f]/g, "").slice(0, max) : "");

/** Validates a report from the browser; null if it isn't one. */
export function parseClientError(body: unknown): ClientErrorReport | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const message = text(b.message, 300).trim();
  if (!message || !KINDS.includes(b.kind as ClientErrorKind)) return null;
  const path = text(b.path, 200);
  return {
    kind: b.kind as ClientErrorKind,
    message,
    stack: text(b.stack, 2000) || null,
    path: path.startsWith("/") ? path : "/",
    digest: typeof b.digest === "string" && /^[\w-]{1,64}$/.test(b.digest) ? b.digest : null,
  };
}

/** Noise that isn't Resoniq's: browser extensions and a benign layout warning. */
export const isNoise = (message: string, stack?: string | null) =>
  /ResizeObserver loop|Script error\.?$|chrome-extension:|moz-extension:|safari-extension:/.test(`${message}\n${stack ?? ""}`);
