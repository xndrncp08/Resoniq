"use client";

import { useEffect, useRef, useState } from "react";
import { Button, IconButton } from "@/components/app/ui";
import { MAX_BPM, MIN_BPM, startClickTrack, tappedTempo } from "@/lib/practice";
import { usePreferences, usePreferencesHydration } from "@/lib/stores/preferences";

export default function Metronome() {
  // Tempo, meter and volume persist on this device; play state stays with this page.
  usePreferencesHydration();
  const { bpm, beats, volume } = usePreferences((s) => s.metronome);
  const setMetronome = usePreferences((s) => s.setMetronome);
  const [tempoText, setTempoText] = useState(String(bpm));
  const [shownBpm, setShownBpm] = useState(bpm);
  if (shownBpm !== bpm) {
    // Stored tempo arrived (or tap tempo changed it): keep the text field in step.
    setShownBpm(bpm);
    setTempoText(String(bpm));
  }
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(-1);
  const [error, setError] = useState("");
  const context = useRef<AudioContext | null>(null);
  const taps = useRef<number[]>([]);

  function tempo(value: number) {
    const next = Number.isFinite(value) ? Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(value))) : bpm;
    setMetronome({ bpm: next }); setTempoText(String(next));
  }

  useEffect(() => {
    if (!running || !context.current) return;
    return startClickTrack(context.current, bpm, beats, volume, setBeat);
  }, [running, bpm, beats, volume]);

  useEffect(() => {
    const hide = () => { if (document.hidden) { setRunning(false); setBeat(-1); } };
    document.addEventListener("visibilitychange", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      void context.current?.close();
    };
  }, []);

  function toggle() {
    if (running) { setRunning(false); setBeat(-1); return; }
    try {
      context.current ??= new AudioContext();
      void context.current.resume().catch(() => { setError("Audio could not start. Try pressing Start again."); setRunning(false); });
      setError("");
      setRunning(true);
    } catch {
      setError("This browser cannot start Web Audio. You can still use the loop player below.");
    }
  }

  function tap() {
    const now = performance.now();
    taps.current = now - (taps.current.at(-1) ?? 0) > 2000 ? [now] : [...taps.current.slice(-5), now];
    const tempo = tappedTempo(taps.current);
    if (tempo) setMetronome({ bpm: tempo });
  }

  return (
    <section aria-labelledby="pulse-h" className="panel grille flex flex-col p-5 sm:p-7">
      <div className="flex items-baseline justify-between gap-3"><h2 id="pulse-h" className="font-display text-2xl font-semibold">Find your pocket.</h2><span className="label-engraved">01 / Pulse</span></div>
      <p className="mt-2 text-sm text-muted">Start slow. Play clean. Bring the tempo up.</p>
      <div className="my-8 flex items-center justify-center gap-3">
        <IconButton icon="chevron-left" label="Slower by 1 BPM" onClick={() => tempo(bpm - 1)} size={44} />
        <label className="text-center"><span className="sr-only">Tempo in BPM</span><input aria-label="Tempo in BPM" type="number" min={MIN_BPM} max={MAX_BPM} value={tempoText} onChange={(e) => setTempoText(e.target.value)} onBlur={(e) => tempo(e.target.value ? e.target.valueAsNumber : bpm)} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} className="w-28 bg-transparent text-center font-mono text-6xl tracking-tighter text-signal outline-none" /><span className="label-engraved mt-2 block">Beats per minute</span></label>
        <IconButton icon="plus" label="Faster by 1 BPM" onClick={() => tempo(bpm + 1)} size={44} />
      </div>
      <label><span className="sr-only">Tempo</span><input type="range" min={MIN_BPM} max={MAX_BPM} value={bpm} onChange={(e) => tempo(Number(e.target.value))} className="h-6 w-full accent-signal" /></label>
      <div className="my-5 flex justify-center gap-2" aria-hidden="true">{Array.from({ length: beats }, (_, i) => <span key={i} className={`flex aspect-square max-w-10 min-w-0 flex-1 items-center justify-center rounded-full border font-mono text-sm ${running && beat === i ? "border-signal bg-signal text-bg" : "border-line bg-bg-0 text-muted"}`}>{i + 1}</span>)}</div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <label className="text-sm text-muted">Beats per bar<select value={beats} onChange={(e) => setMetronome({ beats: Number(e.target.value) })} className="panel-inset ml-2 h-11 rounded-xl px-3 text-ink">{[2, 3, 4, 5, 6, 7].map((n) => <option key={n}>{n}</option>)}</select></label>
        <Button onClick={tap}>Tap tempo</Button>
      </div>
      <label className="my-5 flex items-center gap-3 text-sm text-muted">Click volume<input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => setMetronome({ volume: Number(e.target.value) })} className="min-w-0 flex-1 accent-signal" /></label>
      <Button variant="signal" size="lg" icon={running ? "pause" : "play"} onClick={toggle}>{running ? "Stop metronome" : "Start metronome"}</Button>
      <p className="mt-3 text-xs text-muted">Quarter-note pulse. First beat accented. Pauses when you leave this tab.</p>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    </section>
  );
}
