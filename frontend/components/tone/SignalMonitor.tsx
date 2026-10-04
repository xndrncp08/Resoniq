"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { colors } from "@/lib/design-tokens";
import { BANDS, formatVolume, gainsFromAmp, volumeToGain, type EqGains } from "@/lib/eq";
import { gsap } from "@/lib/gsap";
import type { AmpSettings } from "@/types/tone";
import Slider from "@/components/ui/tactile/Slider";
import { sceneState } from "@/components/scene/state";

const MIN_HZ = 40;
const MAX_HZ = 16000;
const MIN_DB = -100;
const MAX_DB = -20;
const SPECTRUM_BARS = 72;
const FREQ_LABELS = [100, 1000, 10000];
// Bars rise instantly and fall at this rate (fraction of full scale per
// second); peak markers hold, then fall slower. Classic analyzer ballistics.
const BAR_FALL_PER_S = 1.6;
const PEAK_HOLD_S = 0.6;
const PEAK_FALL_PER_S = 0.5;
// How quickly filter gains glide to a new knob value, so turning a knob
// while listening doesn't click.
const EQ_GLIDE_S = 0.05;

type AudioGraph = {
  ctx: AudioContext;
  analyser: AnalyserNode;
  filters: BiquadFilterNode[];
  wet: GainNode;
  dry: GainNode;
  master: GainNode;
};


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
  g.shadowBlur = samples ? 8 : 0;
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

/** Peak dB per log-spaced band, normalized to 0..1. */
function bandLevels(db: Float32Array, sampleRate: number, out: Float32Array) {
  const logMin = Math.log10(MIN_HZ);
  const logMax = Math.log10(MAX_HZ);
  const binHz = sampleRate / 2 / db.length;
  for (let b = 0; b < SPECTRUM_BARS; b++) {
    const lo = 10 ** (logMin + ((logMax - logMin) * b) / SPECTRUM_BARS);
    const hi = 10 ** (logMin + ((logMax - logMin) * (b + 1)) / SPECTRUM_BARS);
    const from = Math.floor(lo / binHz);
    const to = Math.max(from + 1, Math.ceil(hi / binHz));
    let peak = -Infinity;
    for (let i = from; i < to && i < db.length; i++) peak = Math.max(peak, db[i]);
    out[b] = Math.max(0, Math.min(1, (peak - MIN_DB) / (MAX_DB - MIN_DB)));
  }
}

function drawSpectrum(canvas: HTMLCanvasElement, bars: Float32Array, peaks: Float32Array) {
  const { g, w, h } = fit(canvas);
  const labelH = 14;
  const plotH = h - labelH;
  g.clearRect(0, 0, w, h);
  drawGrid(g, w, plotH, 1, 4);

  const logMin = Math.log10(MIN_HZ);
  const logMax = Math.log10(MAX_HZ);
  const xFor = (hz: number) => ((Math.log10(hz) - logMin) / (logMax - logMin)) * w;
  const barW = w / SPECTRUM_BARS;

  g.fillStyle = colors.signalTeal;
  g.shadowColor = colors.signalTeal;
  for (let b = 0; b < SPECTRUM_BARS; b++) {
    const level = bars[b];
    const barH = level * plotH;
    g.globalAlpha = 0.3 + level * 0.7;
    g.shadowBlur = level > 0.6 ? 10 : 0;
    g.fillRect(b * barW + 1, plotH - barH, Math.max(1, barW - 2), barH);
    if (peaks[b] > 0.02) {
      g.globalAlpha = 0.9;
      g.fillRect(b * barW + 1, plotH - peaks[b] * plotH - 2, Math.max(1, barW - 2), 2);
    }
  }
  g.globalAlpha = 1;
  g.shadowBlur = 0;

  g.fillStyle = colors.textMuted;
  g.font = `10px ${getComputedStyle(canvas).fontFamily}`;
  g.textBaseline = "bottom";
  for (const hz of FREQ_LABELS) {
    const label = hz >= 1000 ? `${hz / 1000}k` : String(hz);
    g.fillText(label, Math.min(xFor(hz) + 3, w - 20), h);
  }
}

const avg = (a: Float32Array, from: number, to: number) => {
  let s = 0;
  for (let i = from; i < to; i++) s += a[i];
  return s / Math.max(1, to - from);
};

