"use client";

import { useEffect, useRef, useState } from "react";
import type WaveSurfer from "wavesurfer.js";
import { Pause, Play } from "lucide-react";
import { colors } from "@/lib/design-tokens";

function formatTime(sec: number) {
  if (!Number.isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Reusable waveform + transport. `src` is a remote URL or a local File
 * (e.g. an upload preview). Waveform/live-audio visuals use signal-teal
 * only, per the design system — copper stays reserved for gear and CTAs.
 */
export default function WaveformPlayer({
  src,
  height = 64,
  className = "",
}: {
  src: string | File;
  height?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setReady(false);
    setPlaying(false);
    setTime(0);
    setError(null);

    (async () => {
      const WaveSurferLib = (await import("wavesurfer.js")).default;
      if (cancelled || !containerRef.current) return;

      const url = typeof src === "string" ? src : (objectUrl = URL.createObjectURL(src));
      const ws = WaveSurferLib.create({
        container: containerRef.current,
        height,
        waveColor: "rgba(55, 230, 201, 0.35)",
        progressColor: colors.signalTeal,
        cursorColor: colors.signalTeal,
        cursorWidth: 1,
        barWidth: 2,
        barGap: 2,
        barRadius: 2,
        normalize: true,
      });
      wsRef.current = ws;

      ws.on("ready", (d) => {
        setDuration(d);
        setReady(true);
      });
      ws.on("timeupdate", setTime);
      ws.on("play", () => setPlaying(true));
      ws.on("pause", () => setPlaying(false));
      ws.on("finish", () => setPlaying(false));
      ws.on("error", () => setError("Couldn't load this audio."));

      ws.load(url).catch(() => {
        if (!cancelled) setError("Couldn't load this audio.");
      });
    })();

    return () => {
      cancelled = true;
      wsRef.current?.destroy();
      wsRef.current = null;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, height]);

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <button
        type="button"
        onClick={() => wsRef.current?.playPause()}
        disabled={!ready}
        aria-label={playing ? "Pause" : "Play"}
        className="focus-ring flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-signal/40 text-signal transition hover:bg-signal/10 disabled:opacity-40"
      >
        {playing ? <Pause size={16} /> : <Play size={16} className="translate-x-px" />}
      </button>

      <div className="min-w-0 flex-1">
        <div ref={containerRef} className="w-full" style={{ minHeight: height }} />
        {error && <p className="mt-1 font-body text-xs text-danger">{error}</p>}
      </div>

      <span className="w-20 flex-shrink-0 text-right font-mono text-[11px] tabular-nums text-muted">
        {formatTime(time)} / {formatTime(duration)}
      </span>
    </div>
  );
}
