"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Icon from "@/components/icons/Icon";
import type { MediaView } from "@/lib/media/view";
import { SeekMarks, useSeekTarget } from "@/components/media/seek";

// The OS reduced-motion setting, read directly instead of through the animation library.
const reducedQuery = () => window.matchMedia("(prefers-reduced-motion: reduce)");
function subscribeReducedMotion(cb: () => void) {
  const q = reducedQuery();
  q.addEventListener("change", cb);
  return () => q.removeEventListener("change", cb);
}

const fmt = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");

/**
 * A performance player. Feeds show the muted preview loop on hover and only
 * load the full file when someone presses play. `overlay` is drawn over the
 * picture (the rig inspector uses it) and stays reachable by keyboard.
 */
export default function VideoPlayer({ media, overlay, autoPreview = true, className = "" }: { media: MediaView; overlay?: ReactNode; autoPreview?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(media.durationSec ?? 0);
  const [hover, setHover] = useState(false);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, () => reducedQuery().matches, () => null);
  const ratio = media.width && media.height ? media.width / media.height : 16 / 9;

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const on = () => setPlaying(!v.paused);
    const t = () => setTime(v.currentTime);
    const d = () => setDuration(v.duration);
    v.addEventListener("play", on);
    v.addEventListener("pause", on);
    v.addEventListener("timeupdate", t);
    v.addEventListener("loadedmetadata", d);
    return () => {
      v.removeEventListener("play", on);
      v.removeEventListener("pause", on);
      v.removeEventListener("timeupdate", t);
      v.removeEventListener("loadedmetadata", d);
    };
  }, [started]);

  function toggle() {
    if (!started) {
      setStarted(true);
      requestAnimationFrame(() => ref.current?.play().catch(() => {}));
      return;
    }
    const v = ref.current;
    if (v) void (v.paused ? v.play() : v.pause());
  }

  useSeekTarget((t) => {
    const go = () => {
      const v = ref.current;
      if (!v) return;
      v.currentTime = t;
      void v.play().catch(() => {});
    };
    if (started) go();
    else {
      setStarted(true);
      requestAnimationFrame(go);
    }
    wrap.current?.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
  });

  function onKey(e: React.KeyboardEvent) {
    if (e.target instanceof HTMLElement && e.target.closest("button, input, textarea, select, a, [contenteditable='true']")) return;
    const v = ref.current;
    if (e.key === " " || e.key === "k") {
      e.preventDefault();
      toggle();
    } else if (v && e.key === "ArrowRight") v.currentTime = Math.min(v.duration, v.currentTime + 5);
    else if (v && e.key === "ArrowLeft") v.currentTime = Math.max(0, v.currentTime - 5);
    else if (v && e.key === "m") {
      v.muted = !v.muted;
      setMuted(v.muted);
    } else if (e.key === "f") void wrap.current?.requestFullscreen?.();
  }

  return (
    <div
      ref={wrap}
      className={`group/video relative overflow-hidden rounded-[18px] bg-black ${className}`}
      style={{ aspectRatio: String(Math.max(0.56, Math.min(ratio, 2))) }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onKeyDown={onKey}
    >
      {started ? (
        <video ref={ref} src={media.src ?? undefined} poster={media.poster ?? undefined} playsInline preload="metadata" className="h-full w-full object-contain" onClick={toggle} />
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {media.poster && <img src={media.poster} alt={media.alt ?? ""} className="h-full w-full object-cover" loading="lazy" />}
          {autoPreview && reducedMotion === false && hover && media.preview && (
            <video src={media.preview} autoPlay muted loop playsInline className="pointer-events-none absolute inset-0 h-full w-full object-cover" aria-hidden />
          )}
        </>
      )}

      {!playing && (
        <button type="button" onClick={toggle} aria-label={started ? "Play" : `Play video${media.durationSec ? `, ${fmt(media.durationSec)}` : ""}`} className="focus-ring absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/50 via-transparent to-transparent">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ink/95 text-bg shadow-2xl transition-transform group-hover/video:scale-105">
            <Icon name="play" size={26} className="translate-x-0.5" />
          </span>
          {!started && media.durationSec && <span className="absolute bottom-3 right-3 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-xs text-ink">{fmt(media.durationSec)}</span>}
        </button>
      )}

      {started && (
        <div className={`absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2.5 pt-8 transition-opacity ${playing && !hover ? "opacity-0 focus-within:opacity-100" : "opacity-100"}`}>
          <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="focus-ring flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-white/10">
            <Icon name={playing ? "pause" : "play"} size={18} />
          </button>
          <span className="font-mono text-xs text-ink-dim">{fmt(time)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={time}
            onChange={(e) => {
              if (ref.current) ref.current.currentTime = Number(e.target.value);
            }}
            aria-label="Seek"
            className="h-1 flex-1 cursor-pointer accent-[var(--color-copper)]"
          />
          <span className="font-mono text-xs text-ink-dim">{fmt(duration)}</span>
          <button type="button" onClick={() => { if (ref.current) { ref.current.muted = !ref.current.muted; setMuted(ref.current.muted); } }} aria-label={muted ? "Unmute" : "Mute"} className="focus-ring flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-white/10">
            <Icon name={muted ? "mute" : "volume"} size={18} />
          </button>
          <button type="button" onClick={() => void wrap.current?.requestFullscreen?.()} aria-label="Full screen" className="focus-ring hidden h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-white/10 sm:flex">
            <Icon name="fullscreen" size={18} />
          </button>
        </div>
      )}
      {/* Where people left time-coded feedback, along the bottom edge. */}
      <SeekMarks duration={duration || media.durationSec || 0} className="!absolute inset-x-0 bottom-0 h-1" />
      {overlay}
    </div>
  );
}
