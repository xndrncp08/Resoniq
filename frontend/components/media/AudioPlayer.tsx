"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/icons/Icon";
import type { MediaView } from "@/lib/media/view";
import { SeekMarks, useSeekTarget } from "@/components/media/seek";

/** An audio clip drawn as its real waveform (peaks computed by the worker); click the waveform to seek. */
export default function AudioPlayer({ media, title }: { media: MediaView; title?: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!media.peaks) return;
    const ctrl = new AbortController();
    fetch(media.peaks, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((p: number[] | null) => p && setPeaks(p.filter((_, i) => i % 4 === 0)))
      .catch(() => {});
    return () => ctrl.abort();
  }, [media.peaks]);

  useSeekTarget((t) => {
    const a = ref.current;
    if (!a) return;
    a.currentTime = t;
    void a.play().catch(() => {});
    a.parentElement?.scrollIntoView({ block: "nearest" });
  });

  const toggle = () => {
    const a = ref.current;
    if (a) void (a.paused ? a.play() : a.pause());
  };
  const bars = peaks ?? Array.from({ length: 200 }, () => 0.08);

  return (
    <div className="panel-inset flex items-center gap-3 rounded-[18px] p-3">
      <audio ref={ref} src={media.src ?? undefined} preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime / (e.currentTarget.duration || 1))} />
      <button type="button" onClick={toggle} aria-label={playing ? "Pause" : `Play${title ? ` ${title}` : " audio"}`} className="focus-ring flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-signal text-bg">
        <Icon name={playing ? "pause" : "play"} size={20} />
      </button>
      <div className="relative min-w-0 flex-1">
        <SeekMarks duration={media.durationSec ?? 0} className="!absolute inset-x-0 -top-1 h-2" />
        <svg
          viewBox={`0 0 ${bars.length} 40`}
          preserveAspectRatio="none"
          className="h-12 w-full cursor-pointer"
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          tabIndex={0}
          onKeyDown={(e) => {
            const a = ref.current;
            if (!a) return;
            if (e.key === "ArrowRight") a.currentTime += 5;
            if (e.key === "ArrowLeft") a.currentTime -= 5;
          }}
          onClick={(e) => {
            const a = ref.current;
            const box = e.currentTarget.getBoundingClientRect();
            if (a && a.duration) a.currentTime = ((e.clientX - box.left) / box.width) * a.duration;
          }}
        >
          {bars.map((v, i) => {
            const h = Math.max(1.5, v * 38);
            return <rect key={i} x={i + 0.15} y={20 - h / 2} width={0.7} height={h} fill={i / bars.length <= progress ? "var(--color-signal)" : "var(--color-line-strong)"} />;
          })}
        </svg>
      </div>
    </div>
  );
}
