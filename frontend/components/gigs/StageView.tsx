"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/icons/Icon";
import { Button } from "@/components/app/ui";
import { startClickTrack } from "@/lib/practice";
import { describeSignature, midiSignature, programChange } from "@/lib/midi";
import { usePreferences, usePreferencesHydration } from "@/lib/stores/preferences";
import type { SetlistView } from "@/lib/setlists";

type Learn = "next" | "prev" | null;

/**
 * Gig Mode: one song at a time, readable from a few feet away. Steps with the
 * big buttons, arrow/Page keys (most Bluetooth page-turner pedals send those),
 * or a learned MIDI footswitch; sends each song's program change to a MIDI
 * output if one is chosen. Keeps the screen awake while open.
 */
export default function StageView({ setlist }: { setlist: SetlistView }) {
  usePreferencesHydration();
  const midiPref = usePreferences((s) => s.midi);
  const setMidi = usePreferences((s) => s.setMidi);
  const volume = usePreferences((s) => s.metronome.volume);
  const [index, setIndex] = useState(0);
  const [click, setClick] = useState(false);
  const [beat, setBeat] = useState(-1);
  const [access, setAccess] = useState<MIDIAccess | null>(null);
  const [midiError, setMidiError] = useState<string | null>(null);
  const [learn, setLearn] = useState<Learn>(null);
  const [showMidi, setShowMidi] = useState(false);
  const [ports, setPorts] = useState(0);
  const audio = useRef<AudioContext | null>(null);
  const song = setlist.items[index];
  const next = setlist.items[index + 1];
  const total = setlist.items.length;

  const go = useCallback((d: number) => setIndex((i) => Math.max(0, Math.min(total - 1, i + d))), [total]);

  // Keyboard and page-turner pedals.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, select, textarea")) return;
      if (["ArrowRight", "PageDown", "ArrowDown", " "].includes(e.key)) { e.preventDefault(); go(1); }
      else if (["ArrowLeft", "PageUp", "ArrowUp"].includes(e.key)) { e.preventDefault(); go(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  // Keep the screen on (re-requested when the tab comes back; browsers drop it when hidden).
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const request = () => void navigator.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    request();
    const onVisible = () => document.visibilityState === "visible" && request();
    document.addEventListener("visibilitychange", onVisible);
    return () => { document.removeEventListener("visibilitychange", onVisible); void lock?.release(); };
  }, []);

  // MIDI in: a learned footswitch steps the set.
  useEffect(() => {
    if (!access) return;
    const onMessage = (e: MIDIMessageEvent) => {
      const sig = e.data ? midiSignature(e.data) : null;
      if (!sig) return;
      if (learn) { setMidi({ [learn]: sig }); setLearn(null); return; }
      if (sig === midiPref.next) go(1);
      else if (sig === midiPref.prev) go(-1);
    };
    const inputs = [...access.inputs.values()];
    const onState = () => setPorts((n) => n + 1);
    for (const i of inputs) i.addEventListener("midimessage", onMessage);
    access.addEventListener("statechange", onState);
    return () => { for (const i of inputs) i.removeEventListener("midimessage", onMessage); access.removeEventListener("statechange", onState); };
  }, [access, ports, learn, midiPref.next, midiPref.prev, go, setMidi]);

  // MIDI out: each song's program change, sent when the song comes up.
  useEffect(() => {
    if (!access || !midiPref.output || !song?.midiProgram) return;
    access.outputs.get(midiPref.output)?.send(programChange(song.midiProgram, midiPref.channel));
  }, [access, midiPref.output, midiPref.channel, song?.midiProgram, index]);

  // Click at the song's tempo, when asked for.
  useEffect(() => {
    if (!click || !song?.bpm || !audio.current) return;
    return startClickTrack(audio.current, song.bpm, 4, volume, setBeat);
  }, [click, song?.bpm, volume, index]);
  useEffect(() => () => void audio.current?.close(), []);

  async function connectMidi() {
    setMidiError(null);
    try {
      if (!navigator.requestMIDIAccess) throw new Error("unsupported");
      setAccess(await navigator.requestMIDIAccess());
      setShowMidi(true);
    } catch (err) {
      setMidiError(err instanceof Error && err.message === "unsupported" ? "This browser has no Web MIDI (Safari doesn't). Chrome, Edge and Firefox do. Keyboard page-turners still work." : "MIDI access was refused. Allow it in the site settings to use footswitches.");
    }
  }
  function toggleClick() {
    if (click) { setClick(false); setBeat(-1); return; }
    audio.current ??= new AudioContext();
    void audio.current.resume();
    setClick(true);
  }

  if (!song) return null;
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#05070a] text-ink">
      <header className="flex items-center gap-3 border-b border-line px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <Link href={`/gigs/${setlist.id}`} className="focus-ring inline-flex items-center gap-1 rounded-full px-2 py-1 font-body text-sm text-muted hover:text-ink"><Icon name="chevron-left" size={16} /> Edit</Link>
        <p className="min-w-0 flex-1 truncate text-center font-body text-sm text-muted">{setlist.name}</p>
        <span className="font-mono text-sm tabular-nums text-muted" aria-live="polite">{index + 1} / {total}</span>
      </header>

      <main className="flex min-h-0 flex-1 flex-col justify-center gap-6 overflow-y-auto px-6 py-6 sm:px-12" aria-live="polite">
        <div>
          <h1 className="font-display text-[clamp(2.5rem,9vw,7rem)] font-bold leading-[0.95] tracking-tight">{song.title}</h1>
          {song.artist && <p className="mt-2 font-body text-[clamp(1.1rem,3vw,2rem)] text-ink-dim">{song.artist}</p>}
        </div>
        <dl className="flex flex-wrap gap-x-10 gap-y-3">
          {song.key && <div><dt className="label-engraved">Key</dt><dd className="font-display text-[clamp(2rem,6vw,4.5rem)] font-semibold text-copper">{song.key}</dd></div>}
          {song.bpm && (
            <div>
              <dt className="label-engraved">Tempo</dt>
              <dd className="flex items-center gap-3 font-display text-[clamp(2rem,6vw,4.5rem)] font-semibold text-signal">
                {song.bpm}
                <span aria-hidden className={`h-5 w-5 rounded-full transition-colors ${click && beat >= 0 ? (beat === 0 ? "bg-copper" : "bg-signal") : "bg-line"}`} />
              </dd>
            </div>
          )}
          {song.minutes && <div><dt className="label-engraved">Length</dt><dd className="font-display text-[clamp(2rem,6vw,4.5rem)] font-semibold">{song.minutes}′</dd></div>}
          {song.midiProgram && <div><dt className="label-engraved">MIDI</dt><dd className="font-display text-[clamp(2rem,6vw,4.5rem)] font-semibold">P{song.midiProgram}</dd></div>}
        </dl>
        {song.notes && <p className="max-w-4xl whitespace-pre-wrap font-body text-[clamp(1.25rem,3vw,2.25rem)] leading-snug text-ink">{song.notes}</p>}
        {song.toneId && (
          song.tone
            ? <Link href={`/studio?tone=${song.toneId}`} target="_blank" className="focus-ring inline-flex w-fit items-center gap-2 rounded-full border border-copper/40 px-4 py-2 font-body text-copper"><Icon name="amp" size={18} /> {song.tone.name}</Link>
            : <p className="font-body text-sm text-muted">The linked tone isn&apos;t available any more.</p>
        )}
      </main>

      {showMidi && access && (
        <section aria-label="MIDI" className="space-y-2 border-t border-line px-4 py-3 font-body text-sm">
          <div className="flex flex-wrap items-center gap-2">
            {(["prev", "next"] as const).map((k) => (
              <Button key={k} size="sm" variant={learn === k ? "primary" : "secondary"} onClick={() => setLearn(learn === k ? null : k)}>
                {learn === k ? "Press a footswitch…" : `${k === "next" ? "Next" : "Previous"}: ${midiPref[k] ? describeSignature(midiPref[k]) : "learn"}`}
              </Button>
            ))}
            <label className="flex items-center gap-2 text-muted">Program changes to
              <select value={midiPref.output ?? ""} onChange={(e) => setMidi({ output: e.target.value || null })} className="panel-inset h-9 max-w-[14rem] rounded-lg px-2 text-ink">
                <option value="">Off</option>
                {[...access.outputs.values()].map((o) => <option key={o.id} value={o.id}>{o.name ?? o.id}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-muted">ch
              <select value={midiPref.channel} onChange={(e) => setMidi({ channel: Number(e.target.value) })} className="panel-inset h-9 rounded-lg px-2 text-ink">{Array.from({ length: 16 }, (_, i) => <option key={i + 1}>{i + 1}</option>)}</select>
            </label>
          </div>
          <p className="text-xs text-muted">{access.inputs.size} input{access.inputs.size === 1 ? "" : "s"}, {access.outputs.size} output{access.outputs.size === 1 ? "" : "s"} connected. Mappings stay on this device.</p>
        </section>
      )}
      {midiError && <p role="alert" className="border-t border-line px-4 py-2 font-body text-sm text-amber">{midiError}</p>}

      <footer className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-3 border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button type="button" onClick={() => go(-1)} disabled={index === 0} className="focus-ring min-h-20 rounded-2xl border border-line-strong font-display text-xl font-semibold disabled:opacity-30">← Previous</button>
        <div className="flex flex-col justify-center gap-2">
          <Button size="sm" variant={click ? "signal" : "secondary"} onClick={toggleClick} disabled={!song.bpm}>{click ? "Click on" : "Click"}</Button>
          <Button size="sm" onClick={() => (access ? setShowMidi((v) => !v) : void connectMidi())}>MIDI</Button>
        </div>
        <button type="button" onClick={() => go(1)} disabled={index === total - 1} className="focus-ring min-h-20 rounded-2xl bg-copper px-3 text-left font-display text-xl font-semibold text-bg disabled:opacity-30">
          <span className="block">Next →</span>
          {next && <span className="block truncate font-body text-sm font-normal opacity-80">{next.title}{next.key ? ` · ${next.key}` : ""}{next.bpm ? ` · ${next.bpm}` : ""}</span>}
        </button>
      </footer>
    </div>
  );
}
