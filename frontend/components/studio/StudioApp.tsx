"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useStore } from "zustand";
import Icon from "@/components/icons/Icon";
import Dialog from "@/components/app/Dialog";
import { Button } from "@/components/app/ui";
import { Fader, Footswitch, Meter, StudioKnob, StudioSwitch } from "@/components/studio/controls";
import { AmpFace, CabFace, MiniAmp, MiniPedal, SpeakerMic, Stompbox, pedalInk } from "@/components/studio/hardware";
import { useStudioAudio, type SourceKind } from "@/components/studio/useStudioAudio";
import { createStudioStore, isDirty, type StudioState, type StudioStore } from "@/lib/stores/studio-store";
import { describeEdit } from "@/lib/studio/readout";
import { useConfirmLeave, useUnsavedChanges } from "@/components/app/UnsavedChanges";
import {
  AMP_CHARACTERS, AMP_DESIGNS, AMP_MODELS, CAB_DESIGNS, CAB_MODELS, EFFECT_DESIGNS, EFFECT_TYPES, FACTORY_PRESETS, GATE_RANGE, LEVEL_RANGE, MAX_EFFECTS, MAX_PRESET_FILE_BYTES,
  MIC_DESIGNS, MICS, RIG_SLOT, SPEAKER_DESIGNS, SPEAKERS, arrangeEffects, chainOrder, newEffect, nudgeEffect, orderEffects, presetFile, readPresetFile, withAmpModel,
  type AmpCharacter, type AmpKnob, type AmpSwitch, type Effect, type EffectType, type StudioPatch,
} from "@/lib/studio/patch";
import type { StudioDevice } from "@/lib/studio/devices";
import { patchFromTone } from "@/lib/studio/from-tone";
import { presetsQuery, studioKeys, useSaveStudio, type SaveMode, type StudioOrigin } from "@/lib/queries/studio";
import { api, errorMessage } from "@/lib/client-api";
import ToneDnaPanel from "@/components/tone/ToneDnaPanel";
import ToneHistory from "@/components/tone/ToneHistory";

// ── Store wiring ───────────────────────────────────────────────────────

const StoreContext = createContext<StudioStore | null>(null);
function useStudio<T>(select: (s: StudioState) => T) {
  const store = useContext(StoreContext);
  if (!store) throw new Error("Studio store missing");
  return useStore(store, select);
}
function useStudioStore() {
  return useContext(StoreContext)!;
}

type Audio = ReturnType<typeof useStudioAudio>;
type Notify = (text: string, tone?: "ok" | "error") => void;

