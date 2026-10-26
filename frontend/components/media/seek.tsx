"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/**
 * Time-coded feedback: "the bend at 1:24" in a post or comment becomes a
 * button that plays the post's video or audio from 1:24. The first player
 * inside the provider takes the seeks; without one, timestamps stay text.
 */
type Seek = {
  available: boolean;
  seek: (seconds: number) => void;
  register: (fn: (seconds: number) => void) => () => void;
  /** Every moment someone referred to, so players can mark them on their timeline. */
  marks: number[];
  mark: (seconds: number) => () => void;
};
const SeekContext = createContext<Seek | null>(null);

export function SeekProvider({ children }: { children: ReactNode }) {
  const parent = useContext(SeekContext);
  const target = useRef<((s: number) => void) | null>(null);
  const [available, setAvailable] = useState(false);
  const register = useCallback((fn: (s: number) => void) => {
    if (target.current) return () => {};
    target.current = fn;
    setAvailable(true);
    return () => {
      if (target.current !== fn) return;
      target.current = null;
      setAvailable(false);
    };
  }, []);
  const seek = useCallback((s: number) => target.current?.(s), []);
  const [marks, setMarks] = useState<number[]>([]);
  const mark = useCallback((s: number) => {
    setMarks((m) => [...m, s]);
    return () => setMarks((m) => { const i = m.indexOf(s); return i < 0 ? m : [...m.slice(0, i), ...m.slice(i + 1)]; });
  }, []);
  const value = useMemo(() => ({ available, seek, register, marks, mark }), [available, seek, register, marks, mark]);
  // A post card inside a post page shares the page's provider, so comments reach the card's player.
  if (parent) return children;
  return <SeekContext.Provider value={value}>{children}</SeekContext.Provider>;
}

/** Players call this with how to jump to a time. */
export function useSeekTarget(fn: (seconds: number) => void) {
  const register = useContext(SeekContext)?.register;
  const latest = useRef(fn);
  useEffect(() => {
    latest.current = fn;
  });
  useEffect(() => register?.((s) => latest.current(s)), [register]);
}

export const formatTime = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(Math.floor(s % 60)).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

/** The moments mentioned around a player, deduplicated. */
export function useSeekMarks() {
  const marks = useContext(SeekContext)?.marks ?? [];
  return [...new Set(marks)];
}

/** Ticks along a player's timeline at each moment mentioned in the post or its comments. */
export function SeekMarks({ duration, className = "" }: { duration: number; className?: string }) {
  const ctx = useContext(SeekContext);
  const marks = useSeekMarks().filter((s) => s <= duration);
  if (!ctx || !duration || !marks.length) return null;
  return (
    <div className={`pointer-events-none relative ${className}`} aria-hidden>
      {marks.map((s) => (
        <span key={s} className="absolute top-0 h-full w-0.5 -translate-x-1/2 rounded-full bg-copper shadow-[0_0_6px_var(--color-copper)]" style={{ left: `${(s / duration) * 100}%` }} title={`Feedback at ${formatTime(s)}`} />
      ))}
    </div>
  );
}

export function TimeLink({ seconds, label }: { seconds: number; label: string }) {
  const ctx = useContext(SeekContext);
  const mark = ctx?.mark;
  useEffect(() => mark?.(seconds), [mark, seconds]);
  if (!ctx?.available) return <>{label}</>;
  return (
    <button type="button" onClick={() => ctx.seek(seconds)} aria-label={`Play from ${formatTime(seconds)}`} className="focus-ring inline-flex items-baseline rounded-md bg-signal/12 px-1 font-mono text-[0.92em] text-signal hover:bg-signal/20">
      {label}
    </button>
  );
}
