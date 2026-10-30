"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/app/ui";
import { computePeaks, recorderMime } from "@/lib/riffs/peaks";
import type { TakeUpload } from "@/lib/queries/riffs";

const MAX_SECONDS = 600;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Duration and waveform for a recording or file; null fields if this browser can't decode it. */
async function describe(blob: Blob): Promise<Pick<TakeUpload, "durationSec" | "peaks">> {
  try {
    const ctx = new AudioContext();
    const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
    void ctx.close();
    return { durationSec: Math.round(audio.duration * 10) / 10, peaks: computePeaks(audio.getChannelData(0)) };
  } catch {
    return { durationSec: null, peaks: null };
  }
}

/**
 * Records a take from the mic or an interface (browser processing off, so the
 * guitar isn't "cleaned up"), or takes a file. Hands back a blob ready to upload.
 */
export default function Recorder({ onTake, busy }: { onTake: (take: TakeUpload) => void; busy: boolean }) {
  const [state, setState] = useState<"idle" | "recording" | "review">("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<{ blob: Blob; url: string } | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const meter = useRef<HTMLSpanElement>(null);
  const cleanup = useRef<() => void>(() => {});

  useEffect(() => () => { cleanup.current(); if (review) URL.revokeObjectURL(review.url); }, [review]);

  async function start() {
    setError(null);
    const mime = typeof MediaRecorder === "undefined" ? null : recorderMime((t) => MediaRecorder.isTypeSupported(t));
    if (!mime) return setError("This browser can't record audio. Upload a file instead.");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (err) {
      return setError(err instanceof Error && err.name === "NotAllowedError" ? "Microphone access was refused. Allow it in the site settings to record." : "No microphone or audio interface was found.");
    }
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream.current, { mimeType: mime });
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: mime.split(";")[0] });
      setReview({ blob, url: URL.createObjectURL(blob) });
      setState("review");
    };
    // Input level, drawn straight to the DOM.
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream.current).connect(analyser);
    const buf = new Float32Array(1024);
    let raf = 0;
    const draw = () => {
      analyser.getFloatTimeDomainData(buf);
      let peak = 0;
      for (const v of buf) peak = Math.max(peak, Math.abs(v));
      if (meter.current) {
        meter.current.style.transform = `scaleX(${Math.min(1, peak)})`;
        meter.current.style.background = peak > 0.98 ? "var(--color-danger)" : "var(--color-signal)";
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    const began = performance.now();
    const timer = setInterval(() => {
      const s = (performance.now() - began) / 1000;
      setSeconds(s);
      if (s >= MAX_SECONDS) stop();
    }, 250);
    cleanup.current = () => {
      cancelAnimationFrame(raf);
      clearInterval(timer);
      void ctx.close();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
    rec.start(1000);
    recorder.current = rec;
    setSeconds(0);
    setState("recording");
  }
  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
    cleanup.current();
  }
  async function keep(blob: Blob) {
    onTake({ blob, ...(await describe(blob)) });
    discard();
  }
  function discard() {
    if (review) URL.revokeObjectURL(review.url);
    setReview(null);
    setState("idle");
  }

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface/50 p-4">
      {state === "recording" ? (
        <div className="flex flex-wrap items-center gap-3">
          <span aria-hidden className="h-3 w-3 animate-pulse rounded-full bg-danger" />
          <span className="font-mono text-lg tabular-nums" aria-live="off">{fmt(seconds)}</span>
          <span aria-hidden className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-bg-0 ring-1 ring-line"><span ref={meter} className="block h-full w-full origin-left" style={{ transform: "scaleX(0)" }} /></span>
          <Button variant="primary" icon="pause" onClick={stop}>Stop</Button>
        </div>
      ) : state === "review" && review ? (
        <div className="flex flex-wrap items-center gap-3">
          <audio src={review.url} controls className="h-10 min-w-0 flex-1" />
          <Button variant="primary" icon="check" onClick={() => void keep(review.blob)} disabled={busy}>Keep take</Button>
          <Button variant="ghost" onClick={discard}>Discard</Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="signal" icon="mic" onClick={start} disabled={busy}>Record a take</Button>
          <label className="font-body text-sm text-muted">
            or upload
            <input type="file" accept="audio/*,.webm,.ogg,.m4a,.mp3,.wav,.flac" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void keep(f); }} className="ml-2 max-w-[13rem] text-[12px] file:mr-2 file:rounded-full file:border-0 file:bg-surface-3 file:px-3 file:py-1.5 file:text-ink" />
          </label>
        </div>
      )}
      {state === "recording" && <p className="font-body text-xs text-muted">Recording stops by itself at 10 minutes. Use headphones if a backing track is playing.</p>}
      {error && <p role="alert" className="font-body text-sm text-danger">{error}</p>}
    </div>
  );
}
