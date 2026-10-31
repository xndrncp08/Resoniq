"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Spinner } from "@/components/app/ui";
import { api, errorMessage } from "@/lib/client-api";

/**
 * Keyset-paginated list: renders the server's first page, then fetches the
 * next as the sentinel scrolls into view (with a button as a fallback).
 */
export default function InfiniteList<T extends { id: string }>({
  endpoint,
  initial,
  initialCursor,
  render,
  empty,
  className = "space-y-4",
}: {
  endpoint: string;
  initial: T[];
  initialCursor: string | null;
  render: (item: T) => ReactNode;
  empty?: ReactNode;
  className?: string;
}) {
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  // A new endpoint (another filter, tab or sort) is a new list: start from the server's new first page.
  const [shownFor, setShownFor] = useState(endpoint);
  if (shownFor !== endpoint) {
    setShownFor(endpoint);
    setItems(initial);
    setCursor(initialCursor);
  }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  const more = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    setError(null);
    try {
      const sep = endpoint.includes("?") ? "&" : "?";
      const page = await api<{ items: T[]; nextCursor: string | null }>(`${endpoint}${sep}cursor=${encodeURIComponent(cursor)}`);
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.items.filter((p) => !seen.has(p.id))];
      });
      setCursor(page.nextCursor);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [cursor, endpoint, loading]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && void more(), { rootMargin: "800px" });
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, more]);

  if (!items.length && empty) return <>{empty}</>;
  return (
    <>
      <div className={className}>{items.map((item) => <div key={item.id}>{render(item)}</div>)}</div>
      <div ref={sentinel} className="flex justify-center py-6" aria-live="polite">
        {loading && <Spinner className="text-muted" />}
        {error && (
          <div className="flex items-center gap-3 font-body text-sm text-danger">
            {error} <Button size="sm" onClick={() => void more()}>Retry</Button>
          </div>
        )}
        {!loading && !error && cursor && <Button size="sm" variant="ghost" onClick={() => void more()}>Load more</Button>}
        {!cursor && items.length > 5 && <p className="label-engraved">End of the line</p>}
      </div>
    </>
  );
}