const db = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)} dB`;
const label = "font-mono text-[10px] uppercase tracking-[0.14em] text-muted";
const cardClass = (on: boolean) => `focus-ring rounded-xl border p-3 text-left transition-colors ${on ? "border-copper/60 bg-copper/10" : "border-line hover:border-line-strong"}`;

function useAmpControls(): { knobs: { key: AmpKnob; label: string }[]; switches: { key: AmpSwitch; label: string }[] } {
  const model = useStudio((s) => s.patch.amp.model);
  const device = useStudio((s) => s.device);
  return useMemo(() => (device ? { knobs: device.ampKnobs, switches: [] } : { knobs: AMP_DESIGNS[model].knobs, switches: AMP_DESIGNS[model].switches }), [model, device]);
}

/** Every edit to one effect goes through here. */
function useFxEdit() {
  const store = useStudioStore();
  return (id: string, key: string, change: (e: Effect) => Effect) =>
    store.getState().edit(`fx.${id}.${key}`, (p) => ({ ...p, effects: p.effects.map((e) => (e.id === id ? change(e) : e)) }));
}

// ── Toolbar: presets, history, compare, save ───────────────────────────

function IconBtn({ icon, label: text, onClick, disabled, rotate = 0 }: { icon: "arrow-up"; label: string; onClick: () => void; disabled?: boolean; rotate?: number }) {
  return (
    <button type="button" aria-label={text} title={text} onClick={onClick} disabled={disabled} className="focus-ring flex h-8 w-8 items-center justify-center rounded-full border border-line-strong text-ink-dim hover:text-ink disabled:opacity-35">
      <Icon name={icon} size={16} style={{ transform: `rotate(${rotate}deg)` }} />
    </button>
  );
}

/** Factory starting points and your saved sounds; prev/next step through them. */
function PresetBar({ origin }: { origin: StudioOrigin }) {
  const store = useStudioStore();
  const device = useStudio((s) => s.device);
  const router = useRouter();
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const mine = useQuery({ ...presetsQuery(userId ?? ""), enabled: !!userId });
  const options = [
    ...(device ? [] : FACTORY_PRESETS.map((f) => ({ value: `factory:${f.id}`, label: f.name, group: "Factory" }))),
    ...(mine.data ?? []).map((p) => ({ value: `tone:${p.id}`, label: p.name, group: "Your sounds" })),
  ];
  const current = origin.toneId ? `tone:${origin.toneId}` : "";
  const [factory, setFactory] = useState("");
  const value = current || factory;
  const confirmLeave = useConfirmLeave();

  async function choose(v: string) {
    // Opening another sound replaces this one: ask if it has unsaved changes.
    if (!(await confirmLeave())) return;
    if (v.startsWith("factory:")) {
      const f = FACTORY_PRESETS.find((x) => `factory:${x.id}` === v);
      if (f) {
        setFactory(v);
        store.getState().load(f.patch);
      }
    } else if (v.startsWith("tone:")) {
      router.push(`/studio?tone=${v.slice(5)}`);
    }
  }
  const idx = options.findIndex((o) => o.value === value);
  const step = (d: number) => options.length && choose(options[(idx + d + options.length) % options.length].value);
  return (
    <div className="flex min-w-0 items-center gap-1">
      <button type="button" aria-label="Previous preset" onClick={() => step(-1)} className="focus-ring flex h-9 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:text-ink"><Icon name="chevron-left" size={18} /></button>
      <label className="min-w-0 flex-1 lg:w-[20rem] lg:flex-none">
        <span className="sr-only">Preset</span>
        <select value={value} onChange={(e) => choose(e.target.value)} className="focus-ring h-9 w-full truncate rounded-lg border border-line-strong bg-surface-2 px-3 font-body text-sm text-ink">
          {!value && <option value="">{origin.name}</option>}
          {current && !options.some((o) => o.value === current) && <option value={current}>{origin.name}</option>}
          {["Factory", "Your sounds"].map((g) => (
            <optgroup key={g} label={g}>{options.filter((o) => o.group === g).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>
          ))}
        </select>
      </label>
      <button type="button" aria-label="Next preset" onClick={() => step(1)} className="focus-ring flex h-9 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:text-ink"><Icon name="chevron-right" size={18} /></button>
    </div>
  );
}

/** Preset actions that don't need a big button: rename, duplicate, import, export, share. */
function PresetMenu({ origin, signedIn, onRename, onDuplicate, onShare, onSimilar, onHistory, notify }: { origin: StudioOrigin; signedIn: boolean; onRename: () => void; onDuplicate: () => void; onShare: () => void; onSimilar: () => void; onHistory: () => void; notify: Notify }) {
  const store = useStudioStore();
  const confirmLeave = useConfirmLeave();
  const [open, setOpen] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  function exportFile() {
    const blob = new Blob([presetFile(origin.name, store.getState().patch)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${origin.name.replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "studio-sound"}.resoniq.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    notify(`Exported “${origin.name}” as a file.`);
  }
  async function importFile(f: File | undefined) {
    if (!f) return;
    try {
      if (f.size > MAX_PRESET_FILE_BYTES) throw new Error("That file is too large to be a studio preset.");
      const { name, patch } = readPresetFile(await f.text());
      if (!(await confirmLeave())) return;
      store.getState().load(patch);
      notify(`Loaded “${name ?? f.name}”. It isn't saved until you save it.`);
    } catch (err) {
      notify(err instanceof Error ? err.message : "That file couldn't be read.", "error");
    } finally {
      if (file.current) file.current.value = "";
    }
  }
  const owner = signedIn && origin.isOwner && !!origin.toneId;
  const items = [
    { id: "rename", text: "Rename…", icon: "edit", hidden: !owner },
    { id: "history", text: "History…", icon: "clock", hidden: !owner },
    { id: "duplicate", text: "Duplicate…", icon: "copy" },
    { id: "import", text: "Import preset file…", icon: "upload" },
    { id: "export", text: "Export preset file", icon: "download" },
    { id: "share", text: "Share…", icon: "share" },
    { id: "similar", text: "Find similar sounds", icon: "compare" },
  ] as const;
  const run = (id: (typeof items)[number]["id"]) => {
    setOpen(false);
    if (id === "rename") onRename();
    else if (id === "history") onHistory();
    else if (id === "duplicate") onDuplicate();
    else if (id === "import") file.current?.click();
    else if (id === "export") exportFile();
    else if (id === "similar") onSimilar();
    else onShare();
  };
  return (
    <div ref={root} className="relative" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label="Preset actions" onClick={() => setOpen((o) => !o)} className="focus-ring flex h-8 w-8 items-center justify-center rounded-full border border-line-strong text-ink-dim hover:text-ink">
        <Icon name="more" size={16} />
      </button>
      <input ref={file} type="file" accept=".json,application/json" className="hidden" onChange={(e) => void importFile(e.target.files?.[0])} />
      {open && (
        <div role="menu" className="absolute right-0 top-10 z-30 w-56 rounded-xl border border-line-strong bg-surface-2 p-1 shadow-2xl">
          {items.filter((i) => !("hidden" in i && i.hidden)).map((i) => (
            <button key={i.id} type="button" role="menuitem" onClick={() => run(i.id)} className="focus-ring flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-body text-sm text-ink-dim hover:bg-surface-3 hover:text-ink">
              <Icon name={i.icon} size={15} /> {i.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Toolbar({ origin, signedIn, onSave, onRename, onShare, onSimilar, onHistory, notify }: { origin: StudioOrigin; signedIn: boolean; onSave: (mode: SaveMode, name?: string) => void; onRename: () => void; onShare: () => void; onSimilar: () => void; onHistory: () => void; notify: Notify }) {
  const store = useStudioStore();
  const active = useStudio((s) => s.active);
  const canUndo = useStudio((s) => s.past.length > 0);
  const canRedo = useStudio((s) => s.future.length > 0);
  const dirty = useStudio(isDirty);
  const { undo, redo, switchSlot, copyToOther, reset } = store.getState();
  const owner = origin.isOwner && !!origin.toneId;
  return (
    <div className="flex flex-col gap-2 border-b border-line bg-[linear-gradient(180deg,#121419,#0d0f13)] px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <PresetBar origin={origin} />
      <div className="flex flex-wrap items-center gap-1.5">
        <IconBtn icon="arrow-up" label="Undo (⌘Z)" onClick={undo} disabled={!canUndo} rotate={-90} />
        <IconBtn icon="arrow-up" label="Redo (⇧⌘Z)" onClick={redo} disabled={!canRedo} rotate={90} />
        <div role="group" aria-label="Compare" className="flex overflow-hidden rounded-full border border-line-strong">
          {(["A", "B"] as const).map((slot) => (
            <button key={slot} type="button" aria-pressed={active === slot} onClick={() => switchSlot(slot)} title="Compare two versions (C)" className={`focus-ring h-8 w-9 font-mono text-xs ${active === slot ? "bg-copper text-bg" : "text-muted hover:text-ink"}`}>{slot}</button>
          ))}
        </div>
        <Button size="sm" variant="ghost" onClick={() => { copyToOther(); notify(`Copied ${active} to ${active === "A" ? "B" : "A"}.`); }} title="Copy this side to the other">Copy to {active === "A" ? "B" : "A"}</Button>
        <Button size="sm" variant="ghost" onClick={reset} disabled={!dirty}>Revert</Button>
        {signedIn ? (
          <>
            {owner && <Button size="sm" variant="primary" icon="check" onClick={() => onSave("update")} disabled={!dirty}>Save</Button>}
            <Button size="sm" variant={owner ? "secondary" : "primary"} onClick={() => onSave("new")}>{origin.toneId && !origin.isOwner ? "Save as remix" : "Save as…"}</Button>
          </>
        ) : (
          <Link href="/login?callbackUrl=/studio" className="focus-ring inline-flex h-8 items-center rounded-full bg-copper px-3 font-body text-[13px] font-medium text-bg">Sign in to save</Link>
        )}
        <PresetMenu origin={origin} signedIn={signedIn} onRename={onRename} onDuplicate={() => onSave("new", `${origin.name} (copy)`)} onShare={onShare} onSimilar={onSimilar} onHistory={onHistory} notify={notify} />
        <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${dirty ? "text-amber" : "text-muted"}`} aria-live="polite">{dirty ? "Unsaved" : owner ? "Saved" : ""}</span>
      </div>
    </div>
  );
}

// ── Rack: what's feeding the chain, and the levels in and out ──────────

function Rack({ audio }: { audio: Audio }) {
  const store = useStudioStore();
  const input = useStudio((s) => s.patch.input);
  const output = useStudio((s) => s.patch.output);
  const gate = useStudio((s) => s.patch.gate);
  const { edit } = store.getState();
  const [source, setSource] = useState<SourceKind>("demo");
  const [file, setFile] = useState<File | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const playing = audio.status.state === "playing";
  const supported = typeof window === "undefined" || typeof window.AudioContext !== "undefined";
  async function listDevices() {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter((d) => d.kind === "audioinput"));
    } catch {
      setDevices([]);
    }
  }
  const go = () => (playing ? audio.stop() : void audio.start(source, file ?? undefined, deviceId || undefined));
  return (
    <div className="grid gap-x-6 gap-y-3 border-b border-line bg-[linear-gradient(180deg,#16181d,#0e1014)] px-4 py-3 sm:px-6 lg:grid-cols-[1fr_auto]">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button variant={playing ? "secondary" : "signal"} icon={playing ? "pause" : "play"} onClick={go} disabled={!supported || audio.status.state === "starting" || (source === "file" && !file)}>
          {audio.status.state === "starting" ? "Starting…" : playing ? "Stop" : source === "live" ? "Play live" : "Play"}
        </Button>
        <div role="radiogroup" aria-label="Sound source" className="flex overflow-hidden rounded-full border border-line-strong">
          {([["demo", "Demo riff"], ["file", "Your file"], ["live", "Live input"]] as const).map(([k, text]) => (
            <button key={k} type="button" role="radio" aria-checked={source === k} onClick={() => { setSource(k); if (k === "live") void listDevices(); if (playing) audio.stop(); }} className={`focus-ring h-9 px-3 font-body text-[13px] ${source === k ? "bg-surface-3 text-ink" : "text-muted hover:text-ink"}`}>{text}</button>
          ))}
        </div>
        {source === "file" && (
          <label className="flex min-w-0 items-center gap-2 font-body text-[13px] text-muted">
            <span className="sr-only">Audio file</span>
            <input type="file" accept="audio/*" onChange={(e) => { setFile(e.target.files?.[0] ?? null); if (playing) audio.stop(); }} className="max-w-[15rem] text-[12px] file:mr-2 file:rounded-full file:border-0 file:bg-surface-3 file:px-3 file:py-1.5 file:text-ink" />
          </label>
        )}
        {source === "live" && (
          <label className="flex items-center gap-2 font-body text-[13px] text-muted">
            Input
            <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} className="focus-ring h-9 max-w-[13rem] rounded-lg border border-line-strong bg-surface-2 px-2 text-ink">
              <option value="">Default input</option>
              {devices.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Input ${i + 1}`}</option>)}
            </select>
          </label>
        )}
        <p role="status" aria-live="polite" className="min-w-0 basis-full font-body text-xs text-muted lg:basis-auto lg:flex-1">
          {!supported
            ? "This browser has no Web Audio, so the studio can't make sound here. The controls still edit and save."
            : audio.status.message ??
              (playing
                ? source === "live" ? `Live. About ${audio.status.latencyMs ?? "?"} ms of browser latency; use headphones to avoid feedback.` : "Looping. Turn anything: you're hearing it change."
                : source === "file" ? "Your file stays on this device. A dry DI track shows the amp best."
                : source === "live" ? "Plug in through an audio interface. Nothing is recorded or uploaded."
                : "A synthesized DI riff, generated in your browser.")}
        </p>
      </div>
      <div className="flex items-end justify-between gap-4 lg:justify-end">
        <div className="flex items-end gap-3">
          <StudioKnob label="Input" value={input} min={LEVEL_RANGE.min} max={LEVEL_RANGE.max} step={0.5} defaultValue={0} format={db} size={44} onChange={(v) => edit("input", (p) => ({ ...p, input: v }))} accent="var(--color-signal)" />
          <Meter read={playing ? audio.readInput : null} label="In" />
        </div>
        <div className="flex items-end gap-2 border-x border-line px-3">
          <StudioSwitch label="Gate" on={gate.on} onChange={(on) => edit("gate.on", (p) => ({ ...p, gate: { ...p.gate, on } }))} />
          <StudioKnob label="Threshold" value={gate.threshold} min={GATE_RANGE.min} max={GATE_RANGE.max} step={1} defaultValue={-70} size={44} format={(v) => `${v.toFixed(0)} dB`} disabled={!gate.on} onChange={(v) => edit("gate.threshold", (p) => ({ ...p, gate: { ...p.gate, threshold: v } }))} accent="var(--color-signal)" />
        </div>
        <div className="flex items-end gap-3">
          <Meter read={playing ? audio.readOutput : null} label="Out" />
          <StudioKnob label="Output" value={output} min={LEVEL_RANGE.min} max={LEVEL_RANGE.max} step={0.5} defaultValue={0} format={db} size={44} onChange={(v) => edit("output", (p) => ({ ...p, output: v }))} accent="var(--color-signal)" />
        </div>
      </div>
    </div>
  );
}

// ── Pedalboard: the whole signal chain, drag to rearrange ──────────────

function Grip() {
  return <span aria-hidden className="grid grid-cols-3 gap-[3px]">{Array.from({ length: 6 }, (_, i) => <span key={i} className="h-[3px] w-[3px] rounded-full bg-current" />)}</span>;
}

function Cable() {
  return <span aria-hidden className="mt-[86px] h-[5px] w-4 shrink-0 self-start rounded-full bg-[linear-gradient(180deg,#2c2c2e,#0a0a0a)] shadow-[0_1px_0_rgba(255,255,255,.06)] sm:w-6" />;
}

function Pedalboard({ powered, onAdd }: { powered: boolean; onAdd: () => void }) {
  const store = useStudioStore();
  const effects = useStudio((s) => s.patch.effects);
  const device = useStudio((s) => s.device);
  const view = useStudio((s) => s.view);
  const selectedFx = useStudio((s) => s.selectedFx);
  const model = useStudio((s) => s.patch.amp.model);
  const cab = useStudio((s) => s.patch.cab);
  const fxEdit = useFxEdit();
  const order = chainOrder(effects);
  const tiles = useRef(new Map<string, HTMLElement>());
  const handles = useRef(new Map<string, HTMLButtonElement>());
  const [drag, setDrag] = useState<{ id: string; x0: number; dx: number; centers: [string, number][]; target: number } | null>(null);
  const [announce, setAnnounce] = useState("");
  const { edit, selectFx, setView } = store.getState();
  const canArrange = !device;
  const byId = new Map(effects.map((e) => [e.id, e]));

  const where = (list: Effect[], id: string) => {
    const e = list.find((x) => x.id === id);
    if (!e) return "";
    const side = list.filter((x) => x.placement === e.placement);
    return `${EFFECT_DESIGNS[e.type].name}: ${e.placement === "pre" ? "before the amp" : "after the cabinet"}, ${side.indexOf(e) + 1} of ${side.length}.`;
  };
  function begin(id: string, e: ReactPointerEvent<HTMLButtonElement>) {
    if (e.button > 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const centers = order.map((oid): [string, number] => {
      const r = tiles.current.get(oid)?.getBoundingClientRect();
      return [oid, r ? r.left + r.width / 2 : 0];
    });
    setDrag({ id, x0: e.clientX, dx: 0, centers, target: order.indexOf(id) });
  }
  function move(e: ReactPointerEvent) {
    if (!drag) return;
    const dx = e.clientX - drag.x0;
    const self = (drag.centers.find(([i]) => i === drag.id)?.[1] ?? 0) + dx;
    const target = drag.centers.filter(([i, c]) => i !== drag.id && c < self).length;
    if (dx !== drag.dx || target !== drag.target) setDrag({ ...drag, dx, target });
  }
  function end() {
    if (!drag) return;
    const next = order.filter((i) => i !== drag.id);
    next.splice(drag.target, 0, drag.id);
    if (next.join() !== order.join()) {
      edit("fx.order", (p) => ({ ...p, effects: arrangeEffects(p.effects, next) }));
      setAnnounce(where(arrangeEffects(effects, next), drag.id));
    }
    setDrag(null);
  }
  function onHandleKey(id: string, e: ReactKeyboardEvent) {
    const step = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = nudgeEffect(effects, id, step);
    edit("fx.order", (p) => ({ ...p, effects: nudgeEffect(p.effects, id, step) }));
    setAnnounce(where(next, id));
    requestAnimationFrame(() => handles.current.get(id)?.focus());
  }

  const others = drag ? order.filter((i) => i !== drag.id) : order;
  const marker = (i: number) => drag && drag.target === i && <span aria-hidden className="mt-6 h-[120px] w-1 shrink-0 self-start rounded-full bg-copper shadow-[0_0_12px_var(--color-copper)]" />;
  const tileRef = (id: string) => (el: HTMLElement | null) => void (el ? tiles.current.set(id, el) : tiles.current.delete(id));

  return (
    <section aria-label="Signal chain" className="relative border-b border-line bg-[#0b0c0f]">
      <div className="flex items-center justify-between px-4 pt-3 sm:px-6">
        <h2 className={label}>Signal chain · {effects.length} pedal{effects.length === 1 ? "" : "s"}</h2>
        {canArrange && <p className="hidden font-body text-[11px] text-muted sm:block">Drag a pedal by its handle (or focus it and use ← →). Left of the amp feeds it; right of it follows the cabinet.</p>}
      </div>
      <div className="overflow-x-auto px-4 pb-4 pt-2 scrollbar-none sm:px-6" onPointerMove={move} onPointerUp={end} onPointerCancel={() => setDrag(null)}>
        {/* The board: loop fabric between two rails */}
        <ol className="relative mx-auto flex w-max min-w-full items-start gap-0 rounded-xl border border-black/70 bg-[#18191c] px-3 pb-3 pt-1 shadow-[inset_0_2px_10px_rgba(0,0,0,.7)]" style={{ backgroundImage: "repeating-linear-gradient(0deg,rgba(255,255,255,.015) 0 2px,transparent 2px 4px),repeating-linear-gradient(90deg,rgba(0,0,0,.25) 0 1px,transparent 1px 3px)" }}>
          <li aria-hidden className="flex shrink-0 flex-col items-center pt-[70px]">
            <span className="h-5 w-5 rounded-full border-2 border-[#9aa0a6] bg-[radial-gradient(circle,#000_40%,#333_45%)]" />
            <span className="mt-1 font-mono text-[8px] uppercase tracking-[0.14em] text-muted">Guitar</span>
          </li>
          <Cable />
          {order.map((id) => {
            const k = others.indexOf(id);
            if (id === RIG_SLOT) {
              return (
                <li key={id} ref={tileRef(id)} className="flex shrink-0 items-start">
                  {marker(k)}
                  <button type="button" onClick={() => setView("amp")} aria-pressed={view === "amp"} aria-label={`Amp: ${device ? device.name : AMP_DESIGNS[model].name}`} className={`focus-ring mt-6 flex flex-col items-center gap-1 rounded-lg p-1 ${view === "amp" ? "ring-2 ring-copper" : ""}`}>
                    <MiniAmp model={model} powered={powered} width={112} />
                    <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-dim">Amp</span>
                  </button>
                  <Cable />
                  <button type="button" onClick={() => setView("cab")} aria-pressed={view === "cab"} aria-label={`Cabinet: ${CAB_DESIGNS[cab.model].name}${cab.on ? "" : " (bypassed)"}`} className={`focus-ring mt-4 flex flex-col items-center gap-1 rounded-lg p-1 ${view === "cab" ? "ring-2 ring-copper" : ""} ${cab.on ? "" : "opacity-40"}`}>
                    <CabFace model={cab.model} width={72} label={false} />
                    <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-dim">Cab</span>
                  </button>
                </li>
              );
            }
            const e = byId.get(id);
            if (!e) return null;
            const d = EFFECT_DESIGNS[e.type];
            const dragging = drag?.id === id;
            return (
              <li key={id} ref={tileRef(id)} className="flex shrink-0 items-start" style={dragging ? { transform: `translateX(${drag.dx}px)`, zIndex: 20, position: "relative" } : undefined}>
                {!dragging && marker(k)}
                <Cable />
                <div className={`flex flex-col items-center ${dragging ? "scale-105 opacity-90 drop-shadow-2xl" : ""}`}>
                  {canArrange ? (
                    <button
                      ref={(el) => void (el ? handles.current.set(id, el) : handles.current.delete(id))}
                      type="button"
                      aria-label={`Move ${d.name}`}
                      aria-describedby="chain-help"
                      onPointerDown={(ev) => begin(id, ev)}
                      onKeyDown={(ev) => onHandleKey(id, ev)}
                      className={`focus-ring tap-clean mb-1 flex h-6 w-14 touch-none items-center justify-center rounded-full text-muted hover:bg-white/5 hover:text-ink ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
                    >
                      <Grip />
                    </button>
                  ) : <span className="mb-1 h-6" />}
                  <div className="relative">
                    <MiniPedal effect={e} selected={view === "fx" && selectedFx === id} onToggle={(on) => fxEdit(id, "on", (x) => ({ ...x, on }))} />
                    <button type="button" onClick={() => selectFx(id)} aria-pressed={view === "fx" && selectedFx === id} aria-label={`Edit ${d.name} (${d.kind}${e.on ? "" : ", bypassed"})`} className="focus-ring absolute inset-x-0 top-0 h-[92px] rounded-t-[10px]" />
                  </div>
                </div>
              </li>
            );
          })}
          {marker(others.length)}
          <Cable />
          <li className="flex shrink-0 flex-col items-center gap-2 pt-6">
            <button type="button" onClick={onAdd} disabled={effects.length >= MAX_EFFECTS} className="focus-ring flex h-[132px] w-[88px] flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-line-strong font-body text-xs text-muted hover:border-copper/60 hover:text-ink disabled:opacity-40">
              <Icon name="plus" size={18} /> Add pedal
            </button>
          </li>
          <Cable />
          <li aria-hidden className="flex shrink-0 flex-col items-center pt-[70px]">
            <Icon name="headphones" size={20} className="text-muted" />
            <span className="mt-1 font-mono text-[8px] uppercase tracking-[0.14em] text-muted">Out</span>
          </li>
        </ol>
      </div>
      <p id="chain-help" className="sr-only">Arrow left and right move the pedal along the chain; moving past the amp changes whether it runs before the amp or after the cabinet.</p>
      <p aria-live="polite" className="sr-only">{announce}</p>
    </section>
  );
}

// ── Editors ────────────────────────────────────────────────────────────

function AmpEditor({ powered, onPower }: { powered: boolean; onPower: () => void }) {
  const store = useStudioStore();
  const amp = useStudio((s) => s.patch.amp);
  const ampSlot = useStudio((s) => s.patch.device?.ampSlot);
  const device = useStudio((s) => s.device);
  const { knobs, switches } = useAmpControls();
  const { edit } = store.getState();
  const [filter, setFilter] = useState<AmpCharacter | "all">("all");
  const design = AMP_DESIGNS[amp.model];
  const shown = AMP_MODELS.filter((m) => filter === "all" || AMP_DESIGNS[m].character === filter);
  return (
    <div className="space-y-6">
      <AmpFace
        model={amp.model}
        amp={amp}
        knobs={knobs}
        switches={switches}
        powered={powered}
        title={device ? `${device.name} · ${device.amps.find((a) => a.slot === ampSlot)?.label ?? ""}` : undefined}
        onKnob={(k, v) => edit(`amp.${k}`, (p) => ({ ...p, amp: { ...p.amp, [k]: v } }))}
        onSwitch={(k, v) => edit(`amp.${k}`, (p) => ({ ...p, amp: { ...p.amp, [k]: v } }))}
        onPower={onPower}
      />
      <p className="mx-auto max-w-4xl font-body text-xs leading-relaxed text-muted">
        {device ? `Edits the preset's ${device.name} settings within what the hardware has. ` : `${design.voicing} `}
        Every knob and switch on the panel changes the sound you hear; the jewel lights while audio is running. It&apos;s Resoniq&apos;s own processing, not a model of any real amplifier.
      </p>
      {device ? (
        <label className="mx-auto block max-w-sm">
          <span className="label-engraved">{device.name} amp type</span>
          <select value={ampSlot} onChange={(e) => edit("device.amp", (p) => ({ ...p, device: { ...p.device!, ampSlot: Number(e.target.value) } }))} className="focus-ring mt-2 h-10 w-full rounded-lg border border-line-strong bg-surface-2 px-3 font-body text-sm">
            {device.amps.map((a) => <option key={a.slot} value={a.slot}>{a.label}</option>)}
          </select>
        </label>
      ) : (
        <div className="mx-auto max-w-5xl space-y-3">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter amps">
            <h3 className={`${label} mr-2`}>Amp library · {AMP_MODELS.length}</h3>
            {(["all", ...AMP_CHARACTERS] as const).map((c) => (
              <button key={c} type="button" aria-pressed={filter === c} onClick={() => setFilter(c)} className={`focus-ring h-7 rounded-full border px-2.5 font-body text-xs capitalize ${filter === c ? "border-copper/60 bg-copper/10 text-ink" : "border-line text-muted hover:text-ink"}`}>{c === "all" ? "All" : c.replace("-", " ")}</button>
            ))}
          </div>
          <div role="radiogroup" aria-label="Amp" className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            {shown.map((m) => {
              const d = AMP_DESIGNS[m];
              const on = amp.model === m;
              return (
                <button key={m} type="button" role="radio" aria-checked={on} aria-label={`${d.name}, ${d.character}`} onClick={() => edit("amp.model", (p) => withAmpModel(p, m))} className={`${cardClass(on)} flex flex-col gap-2`}>
                  <MiniAmp model={m} powered={on && powered} width={128} />
                  <span className="flex items-baseline justify-between gap-2"><span className="font-display text-sm font-semibold">{d.name}</span><span className="font-mono text-[9px] uppercase tracking-[0.12em] text-copper">{d.character.replace("-", " ")}</span></span>
                  <span className="font-body text-xs leading-snug text-muted">{d.tagline}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CabEditor({ audio, notify }: { audio: Audio; notify: Notify }) {
  const store = useStudioStore();
  const cab = useStudio((s) => s.patch.cab);
  const device = useStudio((s) => s.device);
  const { edit } = store.getState();
  const irFile = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const ir = audio.impulse;
  const irActive = !!ir && cab.on;
  const voicingOff = !cab.on || irActive;
  async function loadIr(f: File | undefined) {
    if (!f) return;
    setLoading(true);
    try {
      await audio.loadImpulse(f);
      notify(`Loaded the impulse response “${f.name}”.`);
    } catch (err) {
      notify(err instanceof Error ? err.message : "That impulse response couldn't be loaded.", "error");
    } finally {
      setLoading(false);
      if (irFile.current) irFile.current.value = "";
    }
  }
  return (
    <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,320px)_1fr]">
      <div className="flex flex-col items-center gap-4">
        <div className={cab.on ? "" : "opacity-40 grayscale"}><CabFace model={cab.model} width={300} /></div>
        {(!device || device.canBypassCab) && <StudioSwitch label="Cabinet" on={cab.on} onChange={(on) => edit("cab.on", (p) => ({ ...p, cab: { ...p.cab, on } }))} />}
        <p className="text-center font-body text-xs text-muted">{CAB_DESIGNS[cab.model].label}{cab.on ? "" : " · bypassed: you're hearing the amp's direct output"}</p>
      </div>
      <div className="space-y-6">
        <fieldset>
          <legend className={label}>Cabinet</legend>
          <div role="radiogroup" aria-label="Cabinet" className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CAB_MODELS.map((m) => {
              const d = CAB_DESIGNS[m];
              return (
                <button key={m} type="button" role="radio" aria-checked={cab.model === m} onClick={() => edit("cab.model", (p) => ({ ...p, cab: { ...p.cab, model: m } }))} className={`${cardClass(cab.model === m)} flex items-center gap-3`}>
                  <CabFace model={m} width={44} label={false} />
                  <span className="min-w-0"><span className="block font-display text-sm font-semibold">{d.name}</span><span className="block truncate font-body text-[11px] text-muted">{d.open ? "Open back" : "Closed back"}</span></span>
                </button>
              );
            })}
          </div>
        </fieldset>
        {!device && (
          <>
            <fieldset disabled={voicingOff} className="disabled:opacity-50">
              <legend className={label}>Speaker</legend>
              <div role="radiogroup" aria-label="Speaker" className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {SPEAKERS.map((sp) => (
                  <button key={sp} type="button" role="radio" aria-checked={cab.speaker === sp} onClick={() => edit("cab.speaker", (p) => ({ ...p, cab: { ...p.cab, speaker: sp } }))} className={`${cardClass(cab.speaker === sp)} py-2`}>
                    <span className="block font-body text-sm font-medium">{SPEAKER_DESIGNS[sp].name}</span>
                    <span className="block font-body text-[11px] text-muted">{SPEAKER_DESIGNS[sp].label}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset disabled={voicingOff} className="disabled:opacity-50">
              <legend className={label}>Microphone</legend>
              <div role="radiogroup" aria-label="Microphone" className="mt-2 flex flex-wrap gap-1.5">
                {MICS.map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={cab.mic === m} title={MIC_DESIGNS[m].label} onClick={() => edit("cab.mic", (p) => ({ ...p, cab: { ...p.cab, mic: m } }))} className={`focus-ring h-9 rounded-full border px-4 font-body text-sm ${cab.mic === m ? "border-copper/60 bg-copper/10 text-ink" : "border-line text-muted hover:text-ink"}`}>{MIC_DESIGNS[m].name}</button>
                ))}
              </div>
              <p className="mt-1 font-body text-[11px] text-muted">{MIC_DESIGNS[cab.mic].label}</p>
            </fieldset>
          </>
        )}
        <div className="flex flex-wrap items-center gap-6">
          <SpeakerMic position={cab.micPosition} distance={cab.micDistance} disabled={voicingOff} onPosition={(v) => edit("cab.micPosition", (p) => ({ ...p, cab: { ...p.cab, micPosition: v } }))} />
          <div className="flex flex-col items-center gap-4">
            <StudioKnob label="Mic distance" value={cab.micDistance} defaultValue={2} disabled={voicingOff} format={(v) => (v < 2 ? `${v.toFixed(1)} close` : v > 7 ? `${v.toFixed(1)} far` : v.toFixed(1))} onChange={(v) => edit("cab.micDistance", (p) => ({ ...p, cab: { ...p.cab, micDistance: v } }))} />
            <p className="max-w-[12rem] text-center font-body text-[11px] leading-snug text-muted">Drag the mic across the speaker: the centre is brightest, the edge darker. Closer adds bass.</p>
          </div>
        </div>
        <div className="rounded-xl border border-line bg-surface/50 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className={label}>Impulse response</h3>
            {ir ? <span className="font-body text-sm text-ink">{ir.name} <span className="text-muted">· {(ir.seconds * 1000).toFixed(0)} ms</span></span> : <span className="font-body text-sm text-muted">Built-in cabinet</span>}
            <span className="ml-auto flex gap-2">
              <Button size="sm" icon="upload" onClick={() => irFile.current?.click()} disabled={loading}>{loading ? "Loading…" : ir ? "Replace IR" : "Load IR (.wav)"}</Button>
              {ir && <Button size="sm" variant="ghost" onClick={() => { audio.clearImpulse(); notify("Back to the built-in cabinet."); }}>Remove</Button>}
            </span>
            <input ref={irFile} type="file" accept=".wav,audio/wav,audio/x-wav,audio/*" className="hidden" onChange={(e) => void loadIr(e.target.files?.[0])} />
          </div>
          <p className="mt-2 font-body text-[11px] leading-relaxed text-muted">
            A loaded IR replaces the speaker and mic modelling while the cabinet is on, via real convolution. It stays on this device for this session: saved sounds and shared links use the built-in cabinet above.
          </p>
        </div>
      </div>
    </div>
  );
}

function PedalEditor({ onAdd }: { onAdd: () => void }) {
  const store = useStudioStore();
  const effects = useStudio((s) => s.patch.effects);
  const selectedFx = useStudio((s) => s.selectedFx);
  const device = useStudio((s) => s.device);
  const fxEdit = useFxEdit();
  const { edit, selectFx } = store.getState();
  const e = effects.find((x) => x.id === selectedFx) ?? effects[0];
  if (!e) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-10 text-center">
        <Icon name="pedal" size={28} className="text-muted" />
        <p className="font-display text-lg font-semibold">No pedals on the board</p>
        <p className="font-body text-sm text-muted">Add drives in front of the amp, or modulation, delay and reverb after it.</p>
        <Button variant="primary" icon="plus" onClick={onAdd}>Add pedal</Button>
      </div>
    );
  }
  const d = EFFECT_DESIGNS[e.type];
  const params = device?.effectParams[e.type] ?? d.params;
  const voices = device?.voices[e.type] ?? d.voices;
  const ink = pedalInk(e);
  const order = chainOrder(effects);
  const pos = order.indexOf(e.id);
  const set = (key: string, v: number) => fxEdit(e.id, key, (x) => ({ ...x, params: { ...x.params, [key]: v } }));
  const remove = () => {
    const i = effects.findIndex((x) => x.id === e.id);
    edit("fx.remove", (p) => ({ ...p, effects: p.effects.filter((x) => x.id !== e.id) }));
    selectFx(effects[i + 1]?.id ?? effects[i - 1]?.id ?? null);
  };
  const duplicate = () => {
    const copy = { ...newEffect(e.type, undefined, e.placement), on: e.on, voice: e.voice, params: { ...e.params } };
    edit("fx.add", (p) => {
      const at = p.effects.findIndex((x) => x.id === e.id);
      return { ...p, effects: orderEffects([...p.effects.slice(0, at + 1), copy, ...p.effects.slice(at + 1)]) };
    });
    selectFx(copy.id);
  };
  return (
    <div className="mx-auto grid max-w-4xl items-start gap-8 md:grid-cols-[minmax(0,340px)_1fr]">
      <Stompbox
        effect={e}
        controls={
          e.type === "eq" ? (
            <div className="flex w-full justify-between rounded-md bg-black/10 px-1 py-2">
              {params.map((p) => <Fader key={p.key} label={p.label} value={e.params[p.key]} defaultValue={5} ink={ink} format={(v) => db(((v - 5) / 5) * 12)} onChange={(v) => set(p.key, v)} />)}
            </div>
          ) : (
            params.map((p) => <StudioKnob key={p.key} label={p.label} value={e.params[p.key]} defaultValue={d.params.find((x) => x.key === p.key)?.default} look="pedal" size={50} ink={ink} onChange={(v) => set(p.key, v)} />)
          )
        }
      >
        {voices && (
          <div role="radiogroup" aria-label={`${d.name} type`} className="mt-3 flex flex-wrap justify-center gap-1 rounded-full bg-black/25 p-1">
            {voices.map((v) => (
              <button key={v} type="button" role="radio" aria-checked={e.voice === v} onClick={() => fxEdit(e.id, "voice", (x) => ({ ...x, voice: v }))} className={`focus-ring h-7 rounded-full px-2.5 font-mono text-[10px] uppercase tracking-[0.1em] ${e.voice === v ? "bg-[#f3efe8] text-[#111]" : "text-white/80 hover:text-white"}`}>{v}</button>
            ))}
          </div>
        )}
        <span className="mt-4"><Footswitch on={e.on} label={`${d.name} ${e.on ? "on" : "bypassed"}`} onChange={(on) => fxEdit(e.id, "on", (x) => ({ ...x, on }))} size={52} /></span>
      </Stompbox>
      <div className="space-y-5">
        <div>
          <p className="label-engraved text-copper">{d.kind}</p>
          <h3 className="mt-1 font-display text-2xl font-semibold">{d.name}</h3>
          <p className="mt-1 font-body text-sm text-muted">{e.on ? "On" : "Bypassed"} · {e.placement === "pre" ? "before the amp" : "after the cabinet"} · position {pos + 1 - (e.placement === "post" ? 1 : 0)} of {effects.length}</p>
        </div>
        {!device && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon="chevron-left" onClick={() => edit("fx.order", (p) => ({ ...p, effects: nudgeEffect(p.effects, e.id, -1) }))} disabled={pos === 0}>Earlier</Button>
            <Button size="sm" onClick={() => edit("fx.order", (p) => ({ ...p, effects: nudgeEffect(p.effects, e.id, 1) }))} disabled={pos === order.length - 1}>Later <Icon name="chevron-right" size={16} /></Button>
            <Button size="sm" onClick={() => edit("fx.order", (p) => ({ ...p, effects: orderEffects(p.effects.map((x) => (x.id === e.id ? { ...x, placement: x.placement === "pre" ? "post" : "pre" } : x))) }))}>
              {e.placement === "pre" ? "Move after the cab" : "Move before the amp"}
            </Button>
            <Button size="sm" icon="copy" onClick={duplicate} disabled={effects.length >= MAX_EFFECTS}>Duplicate</Button>
          </div>
        )}
        <Button size="sm" variant="ghost" icon="trash" onClick={remove}>Remove from the board</Button>
        <p className="max-w-md font-body text-xs leading-relaxed text-muted">{PEDAL_NOTES[e.type]}</p>
      </div>
    </div>
  );
}

/** What each pedal really does in the audio graph (so nothing is a mystery). */
const PEDAL_NOTES: Record<EffectType, string> = {
  compressor: "A real dynamics compressor: Sustain lowers the threshold and raises the ratio, with make-up gain.",
  boost: "Clean gain up to +20 dB with a treble tilt. In front of a driven amp it adds saturation; after the cab it's a volume boost.",
  overdrive: "A mid-humped soft clipper that keeps some clean low end; Tone sweeps a low-pass after it.",
  distortion: "Hard clipping with a mid pre-emphasis; Filter sweeps the top end from dark to fizzy.",
  fuzz: "Exponential clipping with a tone control that fades from bassy to trebly, scooping the mids in between.",
  wah: "A resonant low-pass. Fixed parks it where Pedal is set; Auto sweeps around it at Speed across Range.",
  gate: "Mutes the signal when the level going into it falls below Threshold; Release sets how gently it closes.",
  eq: "Six peaking bands, ±12 dB each, and an output level.",
  chorus: "A short modulated delay blended with the dry signal.",
  flanger: "A very short modulated delay with feedback (Regen) for the jet sweep.",
  phaser: "Four all-pass stages swept by an LFO, mixed with the dry signal.",
  tremolo: "Volume modulated by an LFO.",
  delay: "Feedback delay up to 1.2 s. Analog is darker, Tape wobbles, Dual adds a second tap.",
  reverb: "Convolution with an impulse generated in your browser for each type and decay.",
};

const PEDAL_GROUPS: { title: string; types: EffectType[] }[] = [
  { title: "Dynamics", types: ["compressor", "gate"] },
  { title: "Drive", types: ["boost", "overdrive", "distortion", "fuzz"] },
  { title: "Filter and EQ", types: ["wah", "eq"] },
  { title: "Modulation", types: ["chorus", "flanger", "phaser", "tremolo"] },
  { title: "Time", types: ["delay", "reverb"] },
];

function AddPedalDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useStudioStore();
  const effects = useStudio((s) => s.patch.effects);
  const device = useStudio((s) => s.device);
  const allowed: EffectType[] = device ? device.effectSlots.filter((slot) => !effects.some((e) => slot.types.includes(e.type))).flatMap((s) => s.types) : [...EFFECT_TYPES];
  const add = (t: EffectType) => {
    const e = newEffect(t);
    store.getState().edit("fx.add", (p) => ({ ...p, effects: orderEffects([...p.effects, e]) }));
    store.getState().selectFx(e.id);
    onClose();
  };
  return (
    <Dialog open={open} title="Add a pedal" onClose={onClose} wide>
      {allowed.length === 0 || effects.length >= MAX_EFFECTS ? (
        <p className="font-body text-sm text-muted">{effects.length >= MAX_EFFECTS ? `The board holds ${MAX_EFFECTS} pedals. Remove one to add another.` : `Every ${device?.name} effect slot is in use.`}</p>
      ) : (
        <div className="space-y-5">
          {PEDAL_GROUPS.map((g) => {
            const types = g.types.filter((t) => allowed.includes(t));
            if (!types.length) return null;
            return (
              <section key={g.title}>
                <h3 className={label}>{g.title}</h3>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {types.map((t) => {
                    const d = EFFECT_DESIGNS[t];
                    return (
                      <button key={t} type="button" onClick={() => add(t)} className="focus-ring flex flex-col items-center gap-2 rounded-xl border border-line p-3 hover:border-copper/60">
                        <MiniPedal effect={newEffect(t, `preview-${t}`)} />
                        <span className="font-body text-[11px] text-muted">{d.placement === "pre" ? "Goes before the amp" : "Goes after the cab"}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </Dialog>
  );
}

// ── Dialogs ────────────────────────────────────────────────────────────

function NameDialog({ open, title, note, initialName, pending, error, onClose, onSave, withRevisionNote = false }: { open: boolean; title: string; note: string; initialName: string; pending: boolean; error: string | null; onClose: () => void; onSave: (name: string, revisionNote: string | null) => void; withRevisionNote?: boolean }) {
  const [name, setName] = useState(initialName);
  const [revision, setRevision] = useState("");
  return (
    <Dialog open={open} title={title} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSave(name.trim() || initialName, revision.trim() || null); }} className="space-y-4">
        <label className="block">
          <span className="label-engraved">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required autoFocus className="panel-inset mt-2 h-11 w-full rounded-xl px-3 font-body text-base outline-none" />
        </label>
        {withRevisionNote && (
          <label className="block">
            <span className="label-engraved">What changed? <span className="normal-case tracking-normal text-muted">(optional, kept in the history)</span></span>
            <input value={revision} onChange={(e) => setRevision(e.target.value)} maxLength={200} placeholder="Darker for the verse; less delay" className="panel-inset mt-2 h-11 w-full rounded-xl px-3 font-body text-sm outline-none" />
          </label>
        )}
        <p className="font-body text-xs text-muted">{note}</p>
        {error && <p role="alert" className="font-body text-sm text-danger">{error} Your edits are still here.</p>}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

const VISIBILITY_TEXT = { PRIVATE: "Private: only you can open it.", UNLISTED: "Unlisted: anyone with the link can open it.", PUBLIC: "Public: listed on Resoniq and your profile." } as const;

function ShareDialog({ open, origin, onClose, notify }: { open: boolean; origin: StudioOrigin; onClose: () => void; notify: Notify }) {
  const router = useRouter();
  const client = useQueryClient();
  const { data: session } = useSession();
  const [visibility, setVisibility] = useState(origin.visibility ?? "PRIVATE");
  const [busy, setBusy] = useState(false);
  const url = origin.toneId && typeof location !== "undefined" ? `${location.origin}/t/${origin.toneId}` : null;
  async function change(v: "UNLISTED" | "PUBLIC" | "PRIVATE") {
    if (!origin.toneId) return;
    setBusy(true);
    try {
      await api(`/api/tones/${origin.toneId}`, { method: "PATCH", body: { visibility: v } });
      setVisibility(v);
      notify(VISIBILITY_TEXT[v]);
      if (session?.user?.id) void client.invalidateQueries({ queryKey: studioKeys.presets(session.user.id) });
      router.refresh();
    } catch (err) {
      notify(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    if (!url) return;
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) await navigator.share({ title: origin.name, url });
      else {
        await navigator.clipboard.writeText(url);
        notify("Link copied.");
      }
    } catch {
      // Dismissing the share sheet isn't an error.
    }
  }
  return (
    <Dialog open={open} title="Share this sound" onClose={onClose}>
      {!origin.toneId ? (
        <p className="font-body text-sm text-muted">Save the sound first; then you can share a link, post it or practise with it. You can also export it as a file from the preset menu.</p>
      ) : !origin.isOwner ? (
        <div className="space-y-3">
          <p className="font-body text-sm text-muted">This is someone else&apos;s sound. Share its tone page; your edits stay yours until you save them as a remix.</p>
          <Button icon="link" onClick={copy}>Copy link</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="font-body text-sm">{VISIBILITY_TEXT[visibility]}</p>
          <div role="radiogroup" aria-label="Who can open it" className="flex flex-wrap gap-1.5">
            {(["PRIVATE", "UNLISTED", "PUBLIC"] as const).map((v) => (
              <button key={v} type="button" role="radio" aria-checked={visibility === v} disabled={busy} onClick={() => void change(v)} className={`focus-ring h-9 rounded-full border px-4 font-body text-sm capitalize ${visibility === v ? "border-copper/60 bg-copper/10 text-ink" : "border-line text-muted hover:text-ink"}`}>{v.toLowerCase()}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon="link" onClick={copy} disabled={visibility === "PRIVATE"}>Copy link</Button>
            <Link href={`/new?tone=${origin.toneId}&category=TONE_COMPARISON`} className="focus-ring inline-flex h-10 items-center rounded-full bg-copper px-4 font-body text-sm font-medium text-bg">Post it</Link>
          </div>
          {visibility === "PUBLIC" && <p className="font-body text-xs text-muted">Make it your signature sound in <Link href="/settings" className="text-copper hover:underline">Settings</Link>: it shows on your profile with its amp panel.</p>}
          {visibility === "PRIVATE" && <p className="font-body text-xs text-muted">Choose unlisted or public to get a link others can open.</p>}
        </div>
      )}
    </Dialog>
  );
}

// ── Shortcuts ──────────────────────────────────────────────────────────

function Shortcuts({ onSave, toggle }: { onSave: () => void; toggle: () => void }) {
  const store = useStudioStore();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.closest("input, textarea, select, [contenteditable=true]");
      const mod = e.metaKey || e.ctrlKey;
      const s = store.getState();
      if (mod && e.key.toLowerCase() === "z" && !typing) { e.preventDefault(); if (e.shiftKey) s.redo(); else s.undo(); return; }
      if (mod && e.key.toLowerCase() === "y" && !typing) { e.preventDefault(); s.redo(); return; }
      if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); onSave(); return; }
      if (typing || mod || e.altKey || el.getAttribute("role") === "slider" || el.closest("[role=dialog]")) return;
      if (e.key === "1") s.setView("amp");
      else if (e.key === "2") s.setView("cab");
      else if (e.key === "3") s.setView("fx");
      else if (e.key.toLowerCase() === "c") s.switchSlot(s.active === "A" ? "B" : "A");
      else if (e.key === " " && !el.closest("button")) { e.preventDefault(); toggle(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, onSave, toggle]);
  return null;
}

// ── The studio ─────────────────────────────────────────────────────────

export type StudioAppProps = {
  initial: { studio: StudioPatch | null; declared: import("@/types/rig").RigSpec | null; inferred: import("@/types/tone").RecipeCore | null };
  origin: StudioOrigin;
  context?: ReactNode;
  /** Arrived here straight after saving this sound for the first time. */
  justSaved?: boolean;
};

export default function StudioApp({ initial, origin, context, justSaved = false }: StudioAppProps) {
  const opened = useMemo(() => patchFromTone(initial), [initial]);
  const [store] = useState(() => createStudioStore(opened.patch, opened.device as StudioDevice | null));
  return (
    <StoreContext.Provider value={store}>
      <Studio origin={origin} from={opened.from} context={context} justSaved={justSaved} />
    </StoreContext.Provider>
  );
}

type Dialogs = { kind: "save"; mode: SaveMode; name: string } | { kind: "rename" } | { kind: "share" } | { kind: "add" } | { kind: "similar"; patch: StudioPatch } | { kind: "history" } | null;

function Studio({ origin, from, context, justSaved }: { origin: StudioOrigin; from: string; context?: ReactNode; justSaved: boolean }) {
  const store = useStudioStore();
  const router = useRouter();
  const client = useQueryClient();
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const audio = useStudioAudio(store);
  const view = useStudio((s) => s.view);
  const device = useStudio((s) => s.device);
  const dirty = useStudio(isDirty);
  const lastEdit = useStudio((s) => s.lastEdit);
  const patch = useStudio((s) => s.patch);
  const [dialog, setDialog] = useState<Dialogs>(null);
  const [renaming, setRenaming] = useState<{ pending: boolean; error: string | null }>({ pending: false, error: null });
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error"; at: number } | null>(null);
  const [savedTone, setSavedTone] = useState<{ id: string; name: string; created: boolean } | null>(() => (justSaved && origin.toneId ? { id: origin.toneId, name: origin.name, created: true } : null));
  const notify: Notify = (text, tone = "ok") => setNotice({ text, tone, at: Date.now() });
  // The flag only says what just happened; a reload shouldn't repeat it.
  useEffect(() => {
    if (!justSaved) return;
    const url = new URL(location.href);
    url.searchParams.delete("saved");
    history.replaceState(history.state, "", url);
  }, [justSaved]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), notice.tone === "error" ? 9000 : 5000);
    return () => clearTimeout(t);
  }, [notice]);
  const save = useSaveStudio(userId ?? "");
  const powered = audio.status.state === "playing";

  // Closing the tab, following a link or opening another sound asks first. A sound you own saves in place from the prompt.
  const canUpdate = !!userId && origin.isOwner && !!origin.toneId;
  useUnsavedChanges({
    dirty,
    label: "your studio sound",
    save: canUpdate ? async () => {
      const p = store.getState().patch;
      await save.mutateAsync({ patch: p, origin, mode: "update", name: origin.name });
      store.getState().markSaved(p);
    } : undefined,
  });

  // The amp's power switch: stop, or start again from the last source (a file needs picking again, so the demo stands in).
  const togglePower = () => (powered ? audio.stop() : void audio.start(audio.status.source && audio.status.source !== "file" ? audio.status.source : "demo"));
  const requestSave = (mode: SaveMode, name?: string) => {
    if (!userId) return router.push(`/login?callbackUrl=${encodeURIComponent(location.pathname + location.search)}`);
    save.reset();
    setDialog({ kind: "save", mode, name: name ?? (mode === "update" ? origin.name : origin.toneId ? `${origin.name} (studio)` : "My studio sound") });
  };
  async function rename(name: string) {
    if (!origin.toneId) return;
    setRenaming({ pending: true, error: null });
    try {
      await api(`/api/tones/${origin.toneId}`, { method: "PATCH", body: { name } });
      if (userId) void client.invalidateQueries({ queryKey: studioKeys.presets(userId) });
      setRenaming({ pending: false, error: null });
      setDialog(null);
      notify(`Renamed to “${name}”.`);
      router.refresh();
    } catch (err) {
      setRenaming({ pending: false, error: errorMessage(err) });
    }
  }
  const readout = lastEdit ? describeEdit(lastEdit.key, patch) : null;

  return (
    <div className="-mx-4 -mt-5 overflow-hidden border-b border-line bg-[#0d0e12] sm:-mx-6 lg:-mx-8 lg:-mt-8">
      <Shortcuts onSave={() => requestSave(origin.isOwner && origin.toneId ? "update" : "new")} toggle={togglePower} />
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-3 sm:px-6">
        <h1 className="font-display text-lg font-semibold tracking-tight">Amp Studio</h1>
        <p className="min-w-0 flex-1 truncate font-body text-sm text-muted">
          {origin.name}
          {from === "analysis" && " · started from Resoniq's analysis"}
          {from === "rig" && " · started from the creator's declared rig"}
          {device && ` · ${device.name} preset`}
        </p>
        {context}
      </header>
      <Toolbar origin={origin} signedIn={!!userId} onSave={requestSave} onRename={() => { setRenaming({ pending: false, error: null }); setDialog({ kind: "rename" }); }} onShare={() => setDialog({ kind: "share" })} onSimilar={() => setDialog({ kind: "similar", patch: store.getState().patch })} onHistory={() => setDialog({ kind: "history" })} notify={notify} />
      <Rack audio={audio} />
      {savedTone && (
        // What to do with a sound once it's saved: the rest of Resoniq, one tap away.
        <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-signal/30 bg-signal/[0.07] px-4 py-2.5 sm:px-6">
          <p className="mr-auto font-body text-sm"><span className="text-signal">Saved</span> <span className="text-ink">{savedTone.name}</span> <span className="text-muted">{savedTone.created ? "to your tone vault, private until you share it." : "changes saved."}</span></p>
          <Link href={`/new?tone=${savedTone.id}&category=TONE_COMPARISON`} className="focus-ring rounded-full bg-copper px-3 py-1 font-body text-[13px] font-medium text-bg hover:bg-copper-soft">Post it</Link>
          <Link href={`/practice?tone=${savedTone.id}`} className="focus-ring font-body text-[13px] text-ink-dim hover:text-ink">Practice with it</Link>
          <Link href={`/t/${savedTone.id}`} className="focus-ring font-body text-[13px] text-ink-dim hover:text-ink">Tone page</Link>
          <button type="button" onClick={() => setSavedTone(null)} aria-label="Dismiss" className="focus-ring rounded-full p-1 text-muted hover:text-ink"><Icon name="close" size={14} /></button>
        </div>
      )}
      <div aria-live="polite" role="status">
        {notice && <p className={`border-b px-4 py-2 font-body text-sm sm:px-6 ${notice.tone === "error" ? "border-danger/30 bg-danger/10 text-danger" : "border-line bg-surface/60 text-ink-dim"}`}>{notice.text}</p>}
      </div>
      <Pedalboard powered={powered} onAdd={() => setDialog({ kind: "add" })} />
      <section aria-label={view === "amp" ? "Amp" : view === "cab" ? "Cabinet" : "Pedal"} className="relative px-4 py-6 sm:px-6 sm:py-8">
        {readout && lastEdit && (
          // Restarts its fade on every edit (keyed by time), then disappears on its own.
          <div key={lastEdit.at} aria-hidden className="studio-readout pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full border border-line-strong bg-bg/85 px-3 py-1 font-mono text-xs text-ink backdrop-blur">{readout}</div>
        )}
        {view === "amp" ? <AmpEditor powered={powered} onPower={togglePower} /> : view === "cab" ? <CabEditor audio={audio} notify={notify} /> : <PedalEditor onAdd={() => setDialog({ kind: "add" })} />}
        {device && (
          <ul className="mx-auto mt-6 max-w-4xl space-y-1 border-t border-line pt-4 font-body text-xs text-muted">
            {device.caveats.map((c) => <li key={c}>{c}</li>)}
          </ul>
        )}
      </section>
      <details className="border-t border-line px-4 py-3 font-body text-xs text-muted sm:px-6">
        <summary className="cursor-pointer select-none text-ink-dim hover:text-ink">What you&apos;re hearing, and what&apos;s only drawn</summary>
        <div className="mt-2 grid max-w-4xl gap-3 leading-relaxed md:grid-cols-2">
          <p>
            <span className="text-ink">Real audio processing (Web Audio, in your browser):</span> input and output gain, a noise gate driven by a level detector, every pedal (compressor, boost, overdrive, distortion,
            fuzz, wah, gate, EQ, chorus, flanger, phaser, tremolo, delay, convolution reverb) in the order on the board, the amp as two waveshaper stages
            with tone-stack filters voiced per design, a filter cabinet re-voiced by speaker, mic type and placement (or your own IR by convolution), then a safety limiter.
          </p>
          <p>
            <span className="text-ink">Only drawn:</span> the tolex, grilles, screws, handles, jacks and cabinet artwork. Every knob, switch, footswitch, LED and the power switch is wired to the sound.
            None of it models a real amplifier, pedal or speaker, and a hardware preset will sound different on the device.
          </p>
        </div>
      </details>
      <p className="sr-only">Keyboard: 1 amp, 2 cabinet, 3 pedals, C compare A and B, Space play or stop, Command or Control Z undo, Shift Command Z redo, Command S save.</p>
      <Dialog open={dialog?.kind === "similar"} title="Tone DNA · similar sounds" onClose={() => setDialog(null)} wide>
        {dialog?.kind === "similar" && <ToneDnaPanel patch={dialog.patch} />}
      </Dialog>
      <Dialog open={dialog?.kind === "history"} title="History" onClose={() => setDialog(null)} wide>
        {dialog?.kind === "history" && userId && origin.toneId && (
          <ToneHistory
            userId={userId}
            toneId={origin.toneId}
            dirty={dirty}
            onHear={(v) => {
              store.getState().loadInto(store.getState().active === "A" ? "B" : "A", v.patch);
              setDialog(null);
              notify(`The version from ${new Date(v.createdAt).toLocaleString()} is in ${store.getState().active === "A" ? "B" : "A"}. Press it (or C) to hear it against what you have now.`);
            }}
            onRestored={(tone) => {
              const p = patchFromTone(tone).patch;
              store.getState().load(p);
              store.getState().markSaved(store.getState().patch);
              setDialog(null);
              notify("Restored. The version you replaced is still in the history.");
              router.refresh();
            }}
          />
        )}
      </Dialog>
      <AddPedalDialog open={dialog?.kind === "add"} onClose={() => setDialog(null)} />
      <ShareDialog key={`share-${dialog?.kind === "share"}`} open={dialog?.kind === "share"} origin={origin} onClose={() => setDialog(null)} notify={notify} />
      <NameDialog
        key={dialog?.kind === "rename" ? "rename" : "rename-closed"}
        open={dialog?.kind === "rename"}
        title="Rename this sound"
        note="Renames the saved sound everywhere it appears."
        initialName={origin.name}
        pending={renaming.pending}
        error={renaming.error}
        onClose={() => setDialog(null)}
        onSave={(name) => void rename(name)}
      />
      <NameDialog
        key={dialog?.kind === "save" ? `save-${dialog.mode}-${dialog.name}` : "save-closed"}
        open={dialog?.kind === "save"}
        title={dialog?.kind === "save" && dialog.mode === "update" ? "Save changes" : "Save as a new sound"}
        note={dialog?.kind === "save" && dialog.mode === "update" ? "Updates this sound in place. The previous settings stay in its history." : "New sounds are private until you choose to share them."}
        initialName={dialog?.kind === "save" ? dialog.name : ""}
        pending={save.isPending}
        error={save.error ? errorMessage(save.error) : null}
        onClose={() => setDialog(null)}
        withRevisionNote={dialog?.kind === "save" && dialog.mode === "update"}
        onSave={(name, revisionNote) => {
          if (dialog?.kind !== "save") return;
          const p = store.getState().patch;
          save.mutate(
            { patch: p, origin, mode: dialog.mode, name, revisionNote },
            {
              onSuccess: ({ id, name: saved }) => {
                store.getState().markSaved(p);
                setDialog(null);
                setSavedTone({ id, name: saved, created: id !== origin.toneId });
                if (id !== origin.toneId) router.replace(`/studio?tone=${id}&saved=1`);
                else router.refresh();
              },
            },
          );
        }}
      />
    </div>
  );
}
