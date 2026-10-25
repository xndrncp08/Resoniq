"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/app/ui";
import Icon from "@/components/icons/Icon";
import { validLoop } from "@/lib/practice";

const time = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;

export default function LoopPlayer() {
  const audio = useRef<HTMLAudioElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  const [loop, setLoop] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [error, setError] = useState("");
  const canLoop = validLoop(a, b, duration);

  useEffect(() => {
    const player = audio.current;
    return () => { player?.pause(); if (url) URL.revokeObjectURL(url); };
  }, [url]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let lastReadout = 0;
    const update = (now: number) => {
      const player = audio.current;
      if (player) {
        if (loop && canLoop && (player.currentTime >= b || player.currentTime < a)) player.currentTime = a;
        if (now - lastReadout >= 100) { setPosition(player.currentTime); lastReadout = now; }
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    const hide = () => { if (document.hidden) audio.current?.pause(); };
    document.addEventListener("visibilitychange", hide);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", hide); };
  }, [playing, loop, canLoop, a, b]);

  async function play() {
    const player = audio.current;
    if (!player) return;
    if (!player.paused) { player.pause(); return; }
    if (loop && canLoop && (player.currentTime < a || player.currentTime >= b)) player.currentTime = a;
    try { await player.play(); setError(""); } catch { setError("This file could not play. Try a browser-supported MP3, WAV or M4A file."); }
  }

  function choose(next: File | undefined) {
    if (!next) return;
    if (next.size > 100 * 1024 * 1024) { setError("Choose an audio file under 100 MB."); return; }
    audio.current?.pause();
    setFile(next); setUrl(URL.createObjectURL(next)); setDuration(0); setPosition(0); setA(0); setB(0); setLoop(false); setRate(1); setError("");
  }

  return (
    <section aria-labelledby="loop-h" className="panel flex flex-col p-5 sm:p-7">
      <div className="flex items-baseline justify-between gap-3"><h2 id="loop-h" className="font-display text-2xl font-semibold">Stay with the hard part.</h2><span className="label-engraved">02 / Repeat</span></div>
      <p className="mt-2 text-sm text-muted">Bring a recording. Isolate a phrase. Learn it by ear.</p>
      <label className="panel-inset relative my-6 flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-dashed p-5 text-center focus-within:outline-2 focus-within:outline-signal">
        <Icon name="audio" size={28} className="text-copper" /><span className="max-w-full break-all font-body text-sm">{file?.name ?? "Choose an audio file"}</span><span className="text-xs text-muted">MP3, WAV, M4A · up to 100 MB · stays on your device</span>
        <input aria-label="Choose practice audio" type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac" className="absolute inset-0 w-full cursor-pointer opacity-0" onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      <audio key={url} ref={audio} src={url || undefined} preload="metadata" onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) { setDuration(d); setB(d); } else setError("This file has no usable duration. Try a different recording."); }} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { if (loop && canLoop && audio.current) { audio.current.currentTime = a; void play(); } else setPlaying(false); }} onError={() => { if (url) setError("This browser could not read that audio format. Try MP3 or WAV."); }} />
      <div className="flex justify-between font-mono text-sm tabular-nums text-ink-dim"><span>{time(position)}</span><span>{time(duration)}</span></div>
      <label className="my-3"><span className="sr-only">Recording position</span><input type="range" min="0" max={duration || 1} step="0.01" value={position} disabled={!duration} onChange={(e) => { if (audio.current) { const p = Number(e.target.value); audio.current.currentTime = p; setPosition(p); } }} className="h-6 w-full accent-copper" /></label>
      <div className="grid grid-cols-2 gap-3">
        <Button disabled={!duration} onClick={() => { setA(audio.current?.currentTime ?? 0); setLoop(false); }}>Set A · {time(a)}</Button>
        <Button disabled={!duration} onClick={() => { setB(audio.current?.currentTime ?? 0); setLoop(false); }}>Set B · {time(b)}</Button>
      </div>
      <div className="my-5 flex flex-wrap items-center justify-between gap-3">
        <Button disabled={!canLoop} aria-pressed={loop} variant={loop ? "signal" : "secondary"} onClick={() => setLoop(!loop)}>A–B loop {loop ? "on" : "off"}</Button>
        <label className="text-sm text-muted">Speed<select value={rate} disabled={!duration} onChange={(e) => { const value = Number(e.target.value); setRate(value); if (audio.current) { audio.current.preservesPitch = true; audio.current.playbackRate = value; } }} className="panel-inset ml-2 h-11 rounded-xl px-3 text-ink">{[0.5, 0.65, 0.75, 0.85, 1, 1.25].map((r) => <option key={r} value={r}>{Math.round(r * 100)}%</option>)}</select></label>
      </div>
      <Button size="lg" variant="primary" icon={playing ? "pause" : "play"} disabled={!duration} onClick={() => void play()}>{playing ? "Pause recording" : "Play recording"}</Button>
      <p className="mt-3 text-xs text-muted">A and B need at least 0.25 seconds between them. Pitch-preserving slowdown depends on your browser; loop seams may be audible.</p>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    </section>
  );
}
