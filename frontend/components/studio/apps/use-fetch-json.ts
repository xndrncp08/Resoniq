"use client";

import { useCallback, useEffect, useState } from "react";
import { onDataChanged } from "@/lib/studio/events";

type State<T> = { data: T | null; error: string | null; loading: boolean };

/** GETs JSON for a window, and refetches when user data changes elsewhere in the Studio. */
export function useFetchJson<T>(url: string | null, { refetchOnDataChange = false } = {}) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: !!url });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!url) return;
    const ctrl = new AbortController();
    fetch(url, { signal: ctrl.signal })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Couldn't load this.");
        setState({ data: body as T, error: null, loading: false });
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") setState((s) => ({ ...s, error: err.message, loading: false }));
      });
    return () => ctrl.abort();
  }, [url, version]);

  useEffect(() => (refetchOnDataChange ? onDataChanged(reload) : undefined), [refetchOnDataChange, reload]);

  return { ...state, reload };
}