/** Coarse levels for the shared background scene, so the field moves with the music. */
function publishAudio(levels: Float32Array | null) {
  const a = sceneState.audio;
  if (!levels) {
    a.playing = false;
    return;
  }
  a.playing = true;
  a.low = avg(levels, 0, 20); // ~40-200 Hz
  a.mid = avg(levels, 20, 50); // ~200 Hz-2.5 kHz
  a.high = avg(levels, 50, SPECTRUM_BARS); // upper bands
  a.level = avg(levels, 0, SPECTRUM_BARS);
}

function setEq(graph: AudioGraph, gains: EqGains) {
  const t = graph.ctx.currentTime;
  BANDS.forEach((band, i) => graph.filters[i].gain.setTargetAtTime(gains[band.key], t, EQ_GLIDE_S));
}

/**
 * Plays the analyzed song with a live oscilloscope and log-frequency
 * spectrum. With "Hear EQ" on, playback runs through the amp's bass / mids
 * / treble / presence settings (the same filters the EQ curve draws, see
 * lib/eq.ts), so turning a knob is audible and visible in the spectrum.
 * That's an EQ preview on the finished mix, not an amp simulation.
 *
 * The Web Audio graph is created on first play (browsers require a user
 * gesture). Drawing runs on GSAP's ticker only while audio plays or the
 * bars are still falling, and stops when the component unmounts.
 */
