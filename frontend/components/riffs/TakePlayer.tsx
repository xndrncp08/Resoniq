"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { IconButton } from "@/components/app/ui";
import type { RiffTakeView } from "@/lib/riffs/service";
import { canPlay } from "@/lib/riffs/peaks";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** The waveform (from stored peaks) doubles as the seek bar; flat bars when there are none. */
export function Waveform({ peaks, progress, onSeek, label }: { peaks: number[] | null; progress: number; onSeek?: (fraction: number) => void; label: string }) {
  const bars = peaks?.length ? peaks : Array.from({ length: 60 }, () => 0.15);
  const seek = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onSeek?.(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
  };
  const key = (e: KeyboardEvent) => {
    const d = e.key === "ArrowRight" ? 0.05 : e.key === "ArrowLeft" ? -0.05 : 0;
    if (!d) return;
    e.preventDefault();
    onSeek?.(Math.max(0, Math.min(1, progress + d)));
  };
  return (
    <div
      role="slider"
      tabIndex={onSeek ? 0 : -1}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      onPointerDown={onSeek ? seek : undefined}
      onKeyDown={onSeek ? key : undefined}
      className="focus-ring flex h-12 min-w-0 flex-1 cursor-pointer items-center gap-[2px] rounded"
    >
      {bars.map((v, i) => (
        <span key={i} aria-hidden className={`min-w-px flex-1 rounded-full ${i / bars.length <= progress ? "bg-copper" : "bg-line-strong"}`} style={{ height: `${Math.max(8, v * 100)}%` }} />
      ))}
    </div>
  );
}

export default function TakePlayer({ take, title }: { take: RiffTakeView; title: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(take.durationSec ?? 0);
  const [unplayable, setUnplayable] = useState(false);
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const tick = () => setTime(a.currentTime);
    const stop = () => setPlaying(false);
    const play = () => setPlaying(true);
    const meta = () => Number.isFinite(a.duration) && setDuration(a.duration);
    const failed = () => a.error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED && setUnplayable(true);
    if (!canPlay(take.mime, (t) => a.canPlayType(t))) setUnplayable(true);
    const events: [string, () => void][] = [["timeupdate", tick], ["ended", stop], ["pause", stop], ["play", play], ["loadedmetadata", meta], ["error", failed]];
    for (const [e, f] of events) a.addEventListener(e, f);
    return () => { for (const [e, f] of events) a.removeEventListener(e, f); };
  }, [take.mime]);
  const toggle = () => (playing ? audio.current?.pause() : void audio.current?.play().catch(() => setPlaying(false)));
  if (unplayable) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <audio ref={audio} src={take.src} preload="none" />
        <p className="min-w-0 flex-1 font-body text-xs text-amber">This browser can&apos;t play {take.mime.replace("audio/", "").toUpperCase()} recordings. <a href={take.src} download className="underline">Download the take</a> or open it on another device.</p>
      </div>
    );
  }
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <audio ref={audio} src={take.src} preload="none" />
      <IconButton icon={playing ? "pause" : "play"} label={`${playing ? "Pause" : "Play"} ${title}`} onClick={toggle} size={40} />
      <Waveform peaks={take.peaks} progress={duration ? time / duration : 0} onSeek={(f) => { if (audio.current && duration) audio.current.currentTime = f * duration; }} label={`Position in ${title}`} />
      <span className="w-12 shrink-0 text-right font-mono text-xs tabular-nums text-muted">{fmt(playing || time ? time : duration)}</span>
    </div>
  );
}

/**
 * A/B two takes: both play in step, you hear one at a time; switching keeps
 * the position, so changes between takes are easy to hear.
 */
export function TakeCompare({ a, b }: { a: RiffTakeView; b: RiffTakeView }) {
  const refs = [useRef<HTMLAudioElement>(null), useRef<HTMLAudioElement>(null)];
  const [side, setSide] = useState<0 | 1>(0);
  const [playing, setPlaying] = useState(false);
  const takes = [a, b];
  useEffect(() => {
    refs.forEach((r, i) => r.current && (r.current.muted = i !== side));
    // Keep the silent one aligned with what you're hearing.
    const [on, off] = side === 0 ? [refs[0].current, refs[1].current] : [refs[1].current, refs[0].current];
    if (on && off && Math.abs(on.currentTime - off.currentTime) > 0.05) off.currentTime = on.currentTime;
  }, [side]); // eslint-disable-line react-hooks/exhaustive-deps -- refs are stable
  function toggle() {
    const [x, y] = refs.map((r) => r.current);
    if (!x || !y) return;
    if (playing) { x.pause(); y.pause(); setPlaying(false); return; }
    y.currentTime = x.currentTime;
    void Promise.all([x.play(), y.play()]).then(() => setPlaying(true)).catch(() => setPlaying(false));
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-copper/30 bg-copper/5 p-3">
      {takes.map((t, i) => <audio key={t.id} ref={refs[i]} src={t.src} preload="auto" onEnded={() => setPlaying(false)} />)}
      <IconButton icon={playing ? "pause" : "play"} label={playing ? "Pause comparison" : "Play comparison"} onClick={toggle} size={40} />
      <div role="radiogroup" aria-label="Which take you hear" className="flex overflow-hidden rounded-full border border-line-strong">
        {takes.map((t, i) => (
          <button key={t.id} type="button" role="radio" aria-checked={side === i} onClick={() => setSide(i as 0 | 1)} className={`focus-ring h-9 px-4 font-mono text-sm ${side === i ? "bg-copper text-bg" : "text-muted hover:text-ink"}`}>
            {i === 0 ? "A" : "B"} · {t.label ?? `Take from ${new Date(t.createdAt).toLocaleDateString()}`}
          </button>
        ))}
      </div>
      <p className="basis-full font-body text-xs text-muted">Both play together; switch to hear the same moment in the other take. They line up best when both start on the downbeat.</p>
    </div>
  );
}
