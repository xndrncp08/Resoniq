"use client";

import { useEffect, useRef, useState } from "react";
import { toLayout, type WindowStoreApi } from "@/lib/studio/window-store";

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 800;

/**
 * Saves the desktop layout after it settles. Drags and resizes reach the
 * store once, at gesture end, so this runs on drag-end / resize-end (and on
 * open, close, focus, tile...), debounced so a burst of changes is one PUT.
 *
 * Changes that don't alter the saved layout (viewport size, title-bar
 * badges) are skipped by comparing the serialized layout. A pending save is
 * flushed with `keepalive` when the page is hidden or unloaded, so closing
 * the tab right after a drag still keeps it.
 */
export function useWorkspaceAutosave(store: WindowStoreApi): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const lastSaved = useRef<string>(JSON.stringify(toLayout(store.getState())));
  const pending = useRef<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight: AbortController | null = null;

    const send = async (body: string, keepalive = false) => {
      inFlight?.abort();
      const ctrl = new AbortController();
      inFlight = ctrl;
      setStatus("saving");
      try {
        const res = await fetch("/api/workspace", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: `{"layout":${body}}`,
          keepalive,
          signal: keepalive ? undefined : ctrl.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        lastSaved.current = body;
        if (pending.current === body) pending.current = null;
        setStatus("saved");
      } catch (err) {
        if ((err as Error).name !== "AbortError") setStatus("error");
      }
    };

    const flush = (keepalive = false) => {
      if (timer) clearTimeout(timer);
      timer = null;
      if (pending.current && pending.current !== lastSaved.current) void send(pending.current, keepalive);
    };

    const unsubscribe = store.subscribe((state, prev) => {
      if (state.windows === prev.windows && state.order === prev.order && state.focusedId === prev.focusedId && state.spatial === prev.spatial) {
        return;
      }
      const body = JSON.stringify(toLayout(state));
      if (body === lastSaved.current) {
        pending.current = null;
        return;
      }
      pending.current = body;
      setStatus("pending");
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => flush(), DEBOUNCE_MS);
    });

    const onHide = () => {
      if (document.visibilityState === "hidden") flush(true);
    };
    const onPageHide = () => flush(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      flush(true);
    };
  }, [store]);

  return status;
}
