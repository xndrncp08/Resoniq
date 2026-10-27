"use client";

import { useEffect } from "react";
import { isNoise, type ClientErrorKind } from "@/lib/client-errors";

const sent = new Set<string>();
const MAX_PER_PAGE_LOAD = 10;

/** Sends one anonymous report per distinct error (lib/client-errors.ts). Never throws. */
export function reportClientError(kind: ClientErrorKind, error: unknown, digest?: string) {
  try {
    const e = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Non-error thrown");
    if (isNoise(e.message, e.stack) || sent.size >= MAX_PER_PAGE_LOAD || sent.has(e.message)) return;
    sent.add(e.message);
    void fetch("/api/client-errors", {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, message: e.message, stack: e.stack?.slice(0, 2000) ?? null, path: location.pathname, digest: digest ?? null }),
    }).catch(() => {});
  } catch { /* reporting must never cause an error of its own */ }
}

/** Catches errors no boundary sees: event handlers, timers and unhandled promises. */
export default function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => reportClientError("error", e.error ?? e.message);
    const onRejection = (e: PromiseRejectionEvent) => reportClientError("rejection", e.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
