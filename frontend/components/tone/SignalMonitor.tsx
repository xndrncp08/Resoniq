"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { colors } from "@/lib/design-tokens";

const MIN_HZ = 40;
const MAX_HZ = 16000;
const MIN_DB = -100;
const MAX_DB = -20;
const SPECTRUM_BARS = 72;
const FREQ_LABELS = [100, 1000, 10000];

type AudioGraph = { ctx: AudioContext; analyser: AnalyserNode };

/** Size a canvas's backing store to its CSS box at device pixel ratio. */
function fit(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  const { width, height } = canvas.getBoundingClientRect();
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  const g = canvas.getContext("2d")!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, w: width, h: height };
}

function drawGrid(g: CanvasRenderingContext2D, w: number, h: number, cols: number, rows: number) {
  g.strokeStyle = "rgba(255,255,255,0.05)";
  g.lineWidth = 1;
  g.beginPath();
  for (let i = 1; i < cols; i++) {
    const x = Math.round((w * i) / cols) + 0.5;
    g.moveTo(x, 0);
    g.lineTo(x, h);
  }
  for (let i = 1; i < rows; i++) {
    const y = Math.round((h * i) / rows) + 0.5;
    g.moveTo(0, y);
    g.lineTo(w, y);
  }
  g.stroke();
}

function drawScope(canvas: HTMLCanvasElement, samples: Float32Array | null) {
  const { g, w, h } = fit(canvas);
  g.clearRect(0, 0, w, h);
  drawGrid(g, w, h, 8, 4);

  g.strokeStyle = colors.signalTeal;
  g.lineWidth = 1.5;
  g.shadowColor = colors.signalTeal;
  g.shadowBlur = samples ? 6 : 0;
  g.beginPath();
  if (!samples) {
    g.moveTo(0, h / 2);
    g.lineTo(w, h / 2);
  } else {
    // Start on a rising zero crossing so the trace holds still (a basic trigger).
    let start = 0;
    for (let i = 1; i < samples.length / 2; i++) {
      if (samples[i - 1] < 0 && samples[i] >= 0) {
        start = i;
        break;
      }
    }
    const n = Math.floor(samples.length / 2);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * w;
      const y = h / 2 - samples[start + i] * (h / 2) * 0.9;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
  }
  g.stroke();
  g.shadowBlur = 0;
}

function drawSpectrum(canvas: HTMLCanvasElement, db: Float32Array | null, sampleRate: number) {
  const { g, w, h } = fit(canvas);
  const labelH = 14;
  const plotH = h - labelH;
  g.clearRect(0, 0, w, h);
  drawGrid(g, w, plotH, 1, 4);

  // Log-spaced bands so bass isn't squeezed into the first few pixels.
  const logMin = Math.log10(MIN_HZ);
  const logMax = Math.log10(MAX_HZ);
  const xFor = (hz: number) => ((Math.log10(hz) - logMin) / (logMax - logMin)) * w;
  const barW = w / SPECTRUM_BARS;

  if (db) {
    const binHz = sampleRate / 2 / db.length;
    g.fillStyle = colors.signalTeal;
    for (let b = 0; b < SPECTRUM_BARS; b++) {
      const lo = 10 ** (logMin + ((logMax - logMin) * b) / SPECTRUM_BARS);
      const hi = 10 ** (logMin + ((logMax - logMin) * (b + 1)) / SPECTRUM_BARS);
      const from = Math.floor(lo / binHz);
      const to = Math.max(from + 1, Math.ceil(hi / binHz));
      let peak = -Infinity;
      for (let i = from; i < to && i < db.length; i++) peak = Math.max(peak, db[i]);
      const level = Math.max(0, Math.min(1, (peak - MIN_DB) / (MAX_DB - MIN_DB)));
      const barH = level * plotH;
      g.globalAlpha = 0.35 + level * 0.65;
      g.fillRect(b * barW + 1, plotH - barH, Math.max(1, barW - 2), barH);
    }
    g.globalAlpha = 1;
  }

  g.fillStyle = colors.textMuted;
  g.font = `10px ${"'IBM Plex Mono', monospace"}`;
  g.textBaseline = "bottom";
  for (const hz of FREQ_LABELS) {
    const label = hz >= 1000 ? `${hz / 1000}k` : String(hz);
    g.fillText(label, Math.min(xFor(hz) + 3, w - 20), h);
  }
}

/**
 * Plays the analyzed song and shows a live oscilloscope and log-frequency
 * spectrum. The Web Audio graph is created on the first play (browsers
 * require a user gesture) and the draw loop only runs while playing.
 * The audio host must send CORS headers — Supabase public buckets do —
 * or the analyser reads silence.
 */
export default function SignalMonitor({ audioUrl }: { audioUrl: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const scopeRef = useRef<HTMLCanvasElement>(null);
  const spectrumRef = useRef<HTMLCanvasElement>(null);
  const graph = useRef<AudioGraph | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Idle frame + redraw on resize.
  useEffect(() => {
    const draw = () => {
      if (scopeRef.current) drawScope(scopeRef.current, null);
      if (spectrumRef.current) drawSpectrum(spectrumRef.current, null, 44100);
    };
    draw();
    const ro = new ResizeObserver(() => {
      if (!playing) draw();
    });
    if (scopeRef.current) ro.observe(scopeRef.current);
    return () => ro.disconnect();
  }, [playing]);

  // Draw loop while playing.
  useEffect(() => {
    if (!playing || !graph.current) return;
    const { analyser, ctx } = graph.current;
    const time = new Float32Array(analyser.fftSize);
    const freq = new Float32Array(analyser.frequencyBinCount);
    let raf = 0;
    const tick = () => {
      analyser.getFloatTimeDomainData(time);
      analyser.getFloatFrequencyData(freq);
      if (scopeRef.current) drawScope(scopeRef.current, time);
      if (spectrumRef.current) drawSpectrum(spectrumRef.current, freq, ctx.sampleRate);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  useEffect(() => () => void graph.current?.ctx.close(), []);

  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    try {
      if (!graph.current) {
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 4096;
        analyser.smoothingTimeConstant = 0.75;
        ctx.createMediaElementSource(audio).connect(analyser);
        analyser.connect(ctx.destination);
        graph.current = { ctx, analyser };
      }
      await graph.current.ctx.resume();
      await audio.play();
      setError(null);
    } catch {
      setError("Couldn't play this audio.");
    }
  }

  return (
    <div className="glass rounded-panel p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="font-mono text-xs uppercase tracking-[0.2em] text-signal">signal monitor</div>
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className="focus-ring flex items-center gap-2 rounded-full border border-signal/40 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-signal transition hover:bg-signal/10"
        >
          {playing ? <Pause size={13} /> : <Play size={13} />}
          {playing ? "pause" : "play source"}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <figure>
          <canvas ref={scopeRef} className="h-32 w-full rounded-lg bg-black/30" aria-label="Oscilloscope" role="img" />
          <figcaption className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">oscilloscope</figcaption>
        </figure>
        <figure>
          <canvas ref={spectrumRef} className="h-32 w-full rounded-lg bg-black/30" aria-label="Spectrum analyzer" role="img" />
          <figcaption className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">spectrum · hz</figcaption>
        </figure>
      </div>

      {error && <p className="mt-3 font-body text-xs text-danger">{error}</p>}

      <audio
        ref={audioRef}
        src={audioUrl}
        crossOrigin="anonymous"
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        className="hidden"
      />
    </div>
  );
}