export default function SignalMonitor({ audioUrl, amp }: { audioUrl: string; amp: AmpSettings }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const scopeRef = useRef<HTMLCanvasElement>(null);
  const spectrumRef = useRef<HTMLCanvasElement>(null);
  const graph = useRef<AudioGraph | null>(null);
  const [playing, setPlaying] = useState(false);
  const [eqOn, setEqOn] = useState(true);
  const [volume, setVolume] = useState(80);
  const [error, setError] = useState<string | null>(null);
  // Latest gains for the graph to start from; kept in sync by the effect below.
  const gainsRef = useRef<EqGains>(gainsFromAmp(amp));

  // Push knob changes into the live filters.
  useEffect(() => {
    gainsRef.current = gainsFromAmp({ bass: amp.bass, mids: amp.mids, treble: amp.treble, presence: amp.presence });
    if (graph.current) setEq(graph.current, gainsRef.current);
  }, [amp.bass, amp.mids, amp.treble, amp.presence]);

  useEffect(() => {
    const g = graph.current;
    if (g) g.master.gain.setTargetAtTime(volumeToGain(volume), g.ctx.currentTime, EQ_GLIDE_S);
  }, [volume]);

  // Crossfade between the processed and the untouched signal.
  useEffect(() => {
    const g = graph.current;
    if (!g) return;
    const t = g.ctx.currentTime;
    g.wet.gain.setTargetAtTime(eqOn ? 1 : 0, t, EQ_GLIDE_S);
    g.dry.gain.setTargetAtTime(eqOn ? 0 : 1, t, EQ_GLIDE_S);
  }, [eqOn]);

  // Render loop on GSAP's ticker (one shared rAF for every GSAP animation).
  useEffect(() => {
    const bars = new Float32Array(SPECTRUM_BARS);
    const peaks = new Float32Array(SPECTRUM_BARS);
    const peakAge = new Float32Array(SPECTRUM_BARS);
    const levels = new Float32Array(SPECTRUM_BARS);
    let time: Float32Array<ArrayBuffer> | null = null;
    let freq: Float32Array<ArrayBuffer> | null = null;

    const idle = () => {
      if (scopeRef.current) drawScope(scopeRef.current, null);
      if (spectrumRef.current) drawSpectrum(spectrumRef.current, bars, peaks);
    };
    idle();

    const tick = (_time: number, deltaMs: number) => {
      const dt = Math.min(deltaMs, 100) / 1000;
      const g = graph.current;
      const live = playing && g;
      if (live) {
        time ??= new Float32Array(g.analyser.fftSize);
        freq ??= new Float32Array(g.analyser.frequencyBinCount);
        g.analyser.getFloatTimeDomainData(time);
        g.analyser.getFloatFrequencyData(freq);
        bandLevels(freq, g.ctx.sampleRate, levels);
      } else {
        levels.fill(0);
      }
      publishAudio(live ? levels : null);
      let moving = false;
      for (let b = 0; b < SPECTRUM_BARS; b++) {
        bars[b] = Math.max(levels[b], bars[b] - BAR_FALL_PER_S * dt);
        if (bars[b] >= peaks[b]) {
          peaks[b] = bars[b];
          peakAge[b] = 0;
        } else if ((peakAge[b] += dt) > PEAK_HOLD_S) {
          peaks[b] = Math.max(0, peaks[b] - PEAK_FALL_PER_S * dt);
        }
        if (bars[b] > 0 || peaks[b] > 0) moving = true;
      }
      if (scopeRef.current) drawScope(scopeRef.current, live ? time : null);
      if (spectrumRef.current) drawSpectrum(spectrumRef.current, bars, peaks);
      // Paused and fully decayed: stop ticking until playback resumes.
      if (!live && !moving) gsap.ticker.remove(tick);
    };
    gsap.ticker.add(tick);

    const ro = new ResizeObserver(idle);
    if (scopeRef.current) ro.observe(scopeRef.current);
    return () => {
      gsap.ticker.remove(tick);
      ro.disconnect();
      publishAudio(null);
    };
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
        const source = ctx.createMediaElementSource(audio);
        const filters = BANDS.map((band) => {
          const f = ctx.createBiquadFilter();
          f.type = band.type;
          f.frequency.value = band.frequency;
          f.Q.value = band.q;
          return f;
        });
        const wet = ctx.createGain();
        const dry = ctx.createGain();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 4096;
        analyser.smoothingTimeConstant = 0.75;

        const master = ctx.createGain();
        master.gain.value = volumeToGain(volume);

        // source -> [EQ chain] -> wet ┐
        // source -----------------> dry ┴-> analyser -> master -> speakers
        // (The spectrum reads before the master fader: volume changes loudness, not the picture.)
        filters.reduce<AudioNode>((prev, f) => (prev.connect(f), f), source).connect(wet);
        source.connect(dry);
        wet.connect(analyser);
        dry.connect(analyser);
        analyser.connect(master);
        master.connect(ctx.destination);
        wet.gain.value = eqOn ? 1 : 0;
        dry.gain.value = eqOn ? 0 : 1;

        graph.current = { ctx, analyser, filters, wet, dry, master };
        setEq(graph.current, gainsRef.current);
      }
      await graph.current.ctx.resume();
      await audio.play();
      setError(null);
    } catch {
      setError("Couldn't play this audio.");
    }
  }

  return (
    <div className="glass @container rounded-panel p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-signal">
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${playing ? "bg-signal shadow-[0_0_8px_var(--color-signal)]" : "bg-white/15"}`}
          />
          signal monitor
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={eqOn}
            onClick={() => setEqOn((v) => !v)}
            title="Play through the amp's bass, mids, treble and presence settings (an EQ preview, not an amp simulation)"
            className={`focus-ring rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
              eqOn ? "border-copper/50 text-copper" : "border-white/10 text-muted hover:text-ink"
            }`}
          >
            hear eq {eqOn ? "on" : "off"}
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? "Pause" : "Play"}
            className="focus-ring flex items-center gap-2 rounded-full border border-signal/40 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-signal transition-colors hover:bg-signal/10"
          >
            {playing ? <Pause size={13} /> : <Play size={13} />}
            {playing ? "pause" : "play source"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 @xl:grid-cols-2">
        <figure>
          <canvas ref={scopeRef} className="h-32 w-full rounded-lg bg-black/30" aria-label="Oscilloscope" role="img" />
          <figcaption className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">oscilloscope</figcaption>
        </figure>
        <figure>
          <canvas
            ref={spectrumRef}
            className="h-32 w-full rounded-lg bg-black/30 font-mono"
            aria-label="Spectrum analyzer"
            role="img"
          />
          <figcaption className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            spectrum · hz {eqOn && <span className="text-copper/80">· after eq</span>}
          </figcaption>
        </figure>
      </div>

      <Slider label="master" value={volume} onChange={setVolume} weight="smooth" format={formatVolume} className="mt-4 max-w-sm" />

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
